import prisma from '../../config/prisma.js';
import admin from "../../integrations/firebase/firebaseConfig.js";

import { AppError } from '../../shared/errors/AppError.js';
import { ERROR_CODES } from '../../shared/constants/errorCodes.js';
import { logAction } from '../../shared/logger/auditLogger.js';
import { ACTIONS } from '../../shared/constants/actions.js';

export class NotificationService {

    // отримати свої сповіщення
    async getUserNotifications(userId) {

        const recipients = await prisma.notification_recipients.findMany({
            where: { user_id: userId },
            orderBy: {
                notifications: {
                    sent_date: 'desc'
                }
            },
            include: {
                notifications: true
            }
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

    // позначити як прочитані
    async markNotificationsRead(userId) {
        await prisma.notification_recipients.updateMany({
            where: {
                user_id: userId,
                is_read: false
            },
            data: {
                is_read: true
            }
        });
    }

    // збереження FCM токена
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

    // відправка push
    async sendNotification(token, title, body) {

        try {
            const message = {
                notification: { title, body },
                token,
            };

            await admin.messaging().send(message);

        } catch (err) {
            throw new AppError(
                ERROR_CODES.INTERNAL_ERROR,
                'Failed to send notification',
                500
            );
        }
    }

    // відправка з контейнера
    async sendWeightAlert(containerId, prescriptionMedId) {
        const now = new Date();

        // Знаходимо пацієнта через контейнер
        const container = await prisma.containers.findUnique({
            where: { container_id: containerId },
            select: { patient_id: true }
        });

        if (!container?.patient_id) {
            throw new AppError(ERROR_CODES.NOT_FOUND, "Patient not found", 404);
        }

        // Знаходимо медсестер (role_id = 2)
        const nurses = await prisma.users.findMany({
            where: { role_id: 2 },
            select: { user_id: true, firebase_token: true }
        });

        // Пацієнт
        const patient = await prisma.users.findUnique({
            where: { user_id: container.patient_id },
            select: { user_id: true, firebase_token: true }
        });

        const recipients = [
            ...(patient ? [patient] : []),
            ...nurses
        ];

        // Записуємо сповіщення в БД
        const notification = await prisma.notifications.create({
            data: {
                notification_type: "PILL_NOT_TAKEN",
                message: "Пацієнт не забрав таблетки протягом 5 хвилин",
                sent_date: now,
                sent_time: now,
                container_id: containerId,
                notification_recipients: {
                    create: recipients.map(r => ({
                        user_id: r.user_id,
                        is_read: false
                    }))
                }
            }
        });

        // Відправляємо push кожному хто має FCM токен
        const pushPromises = recipients
            .filter(r => r.firebase_token)
            .map(r => {
                console.log(`Sending push to user ${r.user_id}, token: ${r.firebase_token?.substring(0, 20)}...`);
                return this.sendNotification(
                    r.firebase_token,
                    "⚠️ Таблетки не прийняті",
                    "Пацієнт не забрав таблетки протягом 5 хвилин"
                ).catch(err => {
                    console.error(`Failed to send push to user ${r.user_id}:`, err.message);
                });
            });

        await Promise.all(pushPromises);

        return { message: "Alert sent", notification_id: notification.notification_id };
    }
}


