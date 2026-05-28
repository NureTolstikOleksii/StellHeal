import prisma from '../../config/prisma.js';
import { AppError } from '../../shared/errors/AppError.js';
import { ERROR_CODES } from '../../shared/constants/errorCodes.js';
import { logAction } from '../../shared/logger/auditLogger.js';
import { ACTIONS } from '../../shared/constants/actions.js';

export class WardsService {

    // ── Всі палати з кількістю активних пацієнтів ────────────────────────────
    async getAllWards() {
        const wards = await prisma.wards.findMany({
            orderBy: { ward_number: 'asc' },
            include: {
                prescriptions: {
                    where: { end_date: { gte: new Date() } },
                    select: { prescription_id: true }
                }
            }
        });

        return wards.map(w => ({
            ward_id:         w.ward_id,
            ward_number:     w.ward_number,
            capacity:        w.capacity,
            is_blocked:      w.is_blocked || false,
            active_patients: w.prescriptions.length,
            is_full:         w.prescriptions.length >= (w.capacity || 0),
        }));
    }

    // ── Вільні палати для лікаря (без заблокованих) ───────────────────────────
    async getAvailableWards() {
        const wards = await prisma.wards.findMany({
            where: { is_blocked: { not: true } },
            select: {
                ward_id:     true,
                ward_number: true,
                capacity:    true,
                prescriptions: {
                    where: { end_date: { gte: new Date() } },
                    select: { prescription_id: true }
                }
            }
        });

        return wards
            .filter(w => w.prescriptions.length < (w.capacity || 0))
            .map(w => ({ id: w.ward_id, number: w.ward_number }));
    }

    // ── Створити палату ───────────────────────────────────────────────────────
    async createWard(data, req) {
        const { ward_number, capacity } = data;

        if (!ward_number?.trim()) {
            throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'ward_number is required', 400);
        }

        const existing = await prisma.wards.findFirst({
            where: { ward_number: ward_number.trim() }
        });
        if (existing) {
            throw new AppError(ERROR_CODES.CONFLICT, 'Палата з таким номером вже існує', 409);
        }

        const ward = await prisma.wards.create({
            data: {
                ward_number: ward_number.trim(),
                capacity:    capacity ? Number(capacity) : null,
                is_blocked:  false,
            }
        });

        await logAction({
            userId:      req.user.userId,
            action:      ACTIONS.SECURITY_EVENT,
            entity:      'WARD',
            entityId:    ward.ward_id,
            description: `Ward created: ${ward_number}`,
            req
        });

        return ward;
    }

    // ── Оновити палату ────────────────────────────────────────────────────────
    async updateWard(wardId, data, req) {
        const { ward_number, capacity } = data;

        const existing = await prisma.wards.findUnique({ where: { ward_id: wardId } });
        if (!existing) {
            throw new AppError(ERROR_CODES.NOT_FOUND, 'Палату не знайдено', 404);
        }

        if (ward_number?.trim()) {
            const duplicate = await prisma.wards.findFirst({
                where: { ward_number: ward_number.trim(), NOT: { ward_id: wardId } }
            });
            if (duplicate) {
                throw new AppError(ERROR_CODES.CONFLICT, 'Палата з таким номером вже існує', 409);
            }
        }

        const ward = await prisma.wards.update({
            where: { ward_id: wardId },
            data: {
                ward_number: ward_number?.trim() || existing.ward_number,
                capacity:    capacity !== undefined ? Number(capacity) : existing.capacity,
            }
        });

        await logAction({
            userId:      req.user.userId,
            action:      ACTIONS.SECURITY_EVENT,
            entity:      'WARD',
            entityId:    wardId,
            description: `Ward updated: ${ward.ward_number}`,
            req
        });

        return ward;
    }

    // ── Заблокувати палату ────────────────────────────────────────────────────
    async blockWard(wardId, req) {
        const ward = await prisma.wards.findUnique({ where: { ward_id: wardId } });
        if (!ward) throw new AppError(ERROR_CODES.NOT_FOUND, 'Палату не знайдено', 404);

        const updated = await prisma.wards.update({
            where: { ward_id: wardId },
            data:  { is_blocked: true }
        });

        await logAction({
            userId:      req.user.userId,
            action:      ACTIONS.SECURITY_EVENT,
            entity:      'WARD',
            entityId:    wardId,
            description: `Ward blocked: ${ward.ward_number}`,
            req
        });

        return updated;
    }

    // ── Розблокувати палату ───────────────────────────────────────────────────
    async unblockWard(wardId, req) {
        const ward = await prisma.wards.findUnique({ where: { ward_id: wardId } });
        if (!ward) throw new AppError(ERROR_CODES.NOT_FOUND, 'Палату не знайдено', 404);

        const updated = await prisma.wards.update({
            where: { ward_id: wardId },
            data:  { is_blocked: false }
        });

        await logAction({
            userId:      req.user.userId,
            action:      ACTIONS.SECURITY_EVENT,
            entity:      'WARD',
            entityId:    wardId,
            description: `Ward unblocked: ${ward.ward_number}`,
            req
        });

        return updated;
    }

    // ── Видалити палату ───────────────────────────────────────────────────────
    async deleteWard(wardId, req) {
        const ward = await prisma.wards.findUnique({ where: { ward_id: wardId } });
        if (!ward) throw new AppError(ERROR_CODES.NOT_FOUND, 'Палату не знайдено', 404);

        const activeCount = await prisma.prescriptions.count({
            where: { ward_id: wardId, end_date: { gte: new Date() } }
        });
        if (activeCount > 0) {
            throw new AppError(
                ERROR_CODES.CONFLICT,
                `Неможливо видалити палату: ${activeCount} активних пацієнтів`,
                409
            );
        }

        await prisma.wards.delete({ where: { ward_id: wardId } });

        await logAction({
            userId:      req.user.userId,
            action:      ACTIONS.SECURITY_EVENT,
            entity:      'WARD',
            entityId:    wardId,
            description: `Ward deleted: ${ward.ward_number}`,
            req
        });
    }

    // ── Пацієнти палати ───────────────────────────────────────────────────────
    async getWardPatients(wardId) {
        const ward = await prisma.wards.findUnique({ where: { ward_id: wardId } });
        if (!ward) throw new AppError(ERROR_CODES.NOT_FOUND, 'Палату не знайдено', 404);

        const prescriptions = await prisma.prescriptions.findMany({
            where: { ward_id: wardId, end_date: { gte: new Date() } },
            include: {
                users_prescriptions_patient_idTousers: {
                    select: { first_name: true, last_name: true, patronymic: true, avatar: true }
                },
                users_prescriptions_doctor_idTousers: {
                    select: { first_name: true, last_name: true }
                }
            },
            orderBy: { end_date: 'asc' },
        });

        return prescriptions.map(p => ({
            prescription_id:    p.prescription_id,
            diagnosis:          p.diagnosis,
            icd_code:           p.icd_code,
            end_date:           p.end_date,
            patient_first_name: p.users_prescriptions_patient_idTousers?.first_name,
            patient_last_name:  p.users_prescriptions_patient_idTousers?.last_name,
            patient_patronymic: p.users_prescriptions_patient_idTousers?.patronymic,
            patient_avatar:     p.users_prescriptions_patient_idTousers?.avatar || null,
            doctor_name:        p.users_prescriptions_doctor_idTousers
                ? `${p.users_prescriptions_doctor_idTousers.last_name} ${p.users_prescriptions_doctor_idTousers.first_name}`
                : null,
        }));
    }
}