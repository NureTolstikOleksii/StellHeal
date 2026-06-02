import prisma from '../../config/prisma.js';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { addDays } from 'date-fns';

import { AppError } from "../../shared/errors/AppError.js";
import { ERROR_CODES } from "../../shared/constants/errorCodes.js";
import { logAction } from "../../shared/logger/auditLogger.js";
import { ACTIONS } from "../../shared/constants/actions.js";

import {
    getUserTimezone,
    getStartOfDayInTz,
    localToUtc,
} from '../../shared/timezone/timezone.service.js';

import { getPrescriptionFileUrl, uploadPrescriptionFile } from '../../integrations/azure/azure.storage.js';
import { sendWelcomeEmail } from "../../integrations/resend/emailService.js";
import { generatePatientsExcel } from "../../integrations/reports/patientsExcel.service.js";
import { generateTreatmentExcel } from "../../integrations/reports/treatmentReport.service.js";
import { generatePrescriptionPdf } from "../../integrations/reports/prescriptionPdf.service.js";

export class PatientsService {

    // ─── get all patients ─────────────────────────────────────────────────────
    async getAllPatients() {
        const patients = await prisma.users.findMany({
            where: { role_id: 3 },
            select: {
                user_id: true, first_name: true, last_name: true,
                patronymic: true, login: true, phone: true,
                contact_info: true, avatar: true, date_of_birth: true
            }
        });

        return patients.map(p => ({
            id:      p.user_id,
            name:    `${p.first_name} ${p.last_name} ${p.patronymic}`,
            email:   p.login,
            phone:   p.phone,
            address: p.contact_info,
            dob:     p.date_of_birth?.toISOString().substring(0, 10) ?? null,
            avatar:  p.avatar || null
        }));
    }

    // ─── count patients ───────────────────────────────────────────────────────
    async getCounts() {
        const totalPatients = await prisma.users.count({ where: { role_id: 3 } });

        const onTreatment = await prisma.prescriptions.count({
            where: {
                patient_id: { not: null },
                end_date: { gte: new Date() },
                users_prescriptions_patient_idTousers: { role_id: 3 }
            }
        });

        return { totalPatients, onTreatment };
    }

    // ─── create patient ───────────────────────────────────────────────────────
    async createPatient(data, req) {
        const { last_name, first_name, patronymic, email, birth_date, phone, address } = data;

        const exists = await prisma.users.findUnique({ where: { login: email } });

        if (exists) {
            throw new AppError(ERROR_CODES.USER_EXISTS, 'A user with this email already exists', 400);
        }

        const plainPassword = randomBytes(4).toString('hex');
        const hashedPassword = await bcrypt.hash(plainPassword, 10);

        const user = await prisma.users.create({
            data: {
                first_name, last_name, patronymic,
                login: email,
                password: hashedPassword,
                date_of_birth: birth_date ? new Date(birth_date) : null,
                phone,
                contact_info: address,
                role_id: 3,
            },
        });

        await sendWelcomeEmail(email, plainPassword);

        await prisma.notifications.create({
            data: {
                notification_type: 'success',
                message: `Вітаємо вас у системі, ${user.last_name} ${user.first_name}!`,
                sent_at: new Date(),
                notification_recipients: {
                    create: [{ user_id: user.user_id, is_read: false }]
                }
            }
        });

        await logAction({
            userId: req.user?.userId,
            action: ACTIONS.CREATE_PATIENT,
            entity: 'PATIENT',
            entityId: user.user_id,
            description: 'Patient created with email and notification',
            req
        });

        return { message: 'Patient created successfully', userId: user.user_id, email };
    }

    // ─── Excel patient report ─────────────────────────────────────────────────
    async exportPatientsToExcel() {
        const patients = await prisma.users.findMany({
            where: { role_id: 3 },
            select: {
                user_id: true, first_name: true, last_name: true,
                patronymic: true, login: true, phone: true,
                contact_info: true, date_of_birth: true
            }
        });

        return generatePatientsExcel(patients);
    }

    // ─── get patient by id ────────────────────────────────────────────────────
    async getById(id) {
        const user = await prisma.users.findUnique({
            where: { user_id: id },
            select: {
                user_id: true, first_name: true, last_name: true,
                patronymic: true, login: true, phone: true,
                contact_info: true, avatar: true, date_of_birth: true
            }
        });

        if (!user) {
            throw new AppError(ERROR_CODES.USER_NOT_FOUND, 'Patient not found', 404);
        }

        return {
            id:      user.user_id,
            name:    `${user.last_name} ${user.first_name} ${user.patronymic}`,
            email:   user.login,
            phone:   user.phone,
            address: user.contact_info,
            avatar:  user.avatar,
            dob:     user.date_of_birth?.toISOString().substring(0, 10) ?? ''
        };
    }

    // ─── get current treatment ────────────────────────────────────────────────
    async getCurrentTreatment(patientId) {
        const prescriptions = await prisma.prescriptions.findMany({
            where: { patient_id: patientId, end_date: { gte: new Date() } },
            include: {
                users_prescriptions_doctor_idTousers: true,
                prescription_medications: true,
                prescription_files: true
            }
        });

        if (!prescriptions.length) return [];

        return prescriptions.map(p => {
            const uniqueMeds = [];
            const seen = new Set();

            for (const pm of p.prescription_medications) {
                const name = pm.medication_name;
                if (!name) continue;
                const key = `${name}-${pm.frequency}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    uniqueMeds.push(`${name} - ${pm.frequency || ''}`);
                }
            }

            return {
                prescriptionId:  p.prescription_id,
                name:            p.diagnosis,
                icdCode:         p.icd_code || null,
                date:            p.date_issued?.toISOString() ?? null,
                endDate:         p.end_date?.toISOString() ?? null,
                medications:     uniqueMeds,
                ward:            p.ward_id || '-',
                doctor:          `${p.users_prescriptions_doctor_idTousers?.first_name || ''} ${p.users_prescriptions_doctor_idTousers?.last_name || ''}`,
                duration:        p.duration || 0,
                filesCount:      p.prescription_files.length,
                complaints:      p.complaints       || null,
                anamnesis:       p.anamnesis        || null,
                objectiveStatus: p.objective_status || null,
                recommendations: p.recommendations  || null,
                notes:           p.notes            || null,
            };
        });
    }

    // ─── get treatment history ────────────────────────────────────────────────
    async getTreatmentHistory(patientId) {
        const prescriptions = await prisma.prescriptions.findMany({
            where: { patient_id: patientId, end_date: { lt: new Date() } },
            include: {
                users_prescriptions_doctor_idTousers: true,
                prescription_medications: true,
                prescription_files: true
            }
        });

        if (!prescriptions.length) return [];

        return prescriptions.map(p => {
            const seen = new Map();

            p.prescription_medications.forEach(pm => {
                const name = pm.medication_name;
                if (name && !seen.has(name)) {
                    seen.set(name, `${name} - ${pm.frequency || ''}`);
                }
            });

            return {
                prescriptionId:  p.prescription_id,
                name:            p.diagnosis,
                icdCode:         p.icd_code || null,
                date:            p.date_issued?.toISOString() ?? null,
                endDate:         p.end_date?.toISOString() ?? null,
                medications:     Array.from(seen.values()),
                ward:            p.ward_id || '-',
                doctor:          `${p.users_prescriptions_doctor_idTousers?.first_name || ''} ${p.users_prescriptions_doctor_idTousers?.last_name || ''}`,
                duration:        p.duration || 0,
                filesCount:      p.prescription_files.length,
                complaints:      p.complaints       || null,
                anamnesis:       p.anamnesis        || null,
                objectiveStatus: p.objective_status || null,
                recommendations: p.recommendations  || null,
                notes:           p.notes            || null,
            };
        });
    }

    // ─── delete patient ───────────────────────────────────────────────────────
    async deletePatient(patientId, req) {
        const id = Number(patientId);

        const patient = await prisma.users.findUnique({ where: { user_id: id } });

        if (!patient) {
            throw new AppError(ERROR_CODES.USER_NOT_FOUND, 'Patient not found', 404);
        }

        await prisma.users.delete({ where: { user_id: id } });

        await logAction({
            userId: req.user?.userId,
            action: ACTIONS.DELETE_PATIENT,
            entity: 'PATIENT',
            entityId: id,
            description: 'Patient deleted',
            req
        });

        return { message: 'Patient successfully deleted' };
    }

    // ─── update patient ───────────────────────────────────────────────────────
    async updatePatient(id, data, req) {
        const { last_name, first_name, patronymic, email, phone, contact_info, birth_date } = data;

        const existing = await prisma.users.findUnique({ where: { user_id: id } });

        if (!existing) {
            throw new AppError(ERROR_CODES.USER_NOT_FOUND, 'Patient not found', 404);
        }

        const updated = await prisma.users.update({
            where: { user_id: id },
            data: {
                last_name, first_name, patronymic,
                login: email, phone, contact_info,
                date_of_birth: birth_date ? new Date(birth_date) : null,
            },
        });

        await logAction({
            userId: req.user?.userId,
            action: ACTIONS.UPDATE_PATIENT,
            entity: 'PATIENT',
            entityId: id,
            description: 'Patient updated',
            req
        });

        return {
            message: 'Patient successfully updated',
            user: {
                id:      updated.user_id,
                name:    `${updated.last_name} ${updated.first_name} ${updated.patronymic}`,
                email:   updated.login,
                phone:   updated.phone,
                address: updated.contact_info,
                dob:     updated.date_of_birth?.toISOString().substring(0, 10) ?? null,
            },
        };
    }

    // ─── create prescription ──────────────────────────────────────────────────
    async createPrescription(doctorId, patientId, data, files, req) {
        const {
            diagnosis, icd_code, wardId, medications,
            complaints, anamnesis, objective_status, recommendations, notes,
        } = data;

        const parsedMeds     = typeof medications === 'string' ? JSON.parse(medications) : medications;
        const parsedSchedule = typeof data.schedule === 'string' ? JSON.parse(data.schedule) : data.schedule || [];

        if (!diagnosis || !wardId || !Array.isArray(parsedMeds) || parsedMeds.length === 0) {
            throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Invalid data for prescription creation', 400);
        }

        const timezone     = await getUserTimezone(doctorId);
        const startOfToday = getStartOfDayInTz(timezone);
        const now          = new Date();

        // ── Визначаємо реальну тривалість з урахуванням extraDay ─────────────────
        // Якщо сьогоднішній час прийому вже минув — препарат починається завтра
        let maxRealDuration = 0;
        const medExtraMap   = new Map();

        for (const med of parsedMeds) {
            const medEntries     = parsedSchedule.filter(s => s.name === med.medicationName);
            const todayDateStr   = startOfToday.toISOString().substring(0, 10);

            const hasTodayFuture = medEntries.some(entry => {
                const todayIntake = localToUtc(todayDateStr, entry.time, timezone);
                return todayIntake > now;
            });

            // При створенні немає існуючих записів — тільки перевіряємо час
            const extraDay     = hasTodayFuture ? 0 : 1;
            const realDuration = Number(med.duration) + extraDay;

            medExtraMap.set(med.medicationName, extraDay);
            if (realDuration > maxRealDuration) maxRealDuration = realDuration;
        }

        const endDate = addDays(startOfToday, maxRealDuration - 1);

        // ── Створюємо призначення ─────────────────────────────────────────────────
        const prescription = await prisma.prescriptions.create({
            data: {
                diagnosis,
                icd_code:         icd_code        || null,
                ward_id:          Number(wardId),
                patient_id:       Number(patientId),
                duration:         maxRealDuration,
                doctor_id:        doctorId,
                date_issued:      startOfToday,
                end_date:         endDate,
                complaints:       complaints       || null,
                anamnesis:        anamnesis        || null,
                objective_status: objective_status || null,
                recommendations:  recommendations  || null,
                notes:            notes            || null,
            }
        });

        // ── Створюємо записи препаратів ───────────────────────────────────────────
        for (const med of parsedMeds) {
            const { medicationName, quantity, timesPerDay, duration } = med;
            const medEntries = parsedSchedule.filter(s => s.name === medicationName);
            const extraDay   = medExtraMap.get(medicationName) ?? 0;
            const totalDays  = Number(duration) + extraDay;

            for (let day = 0; day < totalDays; day++) {
                const date    = addDays(startOfToday, day);
                const dateStr = date.toISOString().substring(0, 10);

                for (const entry of medEntries) {
                    const intake_at = localToUtc(dateStr, entry.time, timezone);

                    // Пропускаємо якщо час вже минув
                    if (intake_at <= now) continue;

                    await prisma.prescription_medications.create({
                        data: {
                            prescription_id: prescription.prescription_id,
                            medication_id:   null,
                            medication_name: medicationName,
                            quantity:        Number(quantity),
                            frequency:       `${timesPerDay} раз(и) на день`,
                            intake_at,
                        }
                    });
                }
            }
        }

        // ── Файли ─────────────────────────────────────────────────────────────────
        if (files && files.length > 0) {
            const fileTypes = Array.isArray(data.fileTypes)
                ? data.fileTypes
                : data.fileTypes ? [data.fileTypes] : [];

            const uploadedFiles = await Promise.all(
                files.map(async (f, idx) => {
                    const blobName = await uploadPrescriptionFile(f);
                    return {
                        prescription_id: prescription.prescription_id,
                        file_name:       Buffer.from(f.originalname, 'latin1').toString('utf8'),
                        file_url:        blobName,
                        file_type:       fileTypes[idx] || 'other',
                    };
                })
            );

            await prisma.prescription_files.createMany({ data: uploadedFiles });
        }

        // ── Лог ───────────────────────────────────────────────────────────────────
        await logAction({
            userId:      doctorId,
            action:      ACTIONS.CREATE_PRESCRIPTION,
            entity:      'PRESCRIPTION',
            entityId:    prescription.prescription_id,
            description: `Prescription created (timezone: ${timezone})`,
            req
        });

        return { message: 'Призначення успішно створено', prescriptionId: prescription.prescription_id };
    }

    // ─── delete prescription ──────────────────────────────────────────────────
    async deletePrescription(prescriptionId, req) {
        const id = Number(prescriptionId);

        const exists = await prisma.prescriptions.findUnique({ where: { prescription_id: id } });

        if (!exists) {
            throw new AppError(ERROR_CODES.NOT_FOUND, 'Призначення не знайдено', 404);
        }

        await prisma.prescription_medications.deleteMany({ where: { prescription_id: id } });
        await prisma.prescriptions.delete({ where: { prescription_id: id } });

        await logAction({
            userId: req.user?.userId,
            action: ACTIONS.DELETE_PRESCRIPTION,
            entity: 'PRESCRIPTION',
            entityId: id,
            description: 'Prescription deleted',
            req
        });
    }

    // ─── get prescription files ───────────────────────────────────────────────
    async getPrescriptionFiles(prescriptionId) {
        const files = await prisma.prescription_files.findMany({
            where: { prescription_id: Number(prescriptionId) }
        });

        return Promise.all(
            files.map(async (f) => ({
                file_id:     f.file_id,
                file_name:   f.file_name,
                file_type:   f.file_type,
                uploaded_at: f.uploaded_at?.toISOString() ?? null,
                url:         await getPrescriptionFileUrl(f.file_url),
            }))
        );
    }

    // ─── get all patient files ────────────────────────────────────────────────
    async getAllPatientFiles(patientId) {
        const files = await prisma.prescription_files.findMany({
            where: { prescriptions: { patient_id: patientId } },
            include: { prescriptions: { select: { diagnosis: true } } },
            orderBy: { uploaded_at: 'desc' }
        });

        const { getPrescriptionFileUrl } = await import('../../integrations/azure/azure.storage.js');

        return Promise.all(files.map(async f => ({
            file_id:     f.file_id,
            file_name:   f.file_name,
            file_type:   f.file_type,
            uploaded_at: f.uploaded_at?.toISOString() ?? null,
            diagnosis:   f.prescriptions?.diagnosis || '—',
            url:         await getPrescriptionFileUrl(f.file_url),
        })));
    }

    // ─── treatment report ─────────────────────────────────────────────────────
    async generateTreatmentReport(patientId) {
        const patient = await prisma.users.findUnique({ where: { user_id: patientId } });

        if (!patient) {
            throw new AppError(ERROR_CODES.USER_NOT_FOUND, 'Пацієнта не знайдено', 404);
        }

        const prescriptions = await prisma.prescriptions.findMany({
            where: { patient_id: patientId },
            include: {
                users_prescriptions_doctor_idTousers: true,
                prescription_medications: { include: { medications: true } }
            },
            orderBy: { date_issued: 'desc' }
        });

        return generateTreatmentExcel(patient, prescriptions);
    }

    // ─── patients for staff (mobile) ──────────────────────────────────────────
    async getAllPatientsForStaff() {
        const now = new Date();

        const patients = await prisma.users.findMany({
            where: {
                role_id: 3,
                prescriptions_prescriptions_patient_idTousers: {
                    some: { end_date: { gt: now } }
                }
            },
            select: {
                user_id: true, first_name: true, last_name: true,
                patronymic: true, login: true, phone: true,
                contact_info: true, avatar: true, date_of_birth: true,
                prescriptions_prescriptions_patient_idTousers: {
                    select: { wards: { select: { ward_number: true } } },
                    orderBy: { date_issued: 'desc' },
                    take: 1
                }
            }
        });

        return patients.map(p => ({
            id:      p.user_id,
            name:    `${p.first_name} ${p.last_name} ${p.patronymic}`,
            email:   p.login,
            phone:   p.phone,
            address: p.contact_info,
            dob:     p.date_of_birth?.toISOString().substring(0, 10) ?? null,
            avatar:  p.avatar || null,
            ward:    p.prescriptions_prescriptions_patient_idTousers[0]?.wards?.ward_number || "—"
        }));
    }

    // ─── prescription history (mobile) ───────────────────────────────────────
    async getPrescriptionHistoryByPatient(patientId) {
        if (!patientId) {
            throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'patientId is required', 400);
        }

        const history = await prisma.prescriptions.findMany({
            where: { patient_id: patientId },
            select: { prescription_id: true, diagnosis: true, date_issued: true },
            orderBy: { date_issued: 'desc' }
        });

        return history.map(p => ({
            prescriptionId: p.prescription_id,
            diagnosis:      p.diagnosis,
            date:           p.date_issued?.toISOString() ?? null
        }));
    }

    // ─── prescription details (mobile) ───────────────────────────────────────
    async getPrescriptionDetails(prescriptionId) {
        const prescription = await prisma.prescriptions.findUnique({
            where: { prescription_id: prescriptionId },
            include: {
                users_prescriptions_doctor_idTousers: true,
                prescription_medications: { include: { medications: true } }
            }
        });

        if (!prescription) {
            throw new AppError(ERROR_CODES.NOT_FOUND, 'Prescription not found', 404);
        }

        const medsMap = {};

        for (const pm of prescription.prescription_medications) {
            const name = pm.medications?.name || pm.medication_name || "Unknown";

            if (!medsMap[name]) {
                medsMap[name] = {
                    name,
                    frequency:    pm.frequency,
                    duration:     prescription.duration,
                    intake_times: []
                };
            }

            if (pm.intake_at && pm.quantity !== null) {
                // UTC ISO — мобайл конвертує в локальний час через ZonedDateTime
                const intake_at_iso = pm.intake_at.toISOString();

                const exists = medsMap[name].intake_times.some(
                    it => it.intake_at === intake_at_iso && it.quantity === pm.quantity
                );

                if (!exists) {
                    medsMap[name].intake_times.push({
                        intake_at: intake_at_iso,
                        quantity:  pm.quantity
                    });
                }
            }
        }

        const totalTaken = await prisma.prescription_medications.aggregate({
            where: { prescription_id: prescriptionId, intake_status: true },
            _sum: { quantity: true }
        }).then(res => res._sum.quantity || 0);

        return {
            diagnosis:   prescription.diagnosis || "N/A",
            date:        prescription.date_issued?.toISOString() ?? null,
            doctor:      `${prescription.users_prescriptions_doctor_idTousers.last_name} ${prescription.users_prescriptions_doctor_idTousers.first_name.charAt(0)}.`,
            total_taken: totalTaken,
            medications: Object.values(medsMap)
        };
    }

    // ─── PDF report ───────────────────────────────────────────────────────────
    async generatePrescriptionReport(prescriptionId) {
        const prescription = await prisma.prescriptions.findUnique({
            where: { prescription_id: prescriptionId },
            include: {
                users_prescriptions_doctor_idTousers: true,
                users_prescriptions_patient_idTousers: true,
                prescription_medications: { include: { medications: true } }
            }
        });

        if (!prescription) {
            throw new AppError(ERROR_CODES.NOT_FOUND, 'Prescription not found', 404);
        }

        const totalTaken = await prisma.prescription_medications.aggregate({
            where: { prescription_id: prescriptionId, intake_status: true },
            _sum: { quantity: true }
        }).then(res => res._sum.quantity || 0);

        return generatePrescriptionPdf(prescription, totalTaken);
    }

    // ─── get prescription for edit ────────────────────────────────────────────
    async getPrescriptionById(prescriptionId) {
        const p = await prisma.prescriptions.findUnique({
            where: { prescription_id: Number(prescriptionId) },
            include: {
                users_prescriptions_doctor_idTousers: true,
                prescription_medications:             true,
                prescription_files:                   true,
                wards:                                true,
            }
        });

        if (!p) throw new AppError(ERROR_CODES.NOT_FOUND, 'Призначення не знайдено', 404);

        const now = new Date();

        // ── Препарати — унікальні по назві ───────────────────────────────────────
        const medsMap = new Map();
        p.prescription_medications.forEach(pm => {
            if (!pm.medication_name) return;
            if (!medsMap.has(pm.medication_name)) {
                medsMap.set(pm.medication_name, {
                    medicationName: pm.medication_name,
                    quantity:       String(pm.quantity || ''),
                    timesPerDay:    pm.frequency?.match(/\d+/)?.[0] || '',
                    duration:       String(p.duration || ''), // поки що дефолт
                    _dates:         new Set(), // для підрахунку унікальних дат
                });
            }
            // Збираємо унікальні дати для цього препарату
            if (pm.intake_at) {
                const dateStr = pm.intake_at.toISOString().substring(0, 10);
                medsMap.get(pm.medication_name)._dates.add(dateStr);
            }
        });

        // Після збору — рахуємо duration по унікальних датах
        const medications = Array.from(medsMap.values()).map(({ _dates, ...med }) => ({
            ...med,
            duration: String(_dates.size || p.duration || ''),
        }));

        // ── Розклад — пріоритет майбутнім записам ────────────────────────────────
        // Якщо є майбутній запис для препарату — показуємо його час
        // Якщо немає — показуємо останній минулий (щоб лікар бачив поточний час)
        const scheduleMap = new Map();

        // 1. Спочатку додаємо майбутні записи
        p.prescription_medications
            .filter(pm => pm.medication_name && pm.intake_at && new Date(pm.intake_at) > now)
            .sort((a, b) => new Date(a.intake_at) - new Date(b.intake_at)) // найранніші першими
            .forEach((pm, idx) => {
                const intake_at_iso = pm.intake_at.toISOString();
                const key = `${pm.medication_name}-${intake_at_iso.substring(11, 16)}`;
                if (!scheduleMap.has(key)) {
                    scheduleMap.set(key, {
                        id:        `db-${idx}`,
                        name:      pm.medication_name,
                        intake_at: intake_at_iso,
                        quantity:  pm.quantity || 1,
                    });
                }
            });

        // 2. Для препаратів без майбутніх — беремо останній минулий
        p.prescription_medications
            .filter(pm => pm.medication_name && pm.intake_at && new Date(pm.intake_at) <= now)
            .sort((a, b) => new Date(b.intake_at) - new Date(a.intake_at)) // найновіші першими
            .forEach((pm, idx) => {
                // Якщо для цього препарату вже є майбутній запис — пропускаємо
                const hasFuture = Array.from(scheduleMap.keys())
                    .some(k => k.startsWith(`${pm.medication_name}-`));
                if (hasFuture) return;

                const intake_at_iso = pm.intake_at.toISOString();
                const key = `${pm.medication_name}-${intake_at_iso.substring(11, 16)}`;
                if (!scheduleMap.has(key)) {
                    scheduleMap.set(key, {
                        id:        `db-past-${idx}`,
                        name:      pm.medication_name,
                        intake_at: intake_at_iso,
                        quantity:  pm.quantity || 1,
                    });
                }
            });

        return {
            prescriptionId:  p.prescription_id,
            diagnosis:       p.diagnosis        || '',
            icdCode:         p.icd_code         || '',
            wardId:          p.ward_id          || '',
            complaints:      p.complaints       || '',
            anamnesis:       p.anamnesis        || '',
            objectiveStatus: p.objective_status || '',
            recommendations: p.recommendations  || '',
            notes:           p.notes            || '',
            duration:        p.duration         || 0,
            medications:     medications,
            schedule:        Array.from(scheduleMap.values()),
            filesCount:      p.prescription_files.length,
            doctor:          `${p.users_prescriptions_doctor_idTousers?.first_name || ''} ${p.users_prescriptions_doctor_idTousers?.last_name || ''}`,
        };
    }

    // ─── update prescription ──────────────────────────────────────────────────
    async updatePrescription(prescriptionId, data, files, req) {
        const {
            diagnosis, icd_code, wardId, medications,
            complaints, anamnesis, objective_status, recommendations, notes,
        } = data;

        const parsedMeds   = typeof medications === 'string' ? JSON.parse(medications) : medications;
        const timezone     = await getUserTimezone(req.user.userId);
        const startOfToday = getStartOfDayInTz(timezone);
        const now          = new Date();

        const parsedSchedule = typeof data.schedule === 'string'
            ? JSON.parse(data.schedule)
            : data.schedule || [];

        // ── Визначаємо реальну тривалість з урахуванням extraDay ─────────────────
        // Якщо сьогоднішній час прийому вже минув — препарат починається завтра,
        // тому реальна тривалість = duration + 1
        let maxRealDuration = 0;

        const medExtraMap = new Map(); // medicationName → extraDay

        for (const med of parsedMeds) {
            const medEntries   = parsedSchedule.filter(s => s.name === med.medicationName);
            const todayDateStr = startOfToday.toISOString().substring(0, 10);
            const todayEnd     = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);

            // Чи є майбутній прийом сьогодні
            const hasTodayFuture = medEntries.some(entry => {
                const todayIntake = localToUtc(todayDateStr, entry.time, timezone);
                return todayIntake > now;
            });

            // ← Чи вже є будь-який запис сьогодні (прийнятий, пропущений, в контейнері)
            const hasTodayRecord = await prisma.prescription_medications.findFirst({
                where: {
                    prescription_id: Number(prescriptionId),
                    medication_name: med.medicationName,
                    intake_at: {
                        gte: startOfToday,
                        lt:  todayEnd,
                    }
                }
            });

            // extraDay = 1 тільки якщо немає ні майбутнього прийому сьогодні,
            // ні вже існуючого запису на сьогодні
            const extraDay = (!hasTodayFuture && !hasTodayRecord) ? 1 : 0;

            const realDuration = Number(med.duration) + extraDay;
            medExtraMap.set(med.medicationName, extraDay);
            if (realDuration > maxRealDuration) maxRealDuration = realDuration;
        }

        const endDate = addDays(startOfToday, maxRealDuration - 1);

        // ── 1. Оновлюємо саме призначення ────────────────────────────────────────
        await prisma.prescriptions.update({
            where: { prescription_id: Number(prescriptionId) },
            data: {
                diagnosis,
                icd_code:         icd_code        || null,
                ward_id:          Number(wardId),
                duration:         maxRealDuration,
                end_date:         endDate,
                complaints:       complaints       || null,
                anamnesis:        anamnesis        || null,
                objective_status: objective_status || null,
                recommendations:  recommendations  || null,
                notes:            notes            || null,
            }
        });

        // ── 2. Видаляємо майбутні записи що НЕ в контейнері ──────────────────────
        // Минулі і записи в контейнері — не чіпаємо
        await prisma.prescription_medications.deleteMany({
            where: {
                prescription_id: Number(prescriptionId),
                intake_at:       { gt: now },
                compartment_medications: { none: {} }
            }
        });

        // ── 3. Створюємо нові записи для майбутніх днів ───────────────────────────
        for (const med of parsedMeds) {
            const { medicationName, quantity, timesPerDay, duration } = med;
            const medEntries = parsedSchedule.filter(s => s.name === medicationName);
            const extraDay   = medExtraMap.get(medicationName) ?? 0;
            const totalDays  = Number(duration) + extraDay;

            for (let day = 0; day < totalDays; day++) {
                const date    = addDays(startOfToday, day);
                const dateStr = date.toISOString().substring(0, 10);

                for (const entry of medEntries) {
                    const intake_at = localToUtc(dateStr, entry.time, timezone);

                    // Пропускаємо якщо час вже минув
                    if (intake_at <= now) continue;

                    // Пропускаємо якщо на цю дату/час вже є запис в контейнері
                    const inContainer = await prisma.prescription_medications.findFirst({
                        where: {
                            prescription_id: Number(prescriptionId),
                            medication_name: medicationName,
                            intake_at,
                            compartment_medications: { some: {} }
                        }
                    });

                    if (inContainer) continue;

                    await prisma.prescription_medications.create({
                        data: {
                            prescription_id: Number(prescriptionId),
                            medication_id:   null,
                            medication_name: medicationName,
                            quantity:        Number(quantity),
                            frequency:       `${timesPerDay} раз(и) на день`,
                            intake_at,
                        }
                    });
                }
            }
        }

        // ── 4. Файли ──────────────────────────────────────────────────────────────
        if (files && files.length > 0) {
            const { uploadPrescriptionFile } = await import('../../integrations/azure/azure.storage.js');
            const fileTypes = Array.isArray(data.fileTypes)
                ? data.fileTypes
                : data.fileTypes ? [data.fileTypes] : [];

            const uploadedFiles = await Promise.all(
                files.map(async (f, idx) => {
                    const blobName = await uploadPrescriptionFile(f);
                    return {
                        prescription_id: Number(prescriptionId),
                        file_name:       Buffer.from(f.originalname, 'latin1').toString('utf8'),
                        file_url:        blobName,
                        file_type:       fileTypes[idx] || 'other',
                    };
                })
            );

            await prisma.prescription_files.createMany({ data: uploadedFiles });
        }

        // ── 5. Лог ────────────────────────────────────────────────────────────────
        await logAction({
            userId:      req.user?.userId,
            action:      ACTIONS.UPDATE_PRESCRIPTION,
            entity:      'PRESCRIPTION',
            entityId:    Number(prescriptionId),
            description: `Prescription updated (timezone: ${timezone})`,
            req
        });

        return { message: 'Призначення оновлено' };
    }

    // ─── intake stats (web admin) ─────────────────────────────────────────────
    async getIntakeStats(patientId, prescriptionId, date) {
        const targetDate = date ? new Date(date) : new Date();
        const dayStr = targetDate.toISOString().substring(0, 10);

        const dayStart = new Date(`${dayStr}T00:00:00.000Z`);
        const dayEnd   = new Date(`${dayStr}T23:59:59.999Z`);

        const where = {
            prescriptions: { patient_id: patientId },
            intake_at: { gte: dayStart, lte: dayEnd }
        };

        if (prescriptionId) {
            where.prescription_id = Number(prescriptionId);
        }

        const meds = await prisma.prescription_medications.findMany({
            where,
            include: {
                prescriptions: {
                    select: { diagnosis: true }
                }
            },
            orderBy: { intake_at: 'asc' }
        });

        const allWhere = prescriptionId
            ? { prescription_id: Number(prescriptionId) }
            : { prescriptions: { patient_id: patientId, end_date: { gte: new Date() } } };

        const allMeds = await prisma.prescription_medications.findMany({ where: allWhere });

        const total  = allMeds.length;
        const taken  = allMeds.filter(m => m.intake_status === true).length;
        const missed = allMeds.filter(m => m.intake_status === false).length;

        return {
            date: dayStr,
            summary: { total, taken, missed, pending: total - taken - missed },
            schedule: meds.map(m => ({
                id:        m.prescription_med_id,
                name:      m.medication_name || '—',
                quantity:  m.quantity,
                // UTC ISO — фронт конвертує в локальний час
                intake_at: m.intake_at?.toISOString() ?? null,
                status:    m.intake_status === true  ? 'taken'
                    : m.intake_status === false ? 'missed'
                        : 'pending',
                diagnosis: m.prescriptions?.diagnosis || '—',
            }))
        };
    }
}