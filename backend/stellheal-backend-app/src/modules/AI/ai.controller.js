import { Router } from 'express';
import { AiService } from './ai.service.js';
import { authenticateToken } from '../../middleware/auth.middleware.js';
import { authorizeRoles } from '../../middleware/role.middleware.js';
import { AppError } from '../../shared/errors/AppError.js';
import { ERROR_CODES } from '../../shared/constants/errorCodes.js';
import prisma from "../../config/prisma.js";

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

            if (payload.patientId) {
                const numericPatientId = Number(payload.patientId);

                if (isNaN(numericPatientId)) {
                    return next(new AppError(
                        ERROR_CODES.VALIDATION_ERROR,
                        'Некоректний ID пацієнта (має бути числом)',
                        400
                    ));
                }

                const medicalHistory = await prisma.prescriptions.findMany({
                    where:   { patient_id: numericPatientId }, // Передаємо вже число
                    select:  { diagnosis: true, date_issued: true },
                    orderBy: { date_issued: 'desc' },
                    take:    5
                });

                payload.medicalHistory = medicalHistory
                    .map(p => `${p.diagnosis} (${p.date_issued?.toISOString().substring(0, 10)})`)
                    .join(', ');
            }

            await aiService.streamRecommendation(type, payload, res);

        } catch (err) {
            if (!res.headersSent) next(err);
            else res.end();
        }
    }
);
export const aiRouter = router;