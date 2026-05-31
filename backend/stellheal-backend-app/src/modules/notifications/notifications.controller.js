import { Router } from 'express';
import { NotificationService } from './notifications.service.js';
import { authenticateToken } from '../../middleware/auth.middleware.js';
import { authorizeRoles } from '../../middleware/role.middleware.js';
import { authenticateDevice } from '../../middleware/device.middleware.js';
import { AppError } from '../../shared/errors/AppError.js';
import { ERROR_CODES } from '../../shared/constants/errorCodes.js';

const router = Router();
const notificationService = new NotificationService();

// отримання сповіщень (тільки свої)
router.get(
    '/my',
    authenticateToken,
    authorizeRoles(3, 2, 1, 4),
    async (req, res, next) => {
        try {
            const userId = req.user.userId;
            const notifications = await notificationService.getUserNotifications(userId);
            res.json(notifications);
        } catch (err) {
            next(err);
        }
    }
);

// позначити прочитаними
router.post(
    '/mark-read',
    authenticateToken,
    async (req, res, next) => {
        try {
            const userId = req.user.userId;
            await notificationService.markNotificationsRead(userId);
            res.json({ message: 'Notifications marked as read' });
        } catch (err) {
            next(err);
        }
    }
);

// відправка FCM
router.post(
    '/send',
    authenticateToken,
    authorizeRoles(1, 4),
    async (req, res, next) => {
        try {
            const { token, title, body } = req.body;
            if (!token || !title || !body) {
                return next(new AppError(ERROR_CODES.VALIDATION_ERROR, 'Token, title, and body are required', 400));
            }
            await notificationService.sendNotification(token, title, body);
            res.json({ message: 'Notification sent successfully' });
        } catch (err) {
            next(err);
        }
    }
);

// збереження FCM токена
router.post(
    '/fcm-token',
    authenticateToken,
    async (req, res, next) => {
        try {
            const userId = req.user.userId;
            const { token } = req.body;
            if (!token) {
                return next(new AppError(ERROR_CODES.VALIDATION_ERROR, 'Token is required', 400));
            }
            await notificationService.saveFcmToken(userId, token);
            res.json({ message: 'FCM token updated' });
        } catch (err) {
            next(err);
        }
    }
);

// сповіщення про неприйнятий препарат
router.post("/weight-alert", authenticateDevice, async (req, res, next) => {
    try {
        const { containerId } = req.device;
        const { prescription_med_id } = req.body;
        const result = await notificationService.sendWeightAlert(containerId, prescription_med_id);
        res.json(result);
    } catch (err) {
        next(err);
    }
});

// нагадування пацієнту про прийом
router.post("/intake-reminder", authenticateDevice, async (req, res, next) => {
    try {
        const { containerId } = req.device;
        const { prescription_med_id } = req.body;
        const result = await notificationService.sendIntakeReminder(containerId, prescription_med_id);
        res.json(result);
    } catch (err) {
        next(err);
    }
});

export const notificationRouter = router;