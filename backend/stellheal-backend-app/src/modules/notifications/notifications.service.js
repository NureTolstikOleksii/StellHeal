import prisma from '../../config/prisma.js';
import admin from "../../integrations/firebase/firebaseConfig.js";
import { AppError } from '../../shared/errors/AppError.js';
import { ERROR_CODES } from '../../shared/constants/errorCodes.js';
import { logAction } from '../../shared/logger/auditLogger.js';
import { ACTIONS } from '../../shared/constants/actions.js';
import { utcToLocalTime } from '../../shared/timezone/timezone.service.js';

export class NotificationService {

    // get notifications
    async getUserNotifications(userId) {
        const recipients = await prisma.notification_recipients.findMany({
            where:   { user_id: userId },
            orderBy: { notifications: { sent_at: 'desc' } },
            include: { notifications: true }
        });

        return recipients.map(r => ({
            id:      r.notification_id,
            type:    r.notifications.notification_type,
            message: r.notifications.message,
            sent_at: r.notifications.sent_at?.toISOString() ?? null,
            is_read: r.is_read
        }));
    }

    // mark as read
    async markNotificationsRead(userId) {
        await prisma.notification_recipients.updateMany({
            where: { user_id: userId, is_read: false },
            data:  { is_read: true }
        });
    }

    // save FCM token
    async saveFcmToken(userId, token) {
        await prisma.users.update({
            where: { user_id: userId },
            data:  { firebase_token: token },
        });

        await logAction({
            userId,
            action:      ACTIONS.UPDATE,
            entity:      'USER',
            entityId:    userId,
            description: 'FCM token updated',
        });
    }

    // send push
    async sendNotification(token, title, body) {
        try {
            await admin.messaging().send({
                notification: { title, body },
                token,
            });
        } catch (err) {
            throw new AppError(ERROR_CODES.INTERNAL_ERROR, 'Failed to send notification', 500);
        }
    }

    // container context
    async getContainerContext(containerId) {
        const container = await prisma.containers.findUnique({
            where:   { container_id: containerId },
            include: {
                users: {
                    select: {
                        user_id:       true,
                        first_name:    true,
                        last_name:     true,
                        patronymic:    true,
                        firebase_token: true,
                        prescriptions_prescriptions_patient_idTousers: {
                            where:   { end_date: { gte: new Date() } },
                            orderBy: { date_issued: 'desc' },
                            take:    1,
                            include: { wards: true }
                        }
                    }
                }
            }
        });

        if (!container?.users) return null;

        const patient      = container.users;
        const prescription = patient.prescriptions_prescriptions_patient_idTousers[0];
        const ward         = prescription?.wards?.ward_number || '—';

        return {
            patient,
            ward,
            containerNumber: container.container_number,
            patientFullName: `${patient.last_name} ${patient.first_name} ${patient.patronymic || ''}`.trim()
        };
    }

    // notification of an unaccepted drug
    async sendWeightAlert(containerId, prescriptionMedId) {
        const now = new Date();

        // Атомарно: позначаємо пропуск прийому і звільняємо відсік пристрою —
        // це одна логічна дія, стан прийому і стан відсіку не повинні розійтися.
        await prisma.$transaction(async (tx) => {
            await tx.prescription_medications.update({
                where: { prescription_med_id: prescriptionMedId },
                data:  { intake_status: false }
            });

            const compartmentMed = await tx.compartment_medications.findFirst({
                where: { prescription_med_id: prescriptionMedId }
            });

            if (compartmentMed) {
                await tx.compartment_medications.update({
                    where: { compartment_med_id: compartmentMed.compartment_med_id },
                    data:  { open_time: now }
                });

                await tx.compartments.update({
                    where: { compartment_id: compartmentMed.compartment_id },
                    data:  { is_filled: false, last_filled_at: null }
                });

                await tx.compartment_medications.delete({
                    where: { compartment_med_id: compartmentMed.compartment_med_id }
                });
            }
        });

        await logAction({
            action:      ACTIONS.UPDATE,
            entity:      'PRESCRIPTION_MED',
            entityId:    prescriptionMedId,
            description: `Intake missed — marked as false, compartment cleared (container_id=${containerId})`,
        });

        const context = await this.getContainerContext(containerId);
        if (!context) {
            throw new AppError(ERROR_CODES.NOT_FOUND, "Patient not found", 404);
        }

        const { patient, ward, containerNumber, patientFullName } = context;

        const med = await prisma.prescription_medications.findUnique({
            where:   { prescription_med_id: prescriptionMedId },
            include: { medications: true }
        });

        const medName = med?.medications?.name || med?.medication_name || 'препарат';

        const nurses = await prisma.users.findMany({
            where:  { role_id: 2 },
            select: { user_id: true, firebase_token: true }
        });

        const nurseMessage   = `Пацієнт ${patientFullName} (палата ${ward}, контейнер №${containerNumber}) не забрав препарат "${medName}" протягом 5 хвилин після відкриття відсіку.`;
        const patientMessage = `Будь ласка, прийміть препарат "${medName}". Відсік залишається відкритим — не забудьте взяти таблетки.`;

        await prisma.notifications.create({
            data: {
                notification_type: "PILL_NOT_TAKEN",
                message:           patientMessage,
                sent_at:           now,
                container_id:      containerId,
                notification_recipients: {
                    create: [{ user_id: patient.user_id, is_read: false }]
                }
            }
        });

        if (nurses.length > 0) {
            await prisma.notifications.create({
                data: {
                    notification_type: "PILL_NOT_TAKEN",
                    message:           nurseMessage,
                    sent_at:           now,
                    container_id:      containerId,
                    notification_recipients: {
                        create: nurses.map(n => ({ user_id: n.user_id, is_read: false }))
                    }
                }
            });
        }

        if (patient.firebase_token) {
            await this.sendNotification(
                patient.firebase_token,
                "Не забудьте прийняти ліки",
                patientMessage
            ).catch(err => console.error(`Push to patient failed: ${err.message}`));
        }

        await Promise.all(
            nurses
                .filter(n => n.firebase_token)
                .map(n => this.sendNotification(
                    n.firebase_token,
                    "Пацієнт не забрав таблетки",
                    nurseMessage
                ).catch(err => console.error(`Push to nurse failed: ${err.message}`)))
        );

        return { message: "Alert sent" };
    }

    // reminding the patient about the appointment
    async sendIntakeReminder(containerId, prescriptionMedId) {
        const now = new Date();

        const context = await this.getContainerContext(containerId);
        if (!context) {
            throw new AppError(ERROR_CODES.NOT_FOUND, "Patient not found", 404);
        }

        const { patient, containerNumber } = context;

        const med = await prisma.prescription_medications.findUnique({
            where:   { prescription_med_id: prescriptionMedId },
            include: {
                medications: true,
                prescriptions: {
                    include: {
                        users_prescriptions_doctor_idTousers: {
                            select: { timezone: true }
                        }
                    }
                }
            }
        });

        const medName  = med?.medications?.name || med?.medication_name || 'препарат';
        const quantity = med?.quantity || 1;

        const doctorTimezone  = med?.prescriptions?.users_prescriptions_doctor_idTousers?.timezone || 'UTC';
        const intakeTimeLocal = med?.intake_at
            ? utcToLocalTime(med.intake_at, doctorTimezone)
            : '';

        const message = `Час прийняти "${medName}" — ${quantity} табл. о ${intakeTimeLocal}. Відсік контейнера №${containerNumber} відкрито та чекає на вас.`;

        await prisma.notifications.create({
            data: {
                notification_type: "INTAKE_REMINDER",
                message,
                sent_at:      now,
                container_id: containerId,
                notification_recipients: {
                    create: [{ user_id: patient.user_id, is_read: false }]
                }
            }
        });

        if (patient.firebase_token) {
            await this.sendNotification(
                patient.firebase_token,
                `Час прийняти ${medName}`,
                message
            ).catch(err => console.error(`Intake reminder push failed: ${err.message}`));
        }

        return { message: "Intake reminder sent" };
    }
}