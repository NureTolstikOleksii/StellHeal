import { Router } from 'express';
import { BackupService } from './backup.service.js';

import { authenticateToken } from '../../middleware/auth.middleware.js';
import { authorizeRoles } from '../../middleware/role.middleware.js';
import { AppError } from '../../shared/errors/AppError.js';
import { ERROR_CODES } from '../../shared/constants/errorCodes.js';

const router = Router();
const backupService = new BackupService();

// latest backup
router.get('/last', authenticateToken, authorizeRoles(4), async (req, res, next) => {
    try {
        const last = await backupService.getLastBackup();
        res.json({ lastBackup: last || null });
    } catch (err) { next(err); }
});

// list of all backups
router.get('/list', authenticateToken, authorizeRoles(4), async (req, res, next) => {
    try {
        const backups = await backupService.listBackups();
        res.json(backups);
    } catch (err) { next(err); }
});

// create a manual backup
router.post('/manual', authenticateToken, authorizeRoles(4), async (req, res, next) => {
    try {
        const backup = await backupService.createBackup('manual', req);
        res.json({
            message:   'Резервна копія створена успішно',
            timestamp: backup.timestamp,
            name:      backup.name,
        });
    } catch (err) { next(err); }
});

// restore from backup
router.post('/restore', authenticateToken, authorizeRoles(4), async (req, res, next) => {
    try {
        const { name } = req.body;

        if (!name?.trim()) {
            return next(new AppError(ERROR_CODES.VALIDATION_ERROR, 'name is required', 400));
        }

        const result = await backupService.restoreBackup(name.trim(), req);
        res.json(result);
    } catch (err) { next(err); }
});

// delete backup
router.delete('/:name', authenticateToken, authorizeRoles(4), async (req, res, next) => {
    try {
        const name = decodeURIComponent(req.params.name);
        await backupService.deleteBackup(name, req);
        res.status(204).end();
    } catch (err) { next(err); }
});

export const backupRouter = router;