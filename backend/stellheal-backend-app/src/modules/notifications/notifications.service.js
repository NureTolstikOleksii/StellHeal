import prisma from '../../config/prisma.js';
import admin from "../../integrations/firebase/firebaseConfig.js";
import { AppError } from '../../shared/errors/AppError.js';
import { ERROR_CODES } from '../../shared/constants/errorCodes.js';
import { logAction } from '../../shared/logger/auditLogger.js';
import { ACTIONS } from '../../shared/constants/actions.js';

export class NotificationService {

    async getUserNotifications(userId) {
        const recipients = await prisma.notification_recipients.findMany({
            where: { user_id: userId },
            orderBy: { notifications: { sent_date: 'desc' } },
            include: { notifications: true }
        });

        return recipients.map(recipient => ({
            id: recipient.notification_id,
            type: recipient.notifications.notification_type,
            message: recipient.notifications.message,
            date: recipient.notifications.sent_date,
            time: recipient.notifications.sent_time,
            is_read: recipient.is_read
        }));
    }

    async markNotificationsRead(userId) {
        await prisma.notification_recipients.updateMany({
            where: { user_id: userId, is_read: false },
            data: { is_read: true }
        });
    }

    async saveFcmToken(userId, token) {
        await prisma.users.update({
            where: { user_id: userId },
            data: { firebase_token: token },
        });

        await logAction({
            userId,
            action: ACTIONS.UPDATE,
            entity: 'USER',
            entityId: userId,
            description: 'FCM token updated',
        });
    }

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

    // Отримуємо інформацію про контейнер, пацієнта та палату
    async getContainerContext(containerId) {
        const container = await prisma.containers.findUnique({
            where: { container_id: containerId },
            include: {
                users: {
                    select: {
                        user_id: true,
                        first_name: true,
                        last_name: true,
                        patronymic: true,
                        firebase_token: true,
                        prescriptions_prescriptions_patient_idTousers: {
                            where: { end_date: { gte: new Date() } },
                            orderBy: { date_issued: 'desc' },
                            take: 1,
                            include: { wards: true }
                        }
                    }
                }
            }
        });

        if (!container?.users) return null;

        const patient = container.users;
        const prescription = patient.prescriptions_prescriptions_patient_idTousers[0];
        const ward = prescription?.wards?.ward_number || '—';

        return {
            patient,
            ward,
            containerNumber: container.container_number,
            patientFullName: `${patient.last_name} ${patient.first_name} ${patient.patronymic || ''}`.trim()
        };
    }

    async sendWeightAlert(containerId, prescriptionMedId) {
        const now = new Date();

        const context = await this.getContainerContext(containerId);
        if (!context) {
            throw new AppError(ERROR_CODES.NOT_FOUND, "Patient not found", 404);
        }

        const { patient, ward, containerNumber, patientFullName } = context;

        // Назва препарату
        const med = await prisma.prescription_medications.findUnique({
            where: { prescription_med_id: prescriptionMedId },
            include: { medications: true }
        });
        const medName = med?.medications?.name || 'препарат';

        // Знаходимо медсестер
        const nurses = await prisma.users.findMany({
            where: { role_id: 2 },
            select: { user_id: true, firebase_token: true }
        });

        // Повідомлення для медсестри
        const nurseMessage = `Пацієнт ${patientFullName} (палата ${ward}, контейнер №${containerNumber}) не забрав препарат "${medName}" протягом 5 хвилин після відкриття відсіку.`;

        // Повідомлення для пацієнта
        const patientMessage = `Будь ласка, прийміть препарат "${medName}". Відсік залишається відкритим — не забудьте взяти таблетки.`;

        // Записуємо окремі сповіщення для пацієнта і медсестер
        // Для пацієнта
        await prisma.notifications.create({
            data: {
                notification_type: "PILL_NOT_TAKEN",
                message: patientMessage,
                sent_date: now,
                sent_time: now,
                container_id: containerId,
                notification_recipients: {
                    create: [{ user_id: patient.user_id, is_read: false }]
                }
            }
        });

        // Для медсестер
        if (nurses.length > 0) {
            await prisma.notifications.create({
                data: {
                    notification_type: "PILL_NOT_TAKEN",
                    message: nurseMessage,
                    sent_date: now,
                    sent_time: now,
                    container_id: containerId,
                    notification_recipients: {
                        create: nurses.map(n => ({ user_id: n.user_id, is_read: false }))
                    }
                }
            });
        }

        // Push пацієнту
        if (patient.firebase_token) {
            await this.sendNotification(
                patient.firebase_token,
                "Не забудьте прийняти ліки",
                patientMessage
            ).catch(err => console.error(`Push to patient failed: ${err.message}`));
        }

        // Push медсестрам
        const nursePushes = nurses
            .filter(n => n.firebase_token)
            .map(n => this.sendNotification(
                n.firebase_token,
                "Пацієнт не забрав таблетки",
                nurseMessage
            ).catch(err => console.error(`Push to nurse failed: ${err.message}`)));

        await Promise.all(nursePushes);

        return { message: "Alert sent" };
    }

    async sendIntakeReminder(containerId, prescriptionMedId) {
        const now = new Date();

        const context = await this.getContainerContext(containerId);
        if (!context) {
            throw new AppError(ERROR_CODES.NOT_FOUND, "Patient not found", 404);
        }

        const { patient, ward, containerNumber } = context;

        const med = await prisma.prescription_medications.findUnique({
            where: { prescription_med_id: prescriptionMedId },
            include: { medications: true }
        });

        const medName = med?.medications?.name || 'препарат';
        const quantity = med?.quantity || 1;
        const intakeTime = med?.intake_time
            ? new Date(med.intake_time).toISOString().substring(11, 16)
            : '';

        const message = `Час прийняти "${medName}" — ${quantity} табл. о ${intakeTime}. Відсік контейнера №${containerNumber} відкрито та чекає на вас.`;

        await prisma.notifications.create({
            data: {
                notification_type: "INTAKE_REMINDER",
                message,
                sent_date: now,
                sent_time: now,
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