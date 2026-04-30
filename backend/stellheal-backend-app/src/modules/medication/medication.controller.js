import { Router } from 'express';
import { MedicationService } from './medication.service.js';

import { authenticateToken } from '../../middleware/auth.middleware.js';
import { authorizeRoles } from '../../middleware/role.middleware.js';
import { AppError } from '../../shared/errors/AppError.js';
import { ERROR_CODES } from '../../shared/constants/errorCodes.js';

const router = Router();
const medicationService = new MedicationService();

// список препаратів ok
router.get(
    '/',
    authenticateToken,
    authorizeRoles(1, 2, 4), // admin, doctor, staff
    async (req, res, next) => {
        try {
            const medications = await medicationService.getAll();
            res.json(medications);
        } catch (err) {
            next(err);
        }
    }
);

// додавання препарату
router.post(
    '/add',
    authenticateToken,
    authorizeRoles(1, 2), // admin + doctor
    async (req, res, next) => {
        try {
            const {
                medication_name,
                medication_type,
                description,
                quantity,
                manufacturer,
                expiration_date
            } = req.body;

            if (!medication_name || !medication_type || !description) {
                return next(new AppError(
                    ERROR_CODES.VALIDATION_ERROR,
                    'All required fields must be provided',
                    400
                ));
            }

            const newMedication = await medicationService.addMedication(
                {
                    medication_name,
                    medication_type,
                    description,
                    quantity,
                    manufacturer,
                    expiration_date
                },
                req
            );

            res.status(201).json({
                message: 'The medication has been added successfully',
                medication: newMedication
            });

        } catch (err) {
            next(err);
        }
    }
);

// видалення
router.delete(
    '/delete/:id',
    authenticateToken,
    authorizeRoles(1), // тільки admin
    async (req, res, next) => {
        try {
            const id = Number(req.params.id);

            if (!id) {
                return next(new AppError(
                    ERROR_CODES.VALIDATION_ERROR,
                    'Medication ID is required',
                    400
                ));
            }

            const deleted = await medicationService.deleteMedication(id, req);

            res.json({
                message: 'Medication has been successfully deleted',
                medication: deleted
            });

        } catch (err) {
            next(err);
        }
    }
);

// оновлення кількості
router.put(
    '/update-quantity/:id',
    authenticateToken,
    authorizeRoles(1, 2),
    async (req, res, next) => {
        try {
            const id = Number(req.params.id);
            const { quantity } = req.body;

            if (!id || quantity === undefined) {
                return next(new AppError(
                    ERROR_CODES.VALIDATION_ERROR,
                    'Medication ID and quantity are required',
                    400
                ));
            }

            const updated = await medicationService.updateMedicationQuantity(id, quantity, req);

            res.json({
                message: 'Medication quantity has been successfully updated',
                medication: updated
            });

        } catch (err) {
            next(err);
        }
    }
);

export const medicationRouter = router;