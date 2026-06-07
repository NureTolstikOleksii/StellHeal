import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';


const { viPrismaMock } = vi.hoisted(() => ({
    viPrismaMock: {
        users: {
            findUnique: vi.fn(),
            update:     vi.fn(),
        },
        audit_logs: { create: vi.fn() },
    }
}));

vi.mock('../../src/config/prisma.js',               () => ({ default: viPrismaMock }));
vi.mock('../../src/shared/logger/auditLogger.js',   () => ({ logAction: vi.fn() }));
vi.mock('../../src/shared/constants/actions.js',    () => ({
    ACTIONS: {
        UPLOAD_AVATAR:   'UPLOAD_AVATAR',
        CHANGE_PASSWORD: 'CHANGE_PASSWORD',
        UPDATE_PROFILE:  'UPDATE_PROFILE',
    }
}));
vi.mock('../../src/shared/errors/AppError.js', () => ({
    AppError: class AppError extends Error {
        constructor(code, message, status) { super(message); this.code = code; this.status = status; }
    }
}));
vi.mock('../../src/shared/constants/errorCodes.js', () => ({
    ERROR_CODES: {
        USER_NOT_FOUND:   'USER_NOT_FOUND',
        INVALID_PASSWORD: 'INVALID_PASSWORD',
    }
}));

const { ProfileService } = await import('../../src/modules/profile/profile.service.js');

const makeReq  = () => ({ user: { userId: 1 }, headers: {}, ip: '127.0.0.1' });
const makeUser = (o = {}) => ({
    user_id:  1,
    login:    'user@test.com',
    password: bcrypt.hashSync('OldPass123!', 10),
    avatar:   null,
    roles:    { role_name: 'doctor' },
    medical_staff: null,
    ...o
});

let service;
beforeEach(() => { vi.clearAllMocks(); service = new ProfileService(); });


describe('getProfile', () => {

    it('returns user with roles and medical_staff', async () => {
        viPrismaMock.users.findUnique.mockResolvedValue(makeUser());
        const result = await service.getProfile(1, makeReq());
        expect(result.user_id).toBe(1);
        expect(result.roles.role_name).toBe('doctor');
    });

    it('throws 404 if user not found', async () => {
        viPrismaMock.users.findUnique.mockResolvedValue(null);
        await expect(service.getProfile(999, makeReq()))
            .rejects.toMatchObject({ status: 404, message: 'User not found' });
    });
});

describe('updateAvatar', () => {

    it('updates avatar URL and returns updated user', async () => {
        const url = 'https://blob.azure.com/avatar.jpg';
        viPrismaMock.users.update.mockResolvedValue(makeUser({ avatar: url }));

        const result = await service.updateAvatar(1, url, makeReq());
        expect(result.avatar).toBe(url);
        expect(viPrismaMock.users.update).toHaveBeenCalledWith({
            where: { user_id: 1 },
            data:  { avatar: url },
        });
    });
});


describe('changePassword', () => {

    it('throws 404 if user not found', async () => {
        viPrismaMock.users.findUnique.mockResolvedValue(null);
        await expect(service.changePassword(999, 'old', 'new', makeReq()))
            .rejects.toMatchObject({ status: 404, message: 'User not found' });
    });

    it('throws 400 if current password is incorrect', async () => {
        viPrismaMock.users.findUnique.mockResolvedValue(makeUser());
        await expect(service.changePassword(1, 'WrongPassword!', 'NewPass123!', makeReq()))
            .rejects.toMatchObject({ status: 400, message: 'Invalid current password' });
    });

    it('updates password hash when current password is correct', async () => {
        viPrismaMock.users.findUnique.mockResolvedValue(makeUser());
        viPrismaMock.users.update.mockResolvedValue({});

        await service.changePassword(1, 'OldPass123!', 'NewPass456!', makeReq());

        expect(viPrismaMock.users.update).toHaveBeenCalledOnce();
        const call = viPrismaMock.users.update.mock.calls[0][0];
        // Verify stored password is hashed, not plaintext
        const isHashed = await bcrypt.compare('NewPass456!', call.data.password);
        expect(isHashed).toBe(true);
    });
});

describe('changeEmail', () => {

    it('throws 404 if user not found', async () => {
        viPrismaMock.users.findUnique.mockResolvedValue(null);
        await expect(service.changeEmail(999, 'pass', 'new@test.com', makeReq()))
            .rejects.toMatchObject({ status: 404 });
    });

    it('throws 400 if current password is incorrect', async () => {
        viPrismaMock.users.findUnique.mockResolvedValue(makeUser());
        await expect(service.changeEmail(1, 'WrongPass!', 'new@test.com', makeReq()))
            .rejects.toMatchObject({ status: 400, message: 'Invalid current password' });
    });

    it('throws 409 if new email is already taken', async () => {
        viPrismaMock.users.findUnique
            .mockResolvedValueOnce(makeUser())
            .mockResolvedValueOnce(makeUser({ user_id: 2 }));
        await expect(service.changeEmail(1, 'OldPass123!', 'taken@test.com', makeReq()))
            .rejects.toMatchObject({ status: 409, message: 'This email is already in use' });
    });

    it('updates email and returns new login', async () => {
        viPrismaMock.users.findUnique
            .mockResolvedValueOnce(makeUser())
            .mockResolvedValueOnce(null);
        viPrismaMock.users.update.mockResolvedValue(makeUser({ login: 'new@test.com' }));

        const result = await service.changeEmail(1, 'OldPass123!', 'new@test.com', makeReq());
        expect(result.login).toBe('new@test.com');
    });
});

describe('updateProfile', () => {

    it('updates profile fields and returns updated user', async () => {
        const updated = makeUser({ first_name: 'Updated', phone: '+380991111111' });
        viPrismaMock.users.update.mockResolvedValue(updated);

        const result = await service.updateProfile(1, {
            first_name: 'Updated', phone: '+380991111111'
        }, makeReq());

        expect(result.first_name).toBe('Updated');
        expect(viPrismaMock.users.update).toHaveBeenCalledWith({
            where: { user_id: 1 },
            data:  { first_name: 'Updated', phone: '+380991111111' },
        });
    });
});