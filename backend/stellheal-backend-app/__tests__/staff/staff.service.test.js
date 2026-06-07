import { describe, it, expect, vi, beforeEach } from 'vitest';


const { viPrismaMock } = vi.hoisted(() => ({
    viPrismaMock: {
        users: {
            findMany:   vi.fn(),
            findUnique: vi.fn(),
            create:     vi.fn(),
            update:     vi.fn(),
            delete:     vi.fn(),
            count:      vi.fn(),
        },
        medical_staff: {
            create: vi.fn(),
            upsert: vi.fn(),
        },
        notifications: { create: vi.fn() },
        roles: {
            findMany:   vi.fn(),
            findUnique: vi.fn(),
            findFirst:  vi.fn(),
            create:     vi.fn(),
            update:     vi.fn(),
            delete:     vi.fn(),
        },
        audit_logs: { create: vi.fn() },
        $transaction: vi.fn(),
    }
}));

vi.mock('../../src/config/prisma.js', () => ({ default: viPrismaMock }));
vi.mock('../../src/shared/logger/auditLogger.js',                () => ({ logAction: vi.fn() }));
vi.mock('../../src/shared/constants/actions.js',                 () => ({
    ACTIONS: {
        CREATE_STAFF: 'CREATE_STAFF', UPDATE_STAFF: 'UPDATE_STAFF',
        DELETE_STAFF: 'DELETE_STAFF', SECURITY_EVENT: 'SECURITY_EVENT',
        CREATE_ROLE:  'CREATE_ROLE',  DELETE_ROLE:   'DELETE_ROLE',
        UPDATE_ROLE:  'UPDATE_ROLE',  EXPORT_STAFF:  'EXPORT_STAFF',
    }
}));
vi.mock('../../src/integrations/resend/emailService.js',         () => ({ sendStaffCredentialsEmail: vi.fn() }));
vi.mock('../../src/integrations/reports/staffExcel.service.js',  () => ({ generateStaffExcel: vi.fn().mockResolvedValue(Buffer.from('')) }));
vi.mock('nanoid', () => ({ nanoid: vi.fn().mockReturnValue('mock-password-10') }));
vi.mock('../../src/shared/errors/AppError.js', () => ({
    AppError: class AppError extends Error {
        constructor(code, message, status) { super(message); this.code = code; this.status = status; }
    }
}));
vi.mock('../../src/shared/constants/errorCodes.js', () => ({
    ERROR_CODES: {
        USER_EXISTS:    'USER_EXISTS',
        USER_NOT_FOUND: 'USER_NOT_FOUND',
        NOT_FOUND:      'NOT_FOUND',
        CONFLICT:       'CONFLICT',
        FORBIDDEN:      'FORBIDDEN',
    }
}));

const { StaffService } = await import('../../src/modules/staff/staff.service.js');

const makeReq  = () => ({ user: { userId: 1 }, headers: { 'user-agent': 'test' }, ip: '127.0.0.1' });
const makeUser = (o = {}) => ({
    user_id: 5, first_name: 'Ivan', last_name: 'Petrov',
    login: 'ivan@test.com', role_id: 1, lock_until: null, ...o
});
const makeRole = (o = {}) => ({ role_id: 10, role_name: 'editor', ...o });

let service;
beforeEach(() => { vi.clearAllMocks(); service = new StaffService(); });

describe('getAllMedicalStaff', () => {

    it('returns all staff with medical_staff relation', async () => {
        viPrismaMock.users.findMany.mockResolvedValue([makeUser()]);
        const result = await service.getAllMedicalStaff();
        expect(result).toHaveLength(1);
        expect(viPrismaMock.users.findMany).toHaveBeenCalledOnce();
    });

    it('returns empty array when no staff', async () => {
        viPrismaMock.users.findMany.mockResolvedValue([]);
        expect(await service.getAllMedicalStaff()).toEqual([]);
    });
});

describe('getStaffCount', () => {

    it('returns count of users with role 1 or 2', async () => {
        viPrismaMock.users.count.mockResolvedValue(12);
        const result = await service.getStaffCount();
        expect(result).toBe(12);
        expect(viPrismaMock.users.count).toHaveBeenCalledWith({
            where: { role_id: { in: [1, 2] } }
        });
    });
});

describe('addStaff', () => {

    it('throws 400 if login already exists', async () => {
        viPrismaMock.users.findUnique.mockResolvedValue(makeUser());
        await expect(service.addStaff({ login: 'ivan@test.com' }, makeReq()))
            .rejects.toMatchObject({ status: 400, message: 'Користувач з такою поштою вже існує' });
    });

    it('creates user and sends credentials email', async () => {
        viPrismaMock.users.findUnique.mockResolvedValue(null);
        viPrismaMock.users.create.mockResolvedValue(makeUser());
        viPrismaMock.notifications.create.mockResolvedValue({});

        const { sendStaffCredentialsEmail } = await import('../../src/integrations/resend/emailService.js');

        await service.addStaff({
            login: 'new@test.com', first_name: 'Anna', last_name: 'Koval',
            role_id: 2
        }, makeReq());

        expect(viPrismaMock.users.create).toHaveBeenCalledOnce();
        expect(sendStaffCredentialsEmail).toHaveBeenCalledWith('new@test.com', 'mock-password-10');
    });

    it('creates medical_staff record when specialization provided', async () => {
        viPrismaMock.users.findUnique.mockResolvedValue(null);
        viPrismaMock.users.create.mockResolvedValue(makeUser());
        viPrismaMock.medical_staff.create.mockResolvedValue({});
        viPrismaMock.notifications.create.mockResolvedValue({});

        await service.addStaff({
            login: 'new@test.com', role_id: 1,
            specialization: 'Cardiology', shift: 'morning'
        }, makeReq());

        expect(viPrismaMock.medical_staff.create).toHaveBeenCalledOnce();
        const call = viPrismaMock.medical_staff.create.mock.calls[0][0];
        expect(call.data.specialization).toBe('Cardiology');
    });

    it('does not create medical_staff when no specialization', async () => {
        viPrismaMock.users.findUnique.mockResolvedValue(null);
        viPrismaMock.users.create.mockResolvedValue(makeUser());
        viPrismaMock.notifications.create.mockResolvedValue({});

        await service.addStaff({ login: 'new@test.com', role_id: 2 }, makeReq());
        expect(viPrismaMock.medical_staff.create).not.toHaveBeenCalled();
    });

    it('creates welcome notification for new staff', async () => {
        viPrismaMock.users.findUnique.mockResolvedValue(null);
        viPrismaMock.users.create.mockResolvedValue(makeUser());
        viPrismaMock.notifications.create.mockResolvedValue({});

        await service.addStaff({ login: 'new@test.com', role_id: 2 }, makeReq());

        const call = viPrismaMock.notifications.create.mock.calls[0][0];
        expect(call.data.notification_type).toBe('success');
        expect(call.data.message).toContain('Вітаємо');
    });
});

describe('updateStaff', () => {

    it('throws 404 if staff not found', async () => {
        viPrismaMock.users.findUnique.mockResolvedValue(null);
        await expect(service.updateStaff(999, {}, makeReq()))
            .rejects.toMatchObject({ status: 404, message: 'Працівника не знайдено' });
    });

    it('updates user and upserts medical_staff in transaction', async () => {
        viPrismaMock.users.findUnique.mockResolvedValue(makeUser());
        viPrismaMock.$transaction.mockImplementation(async (ops) => {
            return Promise.all(ops.map(op => op));
        });
        viPrismaMock.users.update.mockResolvedValue(makeUser({ first_name: 'Updated' }));
        viPrismaMock.medical_staff.upsert.mockResolvedValue({});

        const result = await service.updateStaff(5, {
            first_name: 'Updated', last_name: 'Petrov', role_id: 1
        }, makeReq());

        expect(viPrismaMock.$transaction).toHaveBeenCalledOnce();
    });
});

describe('deleteStaff', () => {

    it('throws 404 if staff not found', async () => {
        viPrismaMock.users.findUnique.mockResolvedValue(null);
        await expect(service.deleteStaff(999, makeReq()))
            .rejects.toMatchObject({ status: 404, message: 'Працівника не знайдено' });
    });

    it('deletes user successfully', async () => {
        viPrismaMock.users.findUnique.mockResolvedValue(makeUser());
        viPrismaMock.users.delete.mockResolvedValue({});

        await service.deleteStaff(5, makeReq());
        expect(viPrismaMock.users.delete).toHaveBeenCalledWith({ where: { user_id: 5 } });
    });
});

describe('blockStaff', () => {

    it('throws 404 if staff not found', async () => {
        viPrismaMock.users.findUnique.mockResolvedValue(null);
        await expect(service.blockStaff(999, makeReq()))
            .rejects.toMatchObject({ status: 404 });
    });

    it('sets lock_until far in the future', async () => {
        viPrismaMock.users.findUnique.mockResolvedValue(makeUser());
        viPrismaMock.users.update.mockResolvedValue(makeUser({ lock_until: new Date(Date.now() + 1000000) }));

        await service.blockStaff(5, makeReq());

        const call = viPrismaMock.users.update.mock.calls[0][0];
        const lockUntil = call.data.lock_until;
        const yearsFromNow = (lockUntil - Date.now()) / (1000 * 60 * 60 * 24 * 365);
        expect(yearsFromNow).toBeGreaterThan(50);
    });
});

describe('unblockStaff', () => {

    it('throws 404 if staff not found', async () => {
        viPrismaMock.users.findUnique.mockResolvedValue(null);
        await expect(service.unblockStaff(999, makeReq()))
            .rejects.toMatchObject({ status: 404 });
    });

    it('clears lock_until and resets failed_login_attempts', async () => {
        viPrismaMock.users.findUnique.mockResolvedValue(makeUser());
        viPrismaMock.users.update.mockResolvedValue(makeUser());

        await service.unblockStaff(5, makeReq());

        const call = viPrismaMock.users.update.mock.calls[0][0];
        expect(call.data.lock_until).toBeNull();
        expect(call.data.failed_login_attempts).toBe(0);
    });
});

describe('getRoles', () => {

    it('returns all roles ordered by role_id', async () => {
        viPrismaMock.roles.findMany.mockResolvedValue([
            { role_id: 1, role_name: 'admin' },
            { role_id: 2, role_name: 'doctor' },
        ]);
        const result = await service.getRoles();
        expect(result).toHaveLength(2);
        expect(viPrismaMock.roles.findMany).toHaveBeenCalledWith({
            orderBy: { role_id: 'asc' }
        });
    });
});

describe('createRole', () => {

    it('throws 409 if role with same name exists (case-insensitive)', async () => {
        viPrismaMock.roles.findFirst.mockResolvedValue(makeRole({ role_name: 'Editor' }));
        await expect(service.createRole('editor', makeReq()))
            .rejects.toMatchObject({ status: 409, message: 'Role already exists' });
    });

    it('creates role with trimmed name', async () => {
        viPrismaMock.roles.findFirst.mockResolvedValue(null);
        viPrismaMock.roles.create.mockResolvedValue(makeRole({ role_name: 'analyst' }));

        const result = await service.createRole('  analyst  ', makeReq());
        const call = viPrismaMock.roles.create.mock.calls[0][0];
        expect(call.data.role_name).toBe('analyst');
    });
});

describe('deleteRole', () => {

    it('throws 404 if role not found', async () => {
        viPrismaMock.roles.findUnique.mockResolvedValue(null);
        await expect(service.deleteRole(999, makeReq()))
            .rejects.toMatchObject({ status: 404, message: 'Role not found' });
    });

    it('throws 403 when deleting system role', async () => {
        viPrismaMock.roles.findUnique.mockResolvedValue(makeRole({ role_name: 'admin' }));
        await expect(service.deleteRole(10, makeReq()))
            .rejects.toMatchObject({ status: 403, message: 'Cannot delete system role' });
    });

    it('throws 403 for all system role names (case-insensitive)', async () => {
        for (const name of ['Admin', 'DOCTOR', 'Nurse', 'Patient']) {
            viPrismaMock.roles.findUnique.mockResolvedValue(makeRole({ role_name: name }));
            await expect(service.deleteRole(10, makeReq()))
                .rejects.toMatchObject({ status: 403 });
        }
    });

    it('throws 409 if role is assigned to users', async () => {
        viPrismaMock.roles.findUnique.mockResolvedValue(makeRole());
        viPrismaMock.users.count.mockResolvedValue(3);
        await expect(service.deleteRole(10, makeReq()))
            .rejects.toMatchObject({ status: 409, message: 'Role is assigned to users' });
    });

    it('deletes role when no users assigned', async () => {
        viPrismaMock.roles.findUnique.mockResolvedValue(makeRole());
        viPrismaMock.users.count.mockResolvedValue(0);
        viPrismaMock.roles.delete.mockResolvedValue({});

        await service.deleteRole(10, makeReq());
        expect(viPrismaMock.roles.delete).toHaveBeenCalledWith({ where: { role_id: 10 } });
    });
});

describe('updateRole', () => {

    it('throws 404 if role not found', async () => {
        viPrismaMock.roles.findUnique.mockResolvedValue(null);
        await expect(service.updateRole(999, 'newname', makeReq()))
            .rejects.toMatchObject({ status: 404, message: 'Role not found' });
    });

    it('throws 409 if new name belongs to another role', async () => {
        viPrismaMock.roles.findUnique.mockResolvedValue(makeRole());
        viPrismaMock.roles.findFirst.mockResolvedValue(makeRole({ role_id: 99 }));
        await expect(service.updateRole(10, 'editor', makeReq()))
            .rejects.toMatchObject({ status: 409, message: 'Role already exists' });
    });

    it('updates role with trimmed name', async () => {
        viPrismaMock.roles.findUnique.mockResolvedValue(makeRole());
        viPrismaMock.roles.findFirst.mockResolvedValue(null);
        viPrismaMock.roles.update.mockResolvedValue(makeRole({ role_name: 'analyst' }));

        const result = await service.updateRole(10, '  analyst  ', makeReq());
        const call = viPrismaMock.roles.update.mock.calls[0][0];
        expect(call.data.role_name).toBe('analyst');
    });
});