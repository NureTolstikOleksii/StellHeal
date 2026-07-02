import { describe, it, expect, vi, beforeEach } from 'vitest';


const prismaMock = {
    containers: {
        findMany:   vi.fn(),
        findUnique: vi.fn(),
        findFirst:  vi.fn(),
        create:     vi.fn(),
        update:     vi.fn(),
        delete:     vi.fn(),
        count:      vi.fn(),
    },
    compartments: {
        findMany: vi.fn(),
    },
    compartment_medications: {
        findMany: vi.fn(),
    },
    prescription_medications: {
        findMany: vi.fn(),
    },
    prescriptions: {
        aggregate: vi.fn(),
    },
    device_events: {
        findMany: vi.fn(),
    },
    fill_sessions: {
        findMany: vi.fn(),
    },
    audit_logs: { create: vi.fn() },
};

vi.mock('../../src/config/prisma.js',                                   () => ({ default: prismaMock }));
vi.mock('../../src/shared/logger/auditLogger.js',                        () => ({ logAction: vi.fn() }));
vi.mock('../../src/shared/constants/actions.js',                         () => ({ ACTIONS: { UPDATE: 'UPDATE', CREATE_STAFF: 'CREATE_STAFF', EXPORT_CONTAINERS: 'EXPORT_CONTAINERS', SECURITY_EVENT: 'SECURITY_EVENT' } }));
vi.mock('../../src/integrations/reports/containerExcel.service.js',      () => ({ generateContainerExcel: vi.fn().mockResolvedValue(Buffer.from('')) }));
vi.mock('../../src/shared/errors/AppError.js', () => ({
    AppError: class AppError extends Error {
        constructor(code, message, status) { super(message); this.code = code; this.status = status; }
    }
}));
vi.mock('../../src/shared/constants/errorCodes.js', () => ({
    ERROR_CODES: {
        NOT_FOUND:        'NOT_FOUND',
        CONFLICT:         'CONFLICT',
        VALIDATION_ERROR: 'VALIDATION_ERROR',
    }
}));
vi.mock('nanoid', () => ({ nanoid: vi.fn().mockReturnValue('mock-secret-32-chars-long-nanoid') }));

const { ContainerService } = await import('../../src/modules/container/container.service.js');

const makeReq = (user = { userId: 1 }) => ({
    user, headers: { 'user-agent': 'test' }, ip: '127.0.0.1'
});

const makeContainer = (o = {}) => ({
    container_id:     1,
    container_number: 1,
    device_uid:       'esp32_uid_1',
    device_secret:    'secret',
    status:           'active',
    is_online:        false,
    patient_id:       null,
    last_seen:        null,
    users:            null,
    compartments:     [],
    ...o
});

const makeCompartment = (num, filled = false, medName = null, quantity = null, intakeAt = null) => ({
    compartment_id:     num,
    compartment_number: num,
    is_filled:          filled,
    compartment_medications: filled ? [{
        fill_time: new Date(),
        prescription_medications: {
            medication_name: medName,
            quantity,
            intake_at: intakeAt ? { toISOString: () => intakeAt } : null,
        }
    }] : [],
});

let service;
beforeEach(() => { vi.clearAllMocks(); service = new ContainerService(); });


describe('getAllContainers', () => {

    it('returns list of containers', async () => {
        prismaMock.containers.findMany.mockResolvedValue([makeContainer(), makeContainer({ container_id: 2, container_number: 2 })]);
        const result = await service.getAllContainers();
        expect(result).toHaveLength(2);
    });

    it('returns empty array when no containers', async () => {
        prismaMock.containers.findMany.mockResolvedValue([]);
        expect(await service.getAllContainers()).toEqual([]);
    });
});

describe('getContainerStats', () => {

    it('returns active and inactive counts', async () => {
        prismaMock.containers.count
            .mockResolvedValueOnce(3)
            .mockResolvedValueOnce(2);
        const result = await service.getContainerStats();
        expect(result).toEqual({ activeCount: 3, inactiveCount: 2 });
    });
});

describe('registerContainer', () => {

    it('throws 409 if container with UID already exists', async () => {
        prismaMock.containers.findUnique.mockResolvedValue(makeContainer());
        await expect(service.registerContainer('esp32_uid_1', makeReq()))
            .rejects.toMatchObject({ status: 409 });
    });

    it('creates container with auto-incremented number', async () => {
        prismaMock.containers.findUnique.mockResolvedValue(null);
        prismaMock.containers.findFirst.mockResolvedValue({ container_number: 5 });
        prismaMock.containers.create.mockResolvedValue(makeContainer({ container_number: 6 }));

        const result = await service.registerContainer('new_uid', makeReq());
        const createCall = prismaMock.containers.create.mock.calls[0][0];
        expect(createCall.data.container_number).toBe(6);
        expect(createCall.data.status).toBe('inactive');
    });

    it('starts from 1 when no containers exist', async () => {
        prismaMock.containers.findUnique.mockResolvedValue(null);
        prismaMock.containers.findFirst.mockResolvedValue(null);
        prismaMock.containers.create.mockResolvedValue(makeContainer({ container_number: 1 }));

        await service.registerContainer('first_uid', makeReq());
        const createCall = prismaMock.containers.create.mock.calls[0][0];
        expect(createCall.data.container_number).toBe(1);
    });
});

describe('deleteContainer', () => {

    it('throws 404 if container not found', async () => {
        prismaMock.containers.findUnique.mockResolvedValue(null);
        await expect(service.deleteContainer(999, makeReq()))
            .rejects.toMatchObject({ status: 404 });
    });

    it('throws 409 if container is online', async () => {
        prismaMock.containers.findUnique.mockResolvedValue(makeContainer({ is_online: true }));
        await expect(service.deleteContainer(1, makeReq()))
            .rejects.toMatchObject({ status: 409 });
    });

    it('deletes offline container successfully', async () => {
        prismaMock.containers.findUnique.mockResolvedValue(makeContainer({ is_online: false }));
        prismaMock.containers.delete.mockResolvedValue({});

        await service.deleteContainer(1, makeReq());
        expect(prismaMock.containers.delete).toHaveBeenCalledWith({ where: { container_id: 1 } });
    });
});

describe('assignPatientToContainer', () => {

    it('throws 404 if container not found', async () => {
        prismaMock.containers.findUnique.mockResolvedValue(null);
        await expect(service.assignPatientToContainer(999, 1, makeReq()))
            .rejects.toMatchObject({ status: 404 });
    });

    it('throws 400 if container already has a patient', async () => {
        prismaMock.containers.findUnique.mockResolvedValue(makeContainer({ patient_id: 5 }));
        await expect(service.assignPatientToContainer(1, 2, makeReq()))
            .rejects.toMatchObject({ status: 400 });
    });

    it('assigns patient to free container', async () => {
        prismaMock.containers.findUnique.mockResolvedValue(makeContainer({ patient_id: null }));
        prismaMock.containers.update.mockResolvedValue(makeContainer({ patient_id: 3 }));

        const result = await service.assignPatientToContainer(1, 3, makeReq());
        expect(prismaMock.containers.update).toHaveBeenCalledWith({
            where: { container_id: 1 },
            data:  { patient_id: 3 },
        });
    });
});

describe('unassignContainer', () => {

    it('throws 404 if container not found', async () => {
        prismaMock.containers.findUnique.mockResolvedValue(null);
        await expect(service.unassignContainer(999, 1, makeReq()))
            .rejects.toMatchObject({ status: 404 });
    });

    it('throws 400 if container belongs to different patient', async () => {
        prismaMock.containers.findUnique.mockResolvedValue(makeContainer({ patient_id: 5 }));
        await expect(service.unassignContainer(1, 99, makeReq()))
            .rejects.toMatchObject({ status: 400 });
    });

    it('unassigns container from correct patient', async () => {
        prismaMock.containers.findUnique.mockResolvedValue(makeContainer({ patient_id: 3 }));
        prismaMock.containers.update.mockResolvedValue(makeContainer({ patient_id: null }));

        await service.unassignContainer(1, 3, makeReq());
        expect(prismaMock.containers.update).toHaveBeenCalledWith({
            where: { container_id: 1 },
            data:  { patient_id: null },
        });
    });
});

describe('getContainerDetails', () => {

    it('throws 404 if container not found', async () => {
        prismaMock.containers.findUnique.mockResolvedValue(null);
        await expect(service.getContainerDetails(999))
            .rejects.toMatchObject({ status: 404, message: 'Container not found' });
    });

    it('returns is_online=false when last_seen is null', async () => {
        prismaMock.containers.findUnique.mockResolvedValue(makeContainer({ last_seen: null, compartments: [] }));
        const result = await service.getContainerDetails(1);
        expect(result.is_online).toBe(false);
    });

    it('returns is_online=true when last_seen within 2 minutes', async () => {
        const recentDate = new Date(Date.now() - 30 * 1000); // 30 seconds ago
        prismaMock.containers.findUnique.mockResolvedValue(makeContainer({
            last_seen:    recentDate,
            compartments: [],
        }));
        const result = await service.getContainerDetails(1);
        expect(result.is_online).toBe(true);
    });

    it('returns is_online=false when last_seen older than 2 minutes', async () => {
        const oldDate = new Date(Date.now() - 5 * 60 * 1000);
        prismaMock.containers.findUnique.mockResolvedValue(makeContainer({
            last_seen:    oldDate,
            compartments: [],
        }));
        const result = await service.getContainerDetails(1);
        expect(result.is_online).toBe(false);
    });

    it('returns compartments with medication info when filled', async () => {
        prismaMock.containers.findUnique.mockResolvedValue(makeContainer({
            compartments: [
                makeCompartment(1, true, 'Aspirin', 2, '2026-06-01T08:00:00.000Z'),
                makeCompartment(2, false),
            ]
        }));

        const result = await service.getContainerDetails(1);
        expect(result.compartments[0].is_filled).toBe(true);
        expect(result.compartments[0].medication_name).toBe('Aspirin');
        expect(result.compartments[1].is_filled).toBe(false);
        expect(result.compartments[1].medication_name).toBeNull();
    });
});

describe('getAllContainerDetails', () => {

    it('returns empty array when no containers', async () => {
        prismaMock.containers.findMany.mockResolvedValue([]);
        expect(await service.getAllContainerDetails()).toEqual([]);
    });

    it('correctly calculates is_online for each container', async () => {
        const recentDate = new Date(Date.now() - 30 * 1000);
        const oldDate    = new Date(Date.now() - 10 * 60 * 1000);

        prismaMock.containers.findMany.mockResolvedValue([
            makeContainer({ container_id: 1, last_seen: recentDate, compartments: [] }),
            makeContainer({ container_id: 2, last_seen: oldDate,    compartments: [] }),
        ]);

        const result = await service.getAllContainerDetails();
        expect(result[0].is_online).toBe(true);
        expect(result[1].is_online).toBe(false);
    });
});

describe('getPrescriptionDateRange', () => {

    it('throws 404 when no active prescriptions', async () => {
        prismaMock.prescriptions.aggregate.mockResolvedValue({
            _min: { date_issued: null },
            _max: { end_date: null },
        });
        await expect(service.getPrescriptionDateRange(1))
            .rejects.toMatchObject({ status: 404, message: 'No prescriptions found' });
    });

    it('returns formatted date range', async () => {
        prismaMock.prescriptions.aggregate.mockResolvedValue({
            _min: { date_issued: new Date('2026-06-01T00:00:00.000Z') },
            _max: { end_date:    new Date('2026-06-15T00:00:00.000Z') },
        });

        const result = await service.getPrescriptionDateRange(1);
        expect(result.minDate).toBe('2026-06-01');
        expect(result.maxDate).toBe('2026-06-15');
    });
});

describe('getIntakeStatistics', () => {

    it('returns empty array when no medications', async () => {
        prismaMock.prescription_medications.findMany.mockResolvedValue([]);
        const result = await service.getIntakeStatistics(1, '2026-06-01');
        expect(result).toEqual([]);
    });

    it('returns medications with correct shape', async () => {
        prismaMock.prescription_medications.findMany.mockResolvedValue([{
            prescription_med_id: 1,
            medication_name:     'Aspirin',
            quantity:            2,
            intake_at:           { toISOString: () => '2026-06-01T08:00:00.000Z' },
            intake_status:       true,
            medications:         null,
        }]);

        const result = await service.getIntakeStatistics(1, '2026-06-01');
        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
            prescription_med_id: 1,
            medication:          'Aspirin',
            quantity:            2,
            isTaken:             true,
        });
        expect(result[0].intake_at).toBe('2026-06-01T08:00:00.000Z');
    });

    it('prefers medications.name over medication_name', async () => {
        prismaMock.prescription_medications.findMany.mockResolvedValue([{
            prescription_med_id: 1,
            medication_name:     'Aspirin',
            quantity:            1,
            intake_at:           { toISOString: () => '2026-06-01T08:00:00.000Z' },
            intake_status:       null,
            medications:         { name: 'Aspirin 500mg' },
        }]);

        const result = await service.getIntakeStatistics(1, '2026-06-01');
        expect(result[0].medication).toBe('Aspirin 500mg');
    });
});

describe('getFreeContainers', () => {

    it('returns only containers without patient', async () => {
        prismaMock.containers.findMany.mockResolvedValue([
            makeContainer({ container_id: 2, patient_id: null }),
        ]);
        const result = await service.getFreeContainers();
        expect(result).toHaveLength(1);
        expect(result[0].patient_id).toBeNull();
    });
});

describe('getContainerEvents', () => {

    it('returns events with ISO created_at', async () => {
        prismaMock.device_events.findMany.mockResolvedValue([{
            id:           1,
            container_id: 1,
            type:         'info',
            code:         'MOTOR_OK',
            message:      'Test',
            created_at:   new Date('2026-06-01T10:00:00.000Z'),
        }]);

        const result = await service.getContainerEvents(1);
        expect(result[0].created_at).toBe('2026-06-01T10:00:00.000Z');
    });
})