import { describe, it, expect, vi, beforeEach } from 'vitest';


const { viPrismaMock } = vi.hoisted(() => {
    return {
        viPrismaMock: {
            wards: {
                findMany:   vi.fn(),
                findFirst:  vi.fn(),
                findUnique: vi.fn(),
                create:     vi.fn(),
                update:     vi.fn(),
                delete:     vi.fn(),
            },
            prescriptions: {
                count:    vi.fn(),
                findMany: vi.fn(),
            }
        }
    };
});

vi.mock('../../src/config/prisma.js', () => ({ default: viPrismaMock }));
vi.mock('../../src/shared/logger/auditLogger.js', () => ({ logAction: vi.fn() }));
vi.mock('../../src/shared/constants/actions.js', () => ({ ACTIONS: { SECURITY_EVENT: 'SECURITY_EVENT' } }));

vi.mock('../../src/shared/errors/AppError.js', () => ({
    AppError: class AppError extends Error {
        constructor(code, message, status) {
            super(message);
            this.code = code;
            this.status = status;
        }
    }
}));

vi.mock('../../src/shared/constants/errorCodes.js', () => ({
    ERROR_CODES: {
        VALIDATION_ERROR: 'VALIDATION_ERROR',
        CONFLICT:         'CONFLICT',
        NOT_FOUND:        'NOT_FOUND',
    }
}));

const { WardsService } = await import('../../src/modules/wards/wards.service.js');

const makeReq = (userId = 1) => ({
    user: { userId }
});

let service;

beforeEach(() => {
    vi.clearAllMocks();
    service = new WardsService();
});

describe('getAllWards', () => {
    it('should map and return all wards with active patient counts and full status', async () => {
        viPrismaMock.wards.findMany.mockResolvedValue([
            { ward_id: 1, ward_number: '101', capacity: 2, is_blocked: false, prescriptions: [{ prescription_id: 1 }] },
            { ward_id: 2, ward_number: '102', capacity: 1, is_blocked: true, prescriptions: [{ prescription_id: 2 }] }
        ]);

        const result = await service.getAllWards();

        expect(result).toHaveLength(2);
        expect(result[0]).toEqual({
            ward_id: 1,
            ward_number: '101',
            capacity: 2,
            is_blocked: false,
            active_patients: 1,
            is_full: false
        });
        expect(result[1]).toEqual({
            ward_id: 2,
            ward_number: '102',
            capacity: 1,
            is_blocked: true,
            active_patients: 1,
            is_full: true
        });
    });
});

describe('getAvailableWards', () => {
    it('should filter out full wards and return only available ones', async () => {
        viPrismaMock.wards.findMany.mockResolvedValue([
            { ward_id: 1, ward_number: '101', capacity: 2, prescriptions: [] },
            { ward_id: 2, ward_number: '102', capacity: 1, prescriptions: [{ prescription_id: 1 }] }
        ]);

        const result = await service.getAvailableWards();

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({ id: 1, number: '101' });
    });
});

describe('createWard', () => {
    it('should throw 400 if ward_number is missing or empty string', async () => {
        await expect(service.createWard({ ward_number: '   ' }, makeReq()))
            .rejects.toMatchObject({ status: 400, code: 'VALIDATION_ERROR' });
    });

    it('should throw 409 if ward_number already exists', async () => {
        viPrismaMock.wards.findFirst.mockResolvedValue({ ward_id: 1, ward_number: '101' });

        await expect(service.createWard({ ward_number: '101' }, makeReq()))
            .rejects.toMatchObject({ status: 409, code: 'CONFLICT' });
    });

    it('should successfully create a ward and trim its number', async () => {
        viPrismaMock.wards.findFirst.mockResolvedValue(null);
        viPrismaMock.wards.create.mockResolvedValue({ ward_id: 10, ward_number: '105', capacity: 4 });

        const result = await service.createWard({ ward_number: ' 105 ', capacity: '4' }, makeReq());

        expect(viPrismaMock.wards.create).toHaveBeenCalledWith({
            data: { ward_number: '105', capacity: 4, is_blocked: false }
        });
        expect(result.ward_id).toBe(10);
    });
});

describe('updateWard', () => {
    it('should throw 404 if ward to update is not found', async () => {
        viPrismaMock.wards.findUnique.mockResolvedValue(null);

        await expect(service.updateWard(999, { ward_number: '102' }, makeReq()))
            .rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' });
    });

    it('should throw 409 if new ward_number belongs to another ward', async () => {
        viPrismaMock.wards.findUnique.mockResolvedValue({ ward_id: 1, ward_number: '101' });
        viPrismaMock.wards.findFirst.mockResolvedValue({ ward_id: 2, ward_number: '102' });

        await expect(service.updateWard(1, { ward_number: '102' }, makeReq()))
            .rejects.toMatchObject({ status: 409, code: 'CONFLICT' });
    });

    it('should update ward successfully using existing values if fields are missing', async () => {
        const existingWard = { ward_id: 1, ward_number: '101', capacity: 3 };
        viPrismaMock.wards.findUnique.mockResolvedValue(existingWard);
        viPrismaMock.wards.update.mockResolvedValue({ ...existingWard, capacity: 5 });

        const result = await service.updateWard(1, { capacity: 5 }, makeReq());

        expect(viPrismaMock.wards.update).toHaveBeenCalledWith({
            where: { ward_id: 1 },
            data: { ward_number: '101', capacity: 5 }
        });
        expect(result.capacity).toBe(5);
    });
});

describe('block / unblock Ward', () => {
    it('should throw 404 on blockWard if ward does not exist', async () => {
        viPrismaMock.wards.findUnique.mockResolvedValue(null);
        await expect(service.blockWard(999, makeReq()))
            .rejects.toMatchObject({ status: 404 });
    });

    it('should block ward successfully', async () => {
        viPrismaMock.wards.findUnique.mockResolvedValue({ ward_id: 1, ward_number: '101' });
        viPrismaMock.wards.update.mockResolvedValue({ ward_id: 1, is_blocked: true });

        const result = await service.blockWard(1, makeReq());
        expect(viPrismaMock.wards.update).toHaveBeenCalledWith({
            where: { ward_id: 1 },
            data: { is_blocked: true }
        });
        expect(result.is_blocked).toBe(true);
    });

    it('should unblock ward successfully', async () => {
        viPrismaMock.wards.findUnique.mockResolvedValue({ ward_id: 1, ward_number: '101' });
        viPrismaMock.wards.update.mockResolvedValue({ ward_id: 1, is_blocked: false });

        const result = await service.unblockWard(1, makeReq());
        expect(viPrismaMock.wards.update).toHaveBeenCalledWith({
            where: { ward_id: 1 },
            data: { is_blocked: false }
        });
        expect(result.is_blocked).toBe(false);
    });
});

describe('deleteWard', () => {
    it('should throw 409 if ward has active patients', async () => {
        viPrismaMock.wards.findUnique.mockResolvedValue({ ward_id: 1, ward_number: '101' });
        viPrismaMock.prescriptions.count.mockResolvedValue(2);

        await expect(service.deleteWard(1, makeReq()))
            .rejects.toMatchObject({ status: 409, code: 'CONFLICT' });
        expect(viPrismaMock.wards.delete).not.toHaveBeenCalled();
    });

    it('should delete ward if there are no active patients', async () => {
        viPrismaMock.wards.findUnique.mockResolvedValue({ ward_id: 1, ward_number: '101' });
        viPrismaMock.prescriptions.count.mockResolvedValue(0);

        await service.deleteWard(1, makeReq());

        expect(viPrismaMock.wards.delete).toHaveBeenCalledWith({ where: { ward_id: 1 } });
    });
});

describe('getWardPatients', () => {
    it('should return mapped array of active patients inside the ward', async () => {
        viPrismaMock.wards.findUnique.mockResolvedValue({ ward_id: 1 });
        viPrismaMock.prescriptions.findMany.mockResolvedValue([
            {
                prescription_id: 10,
                diagnosis: 'Flu',
                icd_code: 'J11',
                end_date: new Date('2026-12-31'),
                users_prescriptions_patient_idTousers: {
                    first_name: 'John', last_name: 'Doe', patronymic: 'Smith', avatar: 'avatar.png'
                },
                users_prescriptions_doctor_idTousers: {
                    first_name: 'House', last_name: 'Gregory'
                }
            }
        ]);

        const result = await service.getWardPatients(1);

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({
            prescription_id: 10,
            diagnosis: 'Flu',
            icd_code: 'J11',
            end_date: '2026-12-31T00:00:00.000Z',
            patient_first_name: 'John',
            patient_last_name: 'Doe',
            patient_patronymic: 'Smith',
            patient_avatar: 'avatar.png',
            doctor_name: 'Gregory House'
        });
    });
});

it('creates ward with null capacity when not provided', async () => {
    viPrismaMock.wards.findFirst.mockResolvedValue(null);
    viPrismaMock.wards.create.mockResolvedValue({ ward_id: 11, ward_number: '106', capacity: null });
    await service.createWard({ ward_number: '106' }, makeReq());
    const call = viPrismaMock.wards.create.mock.calls[0][0];
    expect(call.data.capacity).toBeNull();
});

it('keeps existing ward_number when not provided', async () => {
    const existingWard = { ward_id: 1, ward_number: '101', capacity: 3 };
    viPrismaMock.wards.findUnique.mockResolvedValue(existingWard);
    viPrismaMock.wards.update.mockResolvedValue(existingWard);
    await service.updateWard(1, { capacity: 4 }, makeReq());
    const call = viPrismaMock.wards.update.mock.calls[0][0];
    expect(call.data.ward_number).toBe('101');
});

it('throws 404 on unblockWard if ward does not exist', async () => {
    viPrismaMock.wards.findUnique.mockResolvedValue(null);
    await expect(service.unblockWard(999, makeReq()))
        .rejects.toMatchObject({ status: 404 });
});

it('throws 404 if ward does not exist', async () => {
    viPrismaMock.wards.findUnique.mockResolvedValue(null);
    await expect(service.deleteWard(999, makeReq()))
        .rejects.toMatchObject({ status: 404 });
});

it('throws 404 if ward not found', async () => {
    viPrismaMock.wards.findUnique.mockResolvedValue(null);
    await expect(service.getWardPatients(999))
        .rejects.toMatchObject({ status: 404 });
});

it('returns empty array when no active patients', async () => {
    viPrismaMock.wards.findUnique.mockResolvedValue({ ward_id: 1 });
    viPrismaMock.prescriptions.findMany.mockResolvedValue([]);
    expect(await service.getWardPatients(1)).toEqual([]);
});