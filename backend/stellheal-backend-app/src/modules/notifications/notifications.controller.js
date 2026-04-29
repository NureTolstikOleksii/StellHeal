import { Router } from 'express';
import { NotificationService } from './notifications.service.js';

const router = Router();
const notificationService = new NotificationService();

// отримання сповіщень користувача
router.post('/get-by-user', async (req, res) => {
    const { userId } = req.body;

    if (!userId || isNaN(userId)) {
        return res.status(400).json({ error: 'Invalid userId' });
    }

    try {
        const notifications = await notificationService.getUserNotifications(parseInt(userId));
        res.json(notifications);
    } catch (err) {
        console.error('Error fetching notifications:', err);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
});

// позначити прочитаним
router.post('/mark-read', async (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    try {
        await notificationService.markNotificationsRead(userId);
        res.status(200).json({ message: 'Notifications marked as read' });
    } catch (err) {
        console.error('Error marking notifications as read:', err);
        res.status(500).json({ error: 'Failed to mark notifications as read' });
    }
});

// відправка сповіщення
router.post('/send-notification', async (req, res) => {
    const { token, title, body } = req.body;

    if (!token || !title || !body) {
        return res.status(400).json({ message: 'Token, title, and body are required' });
    }

    try {
        await notificationService.sendNotification(token, title, body);
        res.status(200).json({ message: 'Notification sent successfully' });
    } catch (error) {
        console.error('Send notification error:', error);
        res.status(500).json({ message: 'Failed to send notification' });
    }
});

// збереження токену
router.post('/users/:id/fcm-token', async (req, res) => {
    const userId = parseInt(req.params.id);
    const { token } = req.body;

    if (!token || isNaN(userId)) {
        return res.status(400).json({ message: 'Невірні дані' });
    }

    try {
        await notificationService.saveFcmToken(userId, token);
        res.status(200).json({ message: 'FCM токен оновлено' });
    } catch (error) {
        console.error('Помилка оновлення токена:', error);
        res.status(500).json({ message: 'Помилка сервера' });
    }
});

export const notificationRouter = router;
