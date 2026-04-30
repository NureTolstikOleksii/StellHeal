import { Router } from 'express';
import { BackupService } from './backup.service.js';

import { authenticateToken } from '../../middleware/auth.middleware.js';
import { authorizeRoles } from '../../middleware/role.middleware.js';
import { AppError } from '../../shared/errors/AppError.js';
import { ERROR_CODES } from '../../shared/constants/errorCodes.js';

const router = Router();
const backupService = new BackupService();

// last backup ok
router.get(
    '/last',
    authenticateToken,
    authorizeRoles(4),
    async (req, res, next) => {
        try {
            const last = await backupService.getLastBackup();
            res.json({ lastBackup: last || null });
        } catch (err) {
            next(err);
        }
    }
);

// create backup (not ok)
router.post(
    '/manual',
    authenticateToken,
    authorizeRoles(4), // admin
    async (req, res, next) => {
        try {
            const backup = await backupService.createBackup('manual', req);

            res.json({
                message: 'Резервна копія створена успішно',
                timestamp: backup.timestamp
            });

        } catch (err) {
            next(err);
        }
    }
);

export const backupRouter = router;