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
}