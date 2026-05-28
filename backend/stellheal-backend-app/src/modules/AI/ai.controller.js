import { Router } from 'express';
import { AiService } from './ai.service.js';
import { authenticateToken } from '../../middleware/auth.middleware.js';
import { authorizeRoles } from '../../middleware/role.middleware.js';
import { AppError } from '../../shared/errors/AppError.js';
import { ERROR_CODES } from '../../shared/constants/errorCodes.js';

const router = Router();
const aiService = new AiService();

router.post(
    '/recommend',
    authenticateToken,
    authorizeRoles(1, 4),
    async (req, res, next) => {
        try {
            const { type, payload } = req.body;

            if (!type || !payload) {
                return next(new AppError(
                    ERROR_CODES.VALIDATION_ERROR,
                    'Потрібно передати type та payload',
                    400
                ));
            }

            await aiService.streamRecommendation(type, payload, res);

        } catch (err) {
            if (!res.headersSent) next(err);
            else res.end();
        }
    }
);

export const aiRouter = router;