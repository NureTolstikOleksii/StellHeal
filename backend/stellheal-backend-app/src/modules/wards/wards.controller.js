import { Router } from 'express';
import { WardsService } from './wards.service.js';

import { authenticateToken } from '../../middleware/auth.middleware.js';
import { authorizeRoles } from '../../middleware/role.middleware.js';

const router = Router();
const wardsService = new WardsService();

// ok
router.get(
    '/',
    authenticateToken,
    authorizeRoles(1, 2),
    async (req, res, next) => {
        try {
            const wards = await wardsService.getAvailableWards();
            res.json(wards);
        } catch (err) {
            next(err);
        }
    }
);

export default router;