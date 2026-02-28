import { PrismaClient } from '@prisma/client';
import admin from "../firebase/firebase.js";
const prisma = new PrismaClient();

export class NotificationService {
    // отримати сповіщення користувача
    async getUserNotifications(userId) {
        return await prisma.notification_recipients.findMany({
            where: {
                user_id: userId
            },
            orderBy: {
                notifications: {
                    sent_date: 'desc'
                }
            },
            include: {
                notifications: true
            }
        }).then(recipients =>
            recipients.map(recipient => ({
                id: recipient.notification_id,
                type: recipient.notifications.notification_type,
                message: recipient.notifications.message,
                date: recipient.notifications.sent_date,
                time: recipient.notifications.sent_time,
                is_read: recipient.is_read
            }))
        );
    }

    // позначити прочитаним
    async markNotificationsRead(userId) {
        return prisma.notification_recipients.updateMany({
            where: {
                user_id: userId,
                is_read: false
            },
            data: {
                is_read: true
            }
        });
    }

    // збереження токену firebase
    async saveFcmToken(userId, token) {
        return prisma.users.update({
            where: { user_id: userId },
            data: { firebase_token: token },
        });
    }

    // відправка сповіщення
    async sendNotification(token, title, body) {
        const message = {
            notification: {
                title,
                body,
            },
            token,
        };

        return await admin.messaging().send(message);
    }
}
