import { Router } from 'express';
import { StatsService } from './stats.service.js';

import { authenticateToken } from '../../middleware/auth.middleware.js';
import { authorizeRoles } from '../../middleware/role.middleware.js';

const router = Router();
const statsService = new StatsService();

// статистика клініки
router.get(
    '/clinic',
    authenticateToken,
    authorizeRoles(4), // admin
    async (req, res, next) => {
        try {
            const data = await statsService.getClinicStats();
            res.json(data);
        } catch (err) {
            next(err);
        }
    }
);

// статистика лікарів
router.get(
    '/doctors',
    authenticateToken,
    authorizeRoles(4), // admin
    async (req, res, next) => {
        try {
            const data = await statsService.getDoctorStats();
            res.json(data);
        } catch (err) {
            next(err);
        }
    }
);

export const statsRouter = router;