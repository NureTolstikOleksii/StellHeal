import prisma from '../../config/prisma.js';
import bcrypt from 'bcryptjs';
import {randomBytes} from 'crypto';

import { AppError } from "../../shared/errors/AppError.js";
import { ERROR_CODES } from "../../shared/constants/errorCodes.js";
import { logAction } from "../../shared/logger/auditLogger.js";
import { ACTIONS } from "../../shared/constants/actions.js";

import { sendWelcomeEmail } from "../../integrations/resend/emailService.js";
import {generatePatientsExcel} from "../../integrations/reports/patientsExcel.service.js";
import {generateTreatmentExcel} from "../../integrations/reports/treatmentReport.service.js";
import {generatePrescriptionPdf} from "../../integrations/reports/prescriptionPdf.service.js";

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
                prescription_medications: {
                    include: {
                        medications: true
                    }
                }
            }
        });

        if (!prescriptions.length) {
            return [];
        }

        return prescriptions.map(p => {
            const uniqueMeds = [];
            const seen = new Set();

            for (const pm of p.prescription_medications) {
                const med = pm.medications;
                if (!med) continue;

                const key = `${med.name}-${pm.frequency}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    uniqueMeds.push(`${med.name} - ${pm.frequency || ''}`);
                }
            }

            return {
                prescriptionId: p.prescription_id,
                name: p.diagnosis,
                date: p.date_issued?.toISOString(),
                endDate: p.end_date?.toISOString(),
                medications: uniqueMeds,
                ward: p.ward_id || '-',
                doctor: `${p.users_prescriptions_doctor_idTousers?.first_name || ''} ${p.users_prescriptions_doctor_idTousers?.last_name || ''}`,
                duration: p.duration || 0
            };
        });
    }

    // отримання історії лікування ok
    async getTreatmentHistory(patientId) {

        const prescriptions = await prisma.prescriptions.findMany({
            where: {
                patient_id: patientId,
                end_date: { lt: new Date() }
            },
            include: {
                users_prescriptions_doctor_idTousers: true,
                prescription_medications: {
                    include: {
                        medications: true
                    }
                }
            }
        });

        if (!prescriptions.length) {
            return [];
        }

        return prescriptions.map(p => {
            const seen = new Map();

            p.prescription_medications.forEach(pm => {
                const med = pm.medications;

                if (med && !seen.has(med.name)) {
                    seen.set(med.name, `${med.name} - ${pm.frequency || ''}`);
                }
            });

            return {
                prescriptionId: p.prescription_id,
                name: p.diagnosis,
                date: p.date_issued?.toISOString(),
                endDate: p.end_date?.toISOString(),
                medications: Array.from(seen.values()),
                ward: p.ward_id || '-',
                doctor: `${p.users_prescriptions_doctor_idTousers?.first_name || ''} ${p.users_prescriptions_doctor_idTousers?.last_name || ''}`,
                duration: p.duration || 0
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

    // createPrescription ok
    async createPrescription(doctorId, patientId, data, req) {

        const { diagnosis, wardId, medications } = data;

        if (!diagnosis || !wardId || !Array.isArray(medications) || medications.length === 0) {
            throw new AppError(
                ERROR_CODES.VALIDATION_ERROR,
                'Invalid data for prescription creation',
                400
            );
        }

        const prescription = await prisma.prescriptions.create({
            data: {
                diagnosis,
                ward_id: wardId,
                patient_id: Number(patientId),
                duration: Number(medications[0].duration),
                doctor_id: doctorId,
                date_issued: new Date(),
            }
        });

        const startDate = new Date();

        for (const med of medications) {
            const { medicationId, quantity, timesPerDay, duration } = med;

            const times = getIntakeTimes(Number(timesPerDay));

            for (let day = 0; day < Number(duration); day++) {
                const date = addDays(startDate, day);

                for (const timeStr of times) {
                    const [hours, minutes] = timeStr.split(':');

                    const intakeTime = new Date(date);
                    intakeTime.setHours(Number(hours), Number(minutes), 0, 0);

                    await prisma.prescription_medications.create({
                        data: {
                            prescription_id: prescription.prescription_id,
                            medication_id: medicationId,
                            quantity: Number(quantity),
                            frequency: `${timesPerDay} раз(и) на день`,
                            intake_date: date,
                            intake_time: intakeTime
                        }
                    });
                }
            }
        }

        await logAction({
            userId: doctorId,
            action: ACTIONS.CREATE_PRESCRIPTION,
            entity: 'PRESCRIPTION',
            entityId: prescription.prescription_id,
            description: 'Prescription created with generated schedule',
            req
        });

        return {
            message: 'Призначення успішно створено',
            prescriptionId: prescription.prescription_id
        };
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
}

// helper functions
function getIntakeTimes(timesPerDay) {
    switch (timesPerDay) {
        case 1:
            return ['14:00'];
        case 2:
            return ['08:00', '20:00'];
        case 3:
            return ['08:00', '14:00', '20:00'];
        case 4:
            return ['08:00', '12:00', '16:00', '20:00'];
        case 5:
            return ['08:00', '10:00', '13:00', '16:00', '20:00'];
        case 6:
            return ['06:00', '09:00', '12:00', '15:00', '18:00', '21:00'];
        case 7:
            return ['06:00', '09:00', '11:00', '13:00', '15:00', '17:00', '19:00'];
        case 8:
            return ['06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00'];
        case 9:
            return ['06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00'];
        case 10:
            return ['06:00', '07:30', '09:00', '10:30', '12:00', '13:30', '15:00', '16:30', '18:00', '19:30'];
        default:
            return ['10:00'];
    }
}

// adding days to the date
function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}
