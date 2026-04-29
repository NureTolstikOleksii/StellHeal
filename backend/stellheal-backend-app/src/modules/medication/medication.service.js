import prisma from '../../config/prisma.js';

import { AppError } from '../../shared/errors/AppError.js';
import { ERROR_CODES } from '../../shared/constants/errorCodes.js';
import { logAction } from '../../shared/logger/auditLogger.js';
import { ACTIONS } from '../../shared/constants/actions.js';

export class MedicationService {

    // список
    async getAll() {
        const medications = await prisma.medications.findMany({
            select: {
                medication_id: true,
                name: true
            }
        });

        return medications.map(m => ({
            id: m.medication_id,
            name: m.name
        }));
    }

    // додавання
    async addMedication(data, req) {
        const {
            medication_name,
            medication_type,
            description,
            quantity,
            manufacturer,
            expiration_date
        } = data;

        const quantityInt = Number(quantity);

        if (isNaN(quantityInt)) {
            throw new AppError(
                ERROR_CODES.VALIDATION_ERROR,
                'Quantity must be a valid integer',
                400
            );
        }

        const newMedication = await prisma.medications.create({
            data: {
                name: medication_name,
                type: medication_type,
                description,
                quantity: quantityInt,
                manufacturer,
                expiration_date: expiration_date ? new Date(expiration_date) : null,
            }
        });

        await logAction({
            userId: req.user?.userId,
            action: ACTIONS.CREATE,
            entity: 'MEDICATION',
            entityId: newMedication.medication_id,
            description: 'Medication added',
            req
        });

        return newMedication;
    }

    // видалення
    async deleteMedication(id, req) {

        const medication = await prisma.medications.findUnique({
            where: { medication_id: id }
        });

        if (!medication) {
            throw new AppError(
                ERROR_CODES.NOT_FOUND,
                'Medication not found',
                404
            );
        }

        await prisma.medications.delete({
            where: { medication_id: id }
        });

        await logAction({
            userId: req.user?.userId,
            action: ACTIONS.DELETE,
            entity: 'MEDICATION',
            entityId: id,
            description: 'Medication deleted',
            req
        });

        return medication;
    }

    // оновлення кількості
    async updateMedicationQuantity(id, quantity, req) {

        const quantityInt = Number(quantity);

        if (isNaN(quantityInt) || quantityInt < 0) {
            throw new AppError(
                ERROR_CODES.VALIDATION_ERROR,
                'Quantity must be a valid non-negative integer',
                400
            );
        }

        const medication = await prisma.medications.findUnique({
            where: { medication_id: id }
        });

        if (!medication) {
            throw new AppError(
                ERROR_CODES.NOT_FOUND,
                'Medication not found',
                404
            );
        }

        const updated = await prisma.medications.update({
            where: { medication_id: id },
            data: { quantity: quantityInt }
        });

        await logAction({
            userId: req.user?.userId,
            action: ACTIONS.UPDATE,
            entity: 'MEDICATION',
            entityId: id,
            description: 'Medication quantity updated',
            req
        });

        return updated;
    }
}