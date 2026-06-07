import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';

process.env.JWT_SECRET = 'test_secret';

const prismaMock = {
    containers: {
        findFirst:  vi.fn(),
        findUnique: vi.fn(),
        update:     vi.fn(),
    },
    prescription_medications: {
        findFirst:  vi.fn(),
        findUnique: vi.fn(),
        update:     vi.fn(),
    },
    compartment_medications: {
        findFirst: vi.fn(),
        create:    vi.fn(),
        update:    vi.fn(),
        delete:    vi.fn(),
    },
    compartments: {
        findFirst: vi.fn(),
        findMany:  vi.fn(),
        update:    vi.fn(),
    },
    device_commands: {
        findMany: vi.fn(),
        create:   vi.fn(),
        update:   vi.fn(),
    },
    device_events: {
        create: vi.fn(),
    },
    fill_sessions: {
        findFirst:   vi.fn(),
        create:      vi.fn(),
        updateMany:  vi.fn(),
    },
    users: {
        findFirst: vi.fn(),
    },
    audit_logs: { create: vi.fn() },
};

vi.mock('../../src/config/prisma.js',              () => ({ default: prismaMock }));
vi.mock('../../src/shared/logger/auditLogger.js',  () => ({ logAction: vi.fn() }));
vi.mock('../../src/shared/constants/actions.js',   () => ({ ACTIONS: { UPDATE: 'UPDATE' } }));
vi.mock('../../src/shared/errors/AppError.js', () => ({
    AppError: class AppError extends Error {
        constructor(code, message, status) { super(message); this.code = code; this.status = status; }
    }
}));
vi.mock('../../src/shared/constants/errorCodes.js', () => ({
    ERROR_CODES: {
        NOT_FOUND:        'NOT_FOUND',
        UNAUTHORIZED:     'UNAUTHORIZED',
        VALIDATION_ERROR: 'VALIDATION_ERROR',
    }
}));

const { DeviceService } = await import('../../src/modules/container/device.service.js');

const makeContainer = (o = {}) => ({
    container_id:       1,
    container_number:   1,
    device_uid:         'esp32_uid_1',
    device_secret:      'correct_secret',
    status:             'active',
    is_online:          false,
    patient_id:         null,
    rfid_authenticated: false,
    last_seen:          null,
    ...o
});

const makeMed = (o = {}) => ({
    prescription_med_id: 10,
    medication_name:     'Aspirin',
    quantity:            2,
    intake_at:           new Date('2026-06-01T08:00:00.000Z'),
    intake_status:       null,
    ...o
});

const makeCompartment = (o = {}) => ({
    compartment_id:     3,
    compartment_number: 2,
    container_id:       1,
    is_filled:          false,
    last_filled_at:     null,
    ...o
});

let service;
beforeEach(() => {
    vi.clearAllMocks();
    service = new DeviceService();
    prismaMock.device_events.create.mockResolvedValue({});
});


describe('authenticate', () => {

    it('throws 404 if device not found', async () => {
        prismaMock.containers.findFirst.mockResolvedValue(null);
        await expect(service.authenticate('unknown_uid', 'secret'))
            .rejects.toMatchObject({ status: 404, message: 'Device not found' });
    });

    it('throws 401 if secret is incorrect', async () => {
        prismaMock.containers.findFirst.mockResolvedValue(makeContainer());
        prismaMock.containers.update.mockResolvedValue({});
        await expect(service.authenticate('esp32_uid_1', 'wrong_secret'))
            .rejects.toMatchObject({ status: 401, message: 'Invalid device credentials' });
    });

    it('returns token and container_id on success', async () => {
        prismaMock.containers.findFirst.mockResolvedValue(makeContainer());
        prismaMock.containers.update.mockResolvedValue({});

        const result = await service.authenticate('esp32_uid_1', 'correct_secret');
        expect(result.container_id).toBe(1);
        expect(result.token).toBeDefined();

        const decoded = jwt.verify(result.token, 'test_secret');
        expect(decoded.type).toBe('device');
        expect(decoded.containerId).toBe(1);
    });

    it('sets is_online=true and updates last_seen on success', async () => {
        prismaMock.containers.findFirst.mockResolvedValue(makeContainer());
        prismaMock.containers.update.mockResolvedValue({});

        await service.authenticate('esp32_uid_1', 'correct_secret');

        const updateCall = prismaMock.containers.update.mock.calls[0][0];
        expect(updateCall.data.is_online).toBe(true);
        expect(updateCall.data.last_seen).toBeInstanceOf(Date);
    });
});

describe('heartbeat', () => {

    it('updates last_seen and is_online', async () => {
        prismaMock.containers.update.mockResolvedValue({});
        await service.heartbeat(1);
        const call = prismaMock.containers.update.mock.calls[0][0];
        expect(call.data.is_online).toBe(true);
        expect(call.data.last_seen).toBeInstanceOf(Date);
    });

    it('returns server_time as ISO string', async () => {
        prismaMock.containers.update.mockResolvedValue({});
        const result = await service.heartbeat(1);
        expect(result.server_time).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
});

describe('getPendingCommands', () => {

    it('returns pending commands for container', async () => {
        prismaMock.device_commands.findMany.mockResolvedValue([
            { id: 1, command: 'rotate_to', status: 'pending' },
        ]);
        const result = await service.getPendingCommands(1);
        expect(result).toHaveLength(1);
        expect(result[0].command).toBe('rotate_to');
    });

    it('returns empty array when no pending commands', async () => {
        prismaMock.device_commands.findMany.mockResolvedValue([]);
        expect(await service.getPendingCommands(1)).toEqual([]);
    });
});

describe('completeCommand', () => {

    it('marks command as done', async () => {
        prismaMock.device_commands.update.mockResolvedValue({
            id: 1, container_id: 1, command: 'rotate_to'
        });
        const result = await service.completeCommand(1);
        expect(result.message).toBe('Command completed');
        const call = prismaMock.device_commands.update.mock.calls[0][0];
        expect(call.data.status).toBe('done');
        expect(call.data.executed_at).toBeInstanceOf(Date);
    });
});

describe('getNextIntake', () => {

    it('throws 404 if container has no patient', async () => {
        prismaMock.containers.findUnique.mockResolvedValue(makeContainer({ patient_id: null }));
        await expect(service.getNextIntake(1))
            .rejects.toMatchObject({ status: 404, message: 'Container not assigned to patient' });
    });

    it('returns null if no upcoming intake in container', async () => {
        prismaMock.containers.findUnique.mockResolvedValue(makeContainer({ patient_id: 5 }));
        prismaMock.prescription_medications.findFirst.mockResolvedValue(null);
        const result = await service.getNextIntake(1);
        expect(result).toBeNull();
    });

    it('throws 404 if medication not loaded into compartment', async () => {
        prismaMock.containers.findUnique.mockResolvedValue(makeContainer({ patient_id: 5 }));
        prismaMock.prescription_medications.findFirst.mockResolvedValue(makeMed());
        prismaMock.compartment_medications.findFirst.mockResolvedValue(null);
        await expect(service.getNextIntake(1))
            .rejects.toMatchObject({ status: 404, message: 'Medication not loaded into container' });
    });

    it('returns next intake with compartment number', async () => {
        prismaMock.containers.findUnique.mockResolvedValue(makeContainer({ patient_id: 5 }));
        prismaMock.prescription_medications.findFirst.mockResolvedValue(makeMed());
        prismaMock.compartment_medications.findFirst.mockResolvedValue({
            compartment_med_id: 1,
            compartments: makeCompartment({ compartment_number: 3 }),
        });

        const result = await service.getNextIntake(1);
        expect(result.prescription_med_id).toBe(10);
        expect(result.compartment_number).toBe(3);
        expect(result.medication_name).toBe('Aspirin');
        expect(result.intake_at).toBeDefined();
    });
});

describe('confirmIntake', () => {

    it('throws 404 if medication not found', async () => {
        prismaMock.prescription_medications.findUnique.mockResolvedValue(null);
        await expect(service.confirmIntake(1, 999))
            .rejects.toMatchObject({ status: 404, message: 'Prescription medication not found' });
    });

    it('returns "Already taken" if intake_status is true', async () => {
        prismaMock.prescription_medications.findUnique.mockResolvedValue(makeMed({ intake_status: true }));
        const result = await service.confirmIntake(1, 10);
        expect(result.message).toBe('Already taken');
        expect(prismaMock.prescription_medications.update).not.toHaveBeenCalled();
    });

    it('sets intake_status=true', async () => {
        prismaMock.prescription_medications.findUnique.mockResolvedValue(makeMed());
        prismaMock.prescription_medications.update.mockResolvedValue({});
        prismaMock.compartment_medications.findFirst.mockResolvedValue(null);

        await service.confirmIntake(1, 10);
        expect(prismaMock.prescription_medications.update).toHaveBeenCalledWith({
            where: { prescription_med_id: 10 },
            data:  { intake_status: true },
        });
    });

    it('clears compartment when compartment_medication exists', async () => {
        prismaMock.prescription_medications.findUnique.mockResolvedValue(makeMed());
        prismaMock.prescription_medications.update.mockResolvedValue({});
        prismaMock.compartment_medications.findFirst.mockResolvedValue({
            compartment_med_id: 5,
            compartment_id:     3,
        });
        prismaMock.compartment_medications.update.mockResolvedValue({});
        prismaMock.compartments.update.mockResolvedValue({});
        prismaMock.compartment_medications.delete.mockResolvedValue({});

        await service.confirmIntake(1, 10);

        expect(prismaMock.compartments.update).toHaveBeenCalledWith({
            where: { compartment_id: 3 },
            data:  { is_filled: false, last_filled_at: null },
        });
        expect(prismaMock.compartment_medications.delete).toHaveBeenCalledOnce();
    });

    it('returns time as ISO string', async () => {
        prismaMock.prescription_medications.findUnique.mockResolvedValue(makeMed());
        prismaMock.prescription_medications.update.mockResolvedValue({});
        prismaMock.compartment_medications.findFirst.mockResolvedValue(null);

        const result = await service.confirmIntake(1, 10);
        expect(result.time).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
});

describe('fillCompartment', () => {

    it('throws 404 if compartment not found', async () => {
        prismaMock.compartments.findFirst.mockResolvedValue(null);
        await expect(service.fillCompartment(1, 2, 10, 5))
            .rejects.toMatchObject({ status: 404, message: 'Compartment not found' });
    });

    it('throws 400 if compartment already filled', async () => {
        prismaMock.compartments.findFirst.mockResolvedValue(makeCompartment({ is_filled: true }));
        await expect(service.fillCompartment(1, 2, 10, 5))
            .rejects.toMatchObject({ status: 400, message: 'Compartment already filled' });
    });

    it('creates compartment_medication and marks compartment as filled', async () => {
        prismaMock.compartments.findFirst.mockResolvedValue(makeCompartment());
        prismaMock.fill_sessions.findFirst.mockResolvedValue(null);
        prismaMock.compartment_medications.create.mockResolvedValue({});
        prismaMock.compartments.update.mockResolvedValue({});

        const result = await service.fillCompartment(1, 2, 10, 5);

        expect(prismaMock.compartment_medications.create).toHaveBeenCalledOnce();
        expect(prismaMock.compartments.update).toHaveBeenCalledWith({
            where: { compartment_id: 3 },
            data:  { is_filled: true, last_filled_at: expect.any(Date) },
        });
        expect(result.message).toBe('Compartment filled');
    });

    it('links fill_session_id when active session exists', async () => {
        prismaMock.compartments.findFirst.mockResolvedValue(makeCompartment());
        prismaMock.fill_sessions.findFirst.mockResolvedValue({ session_id: 7 });
        prismaMock.compartment_medications.create.mockResolvedValue({});
        prismaMock.compartments.update.mockResolvedValue({});

        await service.fillCompartment(1, 2, 10, 5);

        const createCall = prismaMock.compartment_medications.create.mock.calls[0][0];
        expect(createCall.data.fill_session_id).toBe(7);
    });
});

describe('clearCompartment', () => {

    it('throws 400 if compartment already empty', async () => {
        prismaMock.compartment_medications.findFirst.mockResolvedValue(null);
        await expect(service.clearCompartment(1, 3, 2))
            .rejects.toMatchObject({ status: 400, message: 'Compartment already empty' });
    });

    it('deletes compartment_medication and marks as not filled', async () => {
        prismaMock.compartment_medications.findFirst.mockResolvedValue({
            compartment_med_id: 5
        });
        prismaMock.compartment_medications.delete.mockResolvedValue({});
        prismaMock.compartments.update.mockResolvedValue({});

        const result = await service.clearCompartment(1, 3, 2);

        expect(prismaMock.compartment_medications.delete).toHaveBeenCalledWith({
            where: { compartment_med_id: 5 }
        });
        expect(prismaMock.compartments.update).toHaveBeenCalledWith({
            where: { compartment_id: 3 },
            data:  { is_filled: false, last_filled_at: null },
        });
        expect(result.message).toBe('Compartment cleared');
    });
});

describe('getRfidStatus', () => {

    it('returns rfid_authenticated=false when not set', async () => {
        prismaMock.containers.findUnique.mockResolvedValue({ rfid_authenticated: null });
        const result = await service.getRfidStatus(1);
        expect(result.rfid_authenticated).toBe(false);
    });

    it('returns rfid_authenticated=true when set', async () => {
        prismaMock.containers.findUnique.mockResolvedValue({ rfid_authenticated: true });
        const result = await service.getRfidStatus(1);
        expect(result.rfid_authenticated).toBe(true);
    });
});

describe('startFillSession', () => {

    it('finishes previous active sessions before creating new one', async () => {
        prismaMock.fill_sessions.updateMany.mockResolvedValue({ count: 1 });
        prismaMock.fill_sessions.create.mockResolvedValue({ session_id: 10 });

        await service.startFillSession(1, 5);

        expect(prismaMock.fill_sessions.updateMany).toHaveBeenCalledWith({
            where: { container_id: 1, status: 'active' },
            data:  { status: 'finished', finished_at: expect.any(Date) },
        });
        expect(prismaMock.fill_sessions.create).toHaveBeenCalledOnce();
    });

    it('creates new session with status=active', async () => {
        prismaMock.fill_sessions.updateMany.mockResolvedValue({ count: 0 });
        prismaMock.fill_sessions.create.mockResolvedValue({ session_id: 11 });

        await service.startFillSession(1, 5);

        const createCall = prismaMock.fill_sessions.create.mock.calls[0][0];
        expect(createCall.data.status).toBe('active');
        expect(createCall.data.started_by).toBe(5);
    });
});

describe('finishFillSession', () => {

    it('marks all active sessions as finished', async () => {
        prismaMock.fill_sessions.updateMany.mockResolvedValue({ count: 1 });
        await service.finishFillSession(1);
        expect(prismaMock.fill_sessions.updateMany).toHaveBeenCalledWith({
            where: { container_id: 1, status: 'active' },
            data:  { status: 'finished', finished_at: expect.any(Date) },
        });
    });
});

describe('logDeviceEvent', () => {

    it('creates device event with correct data', async () => {
        prismaMock.device_events.create.mockResolvedValue({});
        await service.logDeviceEvent(1, 'info', 'TEST_CODE', 'Test message');
        expect(prismaMock.device_events.create).toHaveBeenCalledWith({
            data: {
                container_id: 1,
                type:         'info',
                code:         'TEST_CODE',
                message:      'Test message',
            }
        });
    });

    it('stores null for missing code and message', async () => {
        prismaMock.device_events.create.mockResolvedValue({});
        await service.logDeviceEvent(1, 'warning', null, null);
        const call = prismaMock.device_events.create.mock.calls[0][0];
        expect(call.data.code).toBeNull();
        expect(call.data.message).toBeNull();
    });
});