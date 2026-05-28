import prisma from '../../config/prisma.js';
import bcrypt from 'bcryptjs';
import {randomBytes} from 'crypto';
import path from 'path';
import fs from 'fs';
// import Anthropic from '@anthropic-ai/sdk';
import Groq from 'groq-sdk';
// import { GoogleGenerativeAI } from '@google/generative-ai';

import { AppError } from "../../shared/errors/AppError.js";
import { ERROR_CODES } from "../../shared/constants/errorCodes.js";
import { logAction } from "../../shared/logger/auditLogger.js";
import { ACTIONS } from "../../shared/constants/actions.js";


import {getPrescriptionFileUrl, uploadPrescriptionFile} from '../../integrations/azure/azure.storage.js';
import { sendWelcomeEmail } from "../../integrations/resend/emailService.js";
import {generatePatientsExcel} from "../../integrations/reports/patientsExcel.service.js";
import {generateTreatmentExcel} from "../../integrations/reports/treatmentReport.service.js";
import {generatePrescriptionPdf} from "../../integrations/reports/prescriptionPdf.service.js";

// ─── Anthropic client (ключ береться з .env) ──────────────────────────────────
// const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
// const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export class PatientsService {

    // get all patients
    async getAllPatients() {
        const patients = await prisma.users.findMany({
            where: { role_id: 3 },
            select: {
                user_id: true,
                first_name: true,
                last_name: true,
                patronymic: true,
                login: true,
                phone: true,
                contact_info: true,
                avatar: true,
                date_of_birth: true
            }
        });

        return patients.map(p => ({
            id: p.user_id,
            name: `${p.first_name} ${p.last_name} ${p.patronymic}`,
            email: p.login,
            phone: p.phone,
            address: p.contact_info,
            dob: p.date_of_birth?.toLocaleDateString('uk-UA'),
            avatar: p.avatar || null
        }));
    }

    // count the number of patients
    async getCounts() {
        const totalPatients = await prisma.users.count({
            where: { role_id: 3 }
        });

        const onTreatment = await prisma.prescriptions.count({
            where: {
                patient_id: { not: null },
                end_date: { gte: new Date() },
                users_prescriptions_patient_idTousers: {
                    role_id: 3
                }
            }
        });

        return { totalPatients, onTreatment };
    }

    // create patient
    async createPatient(data, req) {
        const {
            last_name,
            first_name,
            patronymic,
            email,
            birth_date,
            phone,
            address
        } = data;

        const exists = await prisma.users.findUnique({
            where: { login: email }
        });

        if (exists) {
            throw new AppError(
                ERROR_CODES.USER_EXISTS,
                'A user with this email already exists',
                400
            );
        }

        const plainPassword = randomBytes(4).toString('hex');
        const hashedPassword = await bcrypt.hash(plainPassword, 10);

        const user = await prisma.users.create({
            data: {
                first_name,
                last_name,
                patronymic,
                login: email,
                password: hashedPassword,
                date_of_birth: birth_date ? new Date(birth_date) : null,
                phone,
                contact_info: address,
                role_id: 3,
            },
        });

        // email
        await sendWelcomeEmail(email, plainPassword);

        // notification
        const now = new Date();

        const notification = await prisma.notifications.create({
            data: {
                notification_type: 'success',
                message: `Вітаємо вас у системі, ${user.last_name} ${user.first_name}!`,
                sent_date: now,
                sent_time: new Date(now.getTime() + (3 * 60 * 60 * 1000))
            }
        });

        await prisma.notification_recipients.create({
            data: {
                notification_id: notification.notification_id,
                user_id: user.user_id,
                is_read: false
            }
        });

        // audit log
        await logAction({
            userId: req.user?.userId,
            action: ACTIONS.CREATE_PATIENT,
            entity: 'PATIENT',
            entityId: user.user_id,
            description: 'Patient created with email and notification',
            req
        });

        return {
            message: 'Patient created successfully',
            userId: user.user_id,
            email,
        };
    }

    // Excel patient report ok
    async exportPatientsToExcel() {
        const patients = await prisma.users.findMany({
            where: { role_id: 3 },
            select: {
                user_id: true,
                first_name: true,
                last_name: true,
                patronymic: true,
                login: true,
                phone: true,
                contact_info: true,
                date_of_birth: true
            }
        });

        return generatePatientsExcel(patients);
    }

    // get patient by id ok
    async getById(id) {
        const user = await prisma.users.findUnique({
            where: { user_id: id },
            select: {
                user_id: true,
                first_name: true,
                last_name: true,
                patronymic: true,
                login: true,
                phone: true,
                contact_info: true,
                avatar: true,
                date_of_birth: true
            }
        });

        if (!user) {
            throw new AppError(
                ERROR_CODES.USER_NOT_FOUND,
                'Patient not found',
                404
            );
        }

        return {
            id: user.user_id,
            name: `${user.last_name} ${user.first_name} ${user.patronymic}`,
            email: user.login,
            phone: user.phone,
            address: user.contact_info,
            avatar: user.avatar,
            dob: user.date_of_birth
                ? new Date(user.date_of_birth).toLocaleDateString('uk-UA')
                : ''
        };
    }

    // get current treatment ok
    async getCurrentTreatment(patientId) {
        const prescriptions = await prisma.prescriptions.findMany({
            where: {
                patient_id: patientId,
                end_date: { gte: new Date() }
            },
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
                date:            p.date_issued?.toISOString(),
                endDate:         p.end_date?.toISOString(),
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

    async getTreatmentHistory(patientId) {
        const prescriptions = await prisma.prescriptions.findMany({
            where: {
                patient_id: patientId,
                end_date: { lt: new Date() }
            },
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
                date:            p.date_issued?.toISOString(),
                endDate:         p.end_date?.toISOString(),
                medications:     Array.from(seen.values()), // ← виправлено
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

    // delete patient ok
    async deletePatient(patientId, req) {
        const id = Number(patientId);

        const patient = await prisma.users.findUnique({
            where: { user_id: id },
        });

        if (!patient) {
            throw new AppError(
                ERROR_CODES.USER_NOT_FOUND,
                'Patient not found',
                404
            );
        }

        await prisma.users.delete({
            where: { user_id: id }
        });

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

    // patient editing ok
    async updatePatient(id, data, req) {
        const {
            last_name,
            first_name,
            patronymic,
            email,
            phone,
            contact_info,
            birth_date,
        } = data;

        const existing = await prisma.users.findUnique({
            where: { user_id: id },
        });

        if (!existing) {
            throw new AppError(
                ERROR_CODES.USER_NOT_FOUND,
                'Patient not found',
                404
            );
        }

        const updated = await prisma.users.update({
            where: { user_id: id },
            data: {
                last_name,
                first_name,
                patronymic,
                login: email,
                phone,
                contact_info,
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
                id: updated.user_id,
                name: `${updated.last_name} ${updated.first_name} ${updated.patronymic}`,
                email: updated.login,
                phone: updated.phone,
                address: updated.contact_info,
                dob: updated.date_of_birth?.toLocaleDateString('uk-UA'),
            },
        };
    }

    // ─── createPrescription (ОНОВЛЕНО) ────────────────────────────────────────
    // Тепер приймає нові клінічні поля + файли від multer
    async createPrescription(doctorId, patientId, data, files, req) {
        const {
            diagnosis, icd_code, wardId, medications,
            complaints, anamnesis, objective_status, recommendations, notes,
        } = data;

        const parsedMeds = typeof medications === 'string'
            ? JSON.parse(medications)
            : medications;

        if (!diagnosis || !wardId || !Array.isArray(parsedMeds) || parsedMeds.length === 0) {
            throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Invalid data for prescription creation', 400);
        }

        const maxDuration = Math.max(...parsedMeds.map(m => Number(m.duration) || 0));
        const endDate = addDays(new Date(), maxDuration);

        const prescription = await prisma.prescriptions.create({
            data: {
                diagnosis,
                icd_code:        icd_code        || null,
                ward_id: Number(wardId),
                patient_id: Number(patientId),
                duration: maxDuration,
                doctor_id: doctorId,
                date_issued: new Date(),
                end_date: endDate,
                complaints:       complaints       || null,
                anamnesis:        anamnesis        || null,
                objective_status: objective_status || null,
                recommendations:  recommendations  || null,
                notes:            notes            || null,
            }
        });

        const startDate = new Date();
        const usedTimesByDay = {};

        for (let medIndex = 0; medIndex < parsedMeds.length; medIndex++) {
            const med = parsedMeds[medIndex]; // ← ОСЬ ЦЕЙ РЯДОК БУВ ВІДСУТНІЙ
            const { medicationName, quantity, timesPerDay, duration } = med;
            const times = getIntakeTimes(Number(timesPerDay));

            for (let day = 0; day < Number(duration); day++) {
                const date = addDays(startDate, day);
                const dateStr = date.toISOString().substring(0, 10);

                if (!usedTimesByDay[dateStr]) usedTimesByDay[dateStr] = new Set();

                for (const timeStr of times) {
                    const [hours, minutes] = timeStr.split(':');
                    let totalMinutes = Number(hours) * 60 + Number(minutes);

                    while (usedTimesByDay[dateStr].has(totalMinutes)) totalMinutes += 30;

                    usedTimesByDay[dateStr].add(totalMinutes);

                    const finalHours = Math.floor(totalMinutes / 60) % 24;
                    const finalMinutes = totalMinutes % 60;
                    const timeStr_final = `${String(finalHours).padStart(2,'0')}:${String(finalMinutes).padStart(2,'0')}:00`;

                    await prisma.prescription_medications.create({
                        data: {
                            prescription_id: prescription.prescription_id,
                            medication_id:   null,
                            medication_name: medicationName,
                            quantity:        Number(quantity),
                            frequency:       `${timesPerDay} раз(и) на день`,
                            intake_date:     date,
                            intake_time:     new Date(`1970-01-01T${timeStr_final}.000Z`)
                        }
                    });
                }
            }
        }

        // Файли з типами
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
                        file_url:        blobName,  // ← blobName замість локального шляху
                        file_type:       fileTypes[idx] || 'other',
                    };
                })
            );

            await prisma.prescription_files.createMany({ data: uploadedFiles });
        }

        await logAction({
            userId: doctorId,
            action: ACTIONS.CREATE_PRESCRIPTION,
            entity: 'PRESCRIPTION',
            entityId: prescription.prescription_id,
            description: 'Prescription created',
            req
        });

        return { message: 'Призначення успішно створено', prescriptionId: prescription.prescription_id };
    }


    // delete prescription ok
    async deletePrescription(prescriptionId, req) {
        const id = Number(prescriptionId);

        const exists = await prisma.prescriptions.findUnique({
            where: { prescription_id: id }
        });

        if (!exists) {
            throw new AppError(
                ERROR_CODES.NOT_FOUND,
                'Призначення не знайдено',
                404
            );
        }

        await prisma.prescription_medications.deleteMany({
            where: { prescription_id: id }
        });

        await prisma.prescriptions.delete({
            where: { prescription_id: id }
        });

        await logAction({
            userId: req.user?.userId,
            action: ACTIONS.DELETE_PRESCRIPTION,
            entity: 'PRESCRIPTION',
            entityId: id,
            description: 'Prescription deleted',
            req
        });
    }

    async getPrescriptionFiles(prescriptionId) {
        const files = await prisma.prescription_files.findMany({
            where: { prescription_id: Number(prescriptionId) }
        });

        // Генеруємо тимчасові URL для кожного файлу
        const filesWithUrls = await Promise.all(
            files.map(async (f) => ({
                file_id: f.file_id,
                file_name: f.file_name,
                file_type: f.file_type,
                uploaded_at: f.uploaded_at,
                url: await getPrescriptionFileUrl(f.file_url),
            }))
        );

        return filesWithUrls;
    }

    async getAllPatientFiles(patientId) {
        const files = await prisma.prescription_files.findMany({
            where: {
                prescriptions: { patient_id: patientId }
            },
            include: {
                prescriptions: { select: { diagnosis: true } }
            },
            orderBy: { uploaded_at: 'desc' }
        });

        const { getPrescriptionFileUrl } = await import('../../integrations/azure/azure.storage.js');

        return Promise.all(files.map(async f => ({
            file_id:     f.file_id,
            file_name:   f.file_name,
            file_type:   f.file_type,
            uploaded_at: f.uploaded_at,
            diagnosis:   f.prescriptions?.diagnosis || '—',
            url:         await getPrescriptionFileUrl(f.file_url),
        })));
    }

    // treatment report ok
    async generateTreatmentReport(patientId) {
        const patient = await prisma.users.findUnique({
            where: { user_id: patientId }
        });

        if (!patient) {
            throw new AppError(
                ERROR_CODES.USER_NOT_FOUND,
                'Пацієнта не знайдено',
                404
            );
        }

        const prescriptions = await prisma.prescriptions.findMany({
            where: { patient_id: patientId },
            include: {
                users_prescriptions_doctor_idTousers: true,
                prescription_medications: {
                    include: { medications: true }
                }
            },
            orderBy: { date_issued: 'desc' }
        });

        return generateTreatmentExcel(patient, prescriptions);
    }

    // --- mobile ---

    // receiving patients for treatment for nurses
    async getAllPatientsForStaff() {
        const now = new Date();

        const patients = await prisma.users.findMany({
            where: {
                role_id: 3,
                prescriptions_prescriptions_patient_idTousers: {
                    some: {
                        end_date: { gt: now }
                    }
                }
            },
            select: {
                user_id: true,
                first_name: true,
                last_name: true,
                patronymic: true,
                login: true,
                phone: true,
                contact_info: true,
                avatar: true,
                date_of_birth: true,
                prescriptions_prescriptions_patient_idTousers: {
                    select: {
                        wards: {
                            select: {
                                ward_number: true
                            }
                        }
                    },
                    orderBy: {
                        date_issued: 'desc'
                    },
                    take: 1
                }
            }
        });

        return patients.map(p => ({
            id: p.user_id,
            name: `${p.first_name} ${p.last_name} ${p.patronymic}`,
            email: p.login,
            phone: p.phone,
            address: p.contact_info,
            dob: p.date_of_birth?.toLocaleDateString('uk-UA'),
            avatar: p.avatar || null,
            ward: p.prescriptions_prescriptions_patient_idTousers[0]?.wards?.ward_number || "—"
        }));
    }

    // treatment history
    async getPrescriptionHistoryByPatient(patientId) {

        if (!patientId) {
            throw new AppError(
                ERROR_CODES.VALIDATION_ERROR,
                'patientId is required',
                400
            );
        }

        const history = await prisma.prescriptions.findMany({
            where: { patient_id: patientId },
            select: {
                prescription_id: true,
                diagnosis: true,
                date_issued: true
            },
            orderBy: {
                date_issued: 'desc'
            }
        });

        return history.map(p => ({
            prescriptionId: p.prescription_id,
            diagnosis: p.diagnosis,
            date: p.date_issued?.toLocaleDateString('uk-UA')
        }));
    }

    // destination details
    async getPrescriptionDetails(prescriptionId) {

        const prescription = await prisma.prescriptions.findUnique({
            where: { prescription_id: prescriptionId },
            include: {
                users_prescriptions_doctor_idTousers: true,
                prescription_medications: {
                    include: {
                        medications: true
                    }
                }
            }
        });

        if (!prescription) {
            throw new AppError(
                ERROR_CODES.NOT_FOUND,
                'Prescription not found',
                404
            );
        }

        const formatDate = (date) =>
            new Date(date).toLocaleDateString('uk-UA');

        const medsMap = {};

        for (const pm of prescription.prescription_medications) {
            const name = pm.medications?.name || "Unknown";

            if (!medsMap[name]) {
                medsMap[name] = {
                    name,
                    frequency: pm.frequency,
                    duration: prescription.duration,
                    intake_times: []
                };
            }

            if (pm.intake_time && pm.quantity !== null) {
                const timeStr = pm.intake_time.toLocaleTimeString('uk-UA', {
                    hour: '2-digit',
                    minute: '2-digit'
                });

                const exists = medsMap[name].intake_times.some(
                    it => it.time === timeStr && it.quantity === pm.quantity
                );

                if (!exists) {
                    medsMap[name].intake_times.push({
                        time: timeStr,
                        quantity: pm.quantity
                    });
                }
            }
        }

        const totalTaken = await prisma.prescription_medications.aggregate({
            where: {
                prescription_id: prescriptionId,
                intake_status: true
            },
            _sum: {
                quantity: true
            }
        }).then(res => res._sum.quantity || 0);

        return {
            diagnosis: prescription.diagnosis || "N/A",
            date: formatDate(prescription.date_issued),
            doctor: `${prescription.users_prescriptions_doctor_idTousers.last_name} ${prescription.users_prescriptions_doctor_idTousers.first_name.charAt(0)}.`,
            total_taken: totalTaken,
            medications: Object.values(medsMap)
        };
    }

    // PDF report
    async generatePrescriptionReport(prescriptionId) {

        const prescription = await prisma.prescriptions.findUnique({
            where: { prescription_id: prescriptionId },
            include: {
                users_prescriptions_doctor_idTousers: true,
                users_prescriptions_patient_idTousers: true,
                prescription_medications: {
                    include: {
                        medications: true
                    }
                }
            }
        });

        if (!prescription) {
            throw new AppError(
                ERROR_CODES.NOT_FOUND,
                'Prescription not found',
                404
            );
        }

        const totalTaken = await prisma.prescription_medications.aggregate({
            where: {
                prescription_id: prescriptionId,
                intake_status: true
            },
            _sum: {
                quantity: true
            }
        }).then(res => res._sum.quantity || 0);

        return generatePrescriptionPdf(prescription, totalTaken);
    }




















































    // Отримати деталі призначення для редагування
    async getPrescriptionById(prescriptionId) {
        const p = await prisma.prescriptions.findUnique({
            where: { prescription_id: Number(prescriptionId) },
            include: {
                users_prescriptions_doctor_idTousers: true,
                prescription_medications: true,
                prescription_files: true,
                wards: true,
            }
        });

        if (!p) throw new AppError(ERROR_CODES.NOT_FOUND, 'Призначення не знайдено', 404);

        // Унікальні препарати для форми
        const medsMap = new Map();
        p.prescription_medications.forEach(pm => {
            if (!pm.medication_name) return;
            if (!medsMap.has(pm.medication_name)) {
                medsMap.set(pm.medication_name, {
                    medicationName: pm.medication_name,
                    quantity:       String(pm.quantity || ''),
                    timesPerDay:    pm.frequency?.match(/\d+/)?.[0] || '',
                    duration:       String(p.duration || ''),
                });
            }
        });

        // ── Реальний графік з БД (унікальні комбінації препарат+час) ─────────────
        const scheduleMap = new Map();
        p.prescription_medications.forEach((pm, idx) => {
            if (!pm.medication_name || !pm.intake_time) return;
            const timeStr = new Date(pm.intake_time).toISOString().substring(11, 16);
            const key = `${pm.medication_name}-${timeStr}`;
            if (!scheduleMap.has(key)) {
                scheduleMap.set(key, {
                    id:       `db-${idx}`,
                    name:     pm.medication_name,
                    time:     timeStr,
                    quantity: pm.quantity || 1,
                    period:   getPeriod(timeStr),
                });
            }
        });

        return {
            prescriptionId:  p.prescription_id,
            diagnosis:       p.diagnosis || '',
            icdCode:         p.icd_code  || '',
            wardId:          p.ward_id || '',
            complaints:      p.complaints || '',
            anamnesis:       p.anamnesis || '',
            objectiveStatus: p.objective_status || '',
            recommendations: p.recommendations || '',
            notes:           p.notes || '',
            duration:        p.duration || 0,
            medications:     Array.from(medsMap.values()),
            schedule:        Array.from(scheduleMap.values()),
            filesCount:      p.prescription_files.length,
            doctor:          `${p.users_prescriptions_doctor_idTousers?.first_name || ''} ${p.users_prescriptions_doctor_idTousers?.last_name || ''}`,
        };
    }

// Оновити призначення
    async updatePrescription(prescriptionId, data, files, req) {
        const {
            diagnosis, icd_code, wardId, medications,
            complaints, anamnesis, objective_status, recommendations, notes,
        } = data;

        const parsedMeds = typeof medications === 'string'
            ? JSON.parse(medications)
            : medications;

        const maxDuration = Math.max(...parsedMeds.map(m => Number(m.duration) || 0));
        const endDate = addDays(new Date(), maxDuration);

        // Оновлюємо основні поля
        await prisma.prescriptions.update({
            where: { prescription_id: Number(prescriptionId) },
            data: {
                diagnosis,
                icd_code:        icd_code        || null,
                ward_id:         Number(wardId),
                duration:        maxDuration,
                end_date:        endDate,
                complaints:      complaints      || null,
                anamnesis:       anamnesis       || null,
                objective_status: objective_status || null,
                recommendations: recommendations || null,
                notes:           notes           || null,
            }
        });

        // Видаляємо старі препарати і створюємо нові
        await prisma.prescription_medications.deleteMany({
            where: { prescription_id: Number(prescriptionId) }
        });

        const startDate = new Date();
        const usedTimesByDay = {};

        const parsedSchedule = typeof data.schedule === 'string'
            ? JSON.parse(data.schedule)
            : data.schedule || [];

// Замість getIntakeTimes — беремо часи з відредагованого графіку
        for (const med of parsedMeds) {
            const { medicationName, quantity, timesPerDay, duration } = med;

            // Знаходимо прийоми цього препарату в графіку
            const medEntries = parsedSchedule.filter(s => s.name === medicationName);

            for (let day = 0; day < Number(duration); day++) {
                const date = addDays(startDate, day);

                for (const entry of medEntries) {
                    const [hours, minutes] = entry.time.split(':').map(Number);
                    const timeStr_final = `${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:00`;

                    await prisma.prescription_medications.create({
                        data: {
                            prescription_id: Number(prescriptionId),
                            medication_id:   null,
                            medication_name: medicationName,
                            quantity:        Number(quantity),
                            frequency:       `${timesPerDay} раз(и) на день`,
                            intake_date:     date,
                            intake_time:     new Date(`1970-01-01T${timeStr_final}.000Z`)
                        }
                    });
                }
            }
        }

        // Додаємо нові файли якщо є
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

        await logAction({
            userId: req.user?.userId,
            action: ACTIONS.UPDATE_PRESCRIPTION,
            entity: 'PRESCRIPTION',
            entityId: Number(prescriptionId),
            description: 'Prescription updated',
            req
        });

        return { message: 'Призначення оновлено' };
    }




















    async getIntakeStats(patientId, prescriptionId, date) {
        const targetDate = date ? new Date(date) : new Date();
        const start = new Date(targetDate); start.setHours(0,0,0,0);
        const end   = new Date(targetDate); end.setHours(23,59,59,999);

        const where = {
            prescriptions: { patient_id: patientId },
            intake_date: { gte: start, lte: end }
        };

        // якщо передано prescriptionId — фільтруємо по ньому
        if (prescriptionId) {
            where.prescription_id = Number(prescriptionId);
        }

        const meds = await prisma.prescription_medications.findMany({
            where,
            include: { prescriptions: { select: { diagnosis: true } } },
            orderBy: { intake_time: 'asc' }
        });

        // Статистика за весь курс призначення
        const allWhere = prescriptionId
            ? { prescription_id: Number(prescriptionId) }
            : { prescriptions: { patient_id: patientId, end_date: { gte: new Date() } } };

        const allMeds = await prisma.prescription_medications.findMany({ where: allWhere });

        const total   = allMeds.length;
        const taken   = allMeds.filter(m => m.intake_status === true).length;
        const missed  = allMeds.filter(m => m.intake_status === false).length;

        return {
            date: targetDate.toISOString().substring(0, 10),
            summary: { total, taken, missed, pending: total - taken - missed },
            schedule: meds.map(m => ({
                id:        m.prescription_med_id,
                name:      m.medication_name || '—',
                quantity:  m.quantity,
                time:      m.intake_time ? new Date(m.intake_time).toISOString().substring(11, 16) : null,
                status:    m.intake_status === true ? 'taken' : m.intake_status === false ? 'missed' : 'pending',
                diagnosis: m.prescriptions?.diagnosis || '—',
            }))
        };
    }

}

// ─── helper functions (незмінні) ──────────────────────────────────────────────
function getIntakeTimes(timesPerDay) {
    switch (timesPerDay) {
        case 1:  return ['14:00'];
        case 2:  return ['08:00', '20:00'];
        case 3:  return ['08:00', '14:00', '20:00'];
        case 4:  return ['08:00', '12:00', '16:00', '20:00'];
        case 5:  return ['08:00', '10:00', '13:00', '16:00', '20:00'];
        case 6:  return ['06:00', '09:00', '12:00', '15:00', '18:00', '21:00'];
        case 7:  return ['06:00', '09:00', '11:00', '13:00', '15:00', '17:00', '19:00'];
        case 8:  return ['06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00'];
        case 9:  return ['06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00'];
        case 10: return ['06:00', '07:30', '09:00', '10:30', '12:00', '13:30', '15:00', '16:30', '18:00', '19:30'];
        default: return ['10:00'];
    }
}

function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}


const getPeriod = (time) => {
    const h = parseInt(time.split(':')[0]);
    if (h < 12) return 'morning';
    if (h < 18) return 'afternoon';
    return 'evening';
};



