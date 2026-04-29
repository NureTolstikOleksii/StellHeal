import { Router } from 'express';

import authRouter from '../modules/auth/auth.routes.js';
import profileRouter from '../modules/profile/profile.controller.js';
import { medicationRouter } from '../modules/medication/medication.controller.js';
import { mainRouter } from '../modules/patients/patients.controller.js';
import { containerRouter } from '../modules/container/container.controller.js';
import { notificationRouter } from '../modules/notifications/notifications.controller.js';
import wardsRouter from '../modules/wards/wards.controller.js';
import { staffRouter } from '../modules/staff/staff.controller.js';
import { statsRouter } from '../modules/stats/stats.controller.js';
import { backupRouter } from '../modules/backup/backup.controller.js';

const router = Router();

// 🔥 всі маршрути тут
router.use('/auth', authRouter);
router.use('/profile', profileRouter);

router.use('/medication', medicationRouter);
router.use('/patients', mainRouter);
router.use('/wards', wardsRouter);
router.use('/containers', containerRouter);


router.use('/notification', notificationRouter);
router.use('/staff', staffRouter);
router.use('/stats', statsRouter);
router.use('/backup', backupRouter);

export default router;