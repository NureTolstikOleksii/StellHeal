import { Router } from 'express';
import { NotificationService } from './notifications.service.js';

import { authenticateToken } from '../../middleware/auth.middleware.js';
import { authorizeRoles } from '../../middleware/role.middleware.js';
import { AppError } from '../../shared/errors/AppError.js';
import { ERROR_CODES } from '../../shared/constants/errorCodes.js';
import jwt from "jsonwebtoken";

const router = Router();
const notificationService = new NotificationService();

/**
 * 🔐 Middleware для авторизації device
 */
function authenticateDevice(req, res, next) {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            throw new AppError(
                ERROR_CODES.UNAUTHORIZED,
                "Token required",
                401
            );
        }

        const token = authHeader.split(" ")[1];

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        if (decoded.type !== "device") {
            throw new AppError(
                ERROR_CODES.FORBIDDEN,
                "Invalid token type",
                403
            );
        }

        req.device = decoded; // { containerId }

        next();

    } catch (err) {
        next(
            new AppError(
                ERROR_CODES.UNAUTHORIZED,
                "Invalid token",
                401
            )
        );
    }
}

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

// відправка FCM (тільки система / admin)
router.post(
    '/send',
    authenticateToken,
    authorizeRoles(1, 4),
    async (req, res, next) => {
        try {
            const { token, title, body } = req.body;

            if (!token || !title || !body) {
                return next(new AppError(
                    ERROR_CODES.VALIDATION_ERROR,
                    'Token, title, and body are required',
                    400
                ));
            }

            await notificationService.sendNotification(token, title, body);

            res.json({ message: 'Notification sent successfully' });

        } catch (err) {
            next(err);
        }
    }
);

// збереження FCM токена (тільки для себе)
router.post(
    '/fcm-token',
    authenticateToken,
    async (req, res, next) => {
        try {
            const userId = req.user.userId;
            const { token } = req.body;

            if (!token) {
                return next(new AppError(
                    ERROR_CODES.VALIDATION_ERROR,
                    'Token is required',
                    400
                ));
            }

            await notificationService.saveFcmToken(userId, token);

            res.json({ message: 'FCM token updated' });

        } catch (err) {
            next(err);
        }
    }
);










router.post("/weight-alert", authenticateDevice, async (req, res, next) => {
    try {
        const { containerId } = req.device;
        const { prescription_med_id } = req.body;

        const result = await notificationService.sendWeightAlert(
            containerId,
            prescription_med_id
        );

        res.json(result);

    } catch (err) {
        next(err);
    }
});



export const notificationRouter = router;