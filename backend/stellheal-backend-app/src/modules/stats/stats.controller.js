import { Router } from 'express';
import { StatsService } from './stats.service.js';

import { authenticateToken } from '../../middleware/auth.middleware.js';
import { authorizeRoles } from '../../middleware/role.middleware.js';

const router = Router();
const statsService = new StatsService();

// clinic statistics
router.get('/clinic', authenticateToken, authorizeRoles(4), async (req, res, next) => {
    try {
        res.json(await statsService.getClinicStats());
    } catch (err) { next(err); }
});

// doctor statistics
router.get('/doctors', authenticateToken, authorizeRoles(4), async (req, res, next) => {
    try {
        res.json(await statsService.getDoctorStats());
    } catch (err) { next(err); }
});

// intake week stats
router.get('/intake-week', authenticateToken, authorizeRoles(4), async (req, res, next) => {
    try {
        const weekOffset = Number(req.query.weekOffset) || 0;
        res.json(await statsService.getIntakeWeekStats(weekOffset));
    } catch (err) { next(err); }
});

// audit log
router.get('/audit-log', authenticateToken, authorizeRoles(4), async (req, res, next) => {
    try {
        const limit  = Math.min(Number(req.query.limit)  || 50, 200);
        const page   = Math.max(Number(req.query.page)   || 1,  1);
        const action = req.query.action || null;

        res.json(await statsService.getAuditLog({ limit, action, page }));
    } catch (err) { next(err); }
});

// types of actions for filter
router.get('/audit-actions', authenticateToken, authorizeRoles(4), async (req, res, next) => {
    try {
        res.json(await statsService.getAuditActions());
    } catch (err) { next(err); }
});

export const statsRouter = router;