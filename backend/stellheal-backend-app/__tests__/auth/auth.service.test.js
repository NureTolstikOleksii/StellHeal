import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

process.env.JWT_SECRET = 'test_secret';

const prismaMock = {
    users: {
        findUnique:  vi.fn(),
        create:      vi.fn(),
        update:      vi.fn(),
    },
    refresh_tokens: {
        create:      vi.fn(),
        findUnique:  vi.fn(),
        update:      vi.fn(),
        updateMany:  vi.fn(),
    },
    password_reset_tokens: {
        create:      vi.fn(),
        findUnique:  vi.fn(),
        delete:      vi.fn(),
    },
    audit_logs: {
        create:      vi.fn(),
    }
};

vi.mock('../../src/config/prisma.js', () => ({ default: prismaMock }));
vi.mock('../../src/shared/logger/auditLogger.js', () => ({ logAction: vi.fn() }));
vi.mock('../../src/shared/constants/actions.js', () => ({ ACTIONS: {} }));
vi.mock('../../src/shared/errors/AppError.js', () => ({
    AppError: class AppError extends Error {
        constructor(code, message, status) {
            super(message);
            this.code = code; this.status = status;
        }
    }
}));
vi.mock('../../src/shared/constants/errorCodes.js', () => ({
    ERROR_CODES: {
        VALIDATION_ERROR:    'VALIDATION_ERROR',
        FORBIDDEN:           'FORBIDDEN',
        USER_EXISTS:         'USER_EXISTS',
        WEAK_PASSWORD:       'WEAK_PASSWORD',
        USER_NOT_FOUND:      'USER_NOT_FOUND',
        INVALID_PASSWORD:    'INVALID_PASSWORD',
        ACCOUNT_LOCKED:      'ACCOUNT_LOCKED',
        INVALID_TOKEN:       'INVALID_TOKEN',
        SESSION_COMPROMISED: 'SESSION_COMPROMISED',
        TOKEN_EXPIRED:       'TOKEN_EXPIRED',
    }
}));

const { AuthService } = await import('../../src/modules/auth/auth.service.js');

const makeReq = (body = {}, headers = {}) => ({
    body,
    headers: { 'user-agent': 'test', ...headers },
    ip: '127.0.0.1'
});

const makeUser = (overrides = {}) => ({
    user_id:               1,
    login:                 'doctor@test.com',
    password:              bcrypt.hashSync('Qwerty123!', 10),
    role_id:               1,
    failed_login_attempts: 0,
    lock_until:            null,
    roles:                 { role_name: 'admin' },
    ...overrides
});

let service;
beforeEach(() => {
    vi.clearAllMocks();
    service = new AuthService();
});

describe('loginUser', () => {

    it('should throw 400 if platform is not provided', async () => {
        await expect(service.loginUser('a@b.com', 'pass', '', 'UTC', makeReq()))
            .rejects.toMatchObject({ status: 400, message: 'Platform is required' });
    });

    it('should throw 401 if user is not found', async () => {
        prismaMock.users.findUnique.mockResolvedValue(null);
        await expect(service.loginUser('a@b.com', 'pass', 'web', 'UTC', makeReq()))
            .rejects.toMatchObject({ status: 401, message: 'User not found' });
    });

    it('should throw 403 if account is locked', async () => {
        prismaMock.users.findUnique.mockResolvedValue(makeUser({
            lock_until: new Date(Date.now() + 60000)
        }));
        await expect(service.loginUser('a@b.com', 'pass', 'web', 'UTC', makeReq()))
            .rejects.toMatchObject({ status: 403 });
    });

    it('should throw 401 if password is invalid', async () => {
        prismaMock.users.findUnique.mockResolvedValue(makeUser());
        prismaMock.users.update.mockResolvedValue({});
        await expect(service.loginUser('doctor@test.com', 'WrongPass!', 'web', 'UTC', makeReq()))
            .rejects.toMatchObject({ status: 401, message: 'Invalid password' });
    });

    it('should throw 403 if web role is not allowed (role_id=3 → patient)', async () => {
        prismaMock.users.findUnique.mockResolvedValue(makeUser({ role_id: 3 }));
        prismaMock.users.update.mockResolvedValue({});
        await expect(service.loginUser('doctor@test.com', 'Qwerty123!', 'web', 'UTC', makeReq()))
            .rejects.toMatchObject({ status: 403, message: 'Access denied for web' });
    });

    it('should throw 403 if mobile role is not allowed (role_id=1 → admin)', async () => {
        prismaMock.users.findUnique.mockResolvedValue(makeUser({ role_id: 1 }));
        prismaMock.users.update.mockResolvedValue({});
        await expect(service.loginUser('doctor@test.com', 'Qwerty123!', 'mobile', 'UTC', makeReq()))
            .rejects.toMatchObject({ status: 403, message: 'Access denied for mobile' });
    });

    it('should return user upon successful login (web, role_id=1)', async () => {
        const user = makeUser({ role_id: 1 });
        prismaMock.users.findUnique.mockResolvedValue(user);
        prismaMock.users.update.mockResolvedValue({});
        const result = await service.loginUser('doctor@test.com', 'Qwerty123!', 'web', 'UTC', makeReq({ platform: 'web' }));
        expect(result.user_id).toBe(1);
    });

    it('should return user upon successful login (mobile, role_id=2)', async () => {
        const user = makeUser({ role_id: 2 });
        prismaMock.users.findUnique.mockResolvedValue(user);
        prismaMock.users.update.mockResolvedValue({});
        const result = await service.loginUser('nurse@test.com', 'Qwerty123!', 'mobile', 'UTC', makeReq({ platform: 'mobile' }));
        expect(result.user_id).toBe(1);
    });
});

describe('registerUser', () => {

    it('should throw 400 if role_id is not provided', async () => {
        await expect(service.registerUser({}, makeReq()))
            .rejects.toMatchObject({ status: 400, message: 'Role is required' });
    });

    it('should throw 403 if role_id is invalid (e.g. 99)', async () => {
        await expect(service.registerUser({ role_id: 99 }, makeReq()))
            .rejects.toMatchObject({ status: 403, message: 'Invalid role' });
    });

    it('should throw 400 if user already exists', async () => {
        prismaMock.users.findUnique.mockResolvedValue(makeUser());
        await expect(service.registerUser({ role_id: 1, email: 'doctor@test.com', password: 'Qwerty123!' }, makeReq()))
            .rejects.toMatchObject({ status: 400, message: 'User already exists' });
    });

    it('should throw 400 if password is weak', async () => {
        prismaMock.users.findUnique.mockResolvedValue(null);
        await expect(service.registerUser({ role_id: 1, email: 'new@test.com', password: '123' }, makeReq()))
            .rejects.toMatchObject({ status: 400, message: 'Weak password' });
    });

    it('should create a user when valid data is provided', async () => {
        prismaMock.users.findUnique.mockResolvedValue(null);
        prismaMock.users.create.mockResolvedValue({ user_id: 5, login: 'new@test.com' });
        const result = await service.registerUser({
            role_id: 1, email: 'new@test.com', password: 'Qwerty123!',
            first_name: 'John', last_name: 'Doe'
        }, makeReq());
        expect(result.user_id).toBe(5);
        expect(prismaMock.users.create).toHaveBeenCalledOnce();
    });
});

describe('refreshSession', () => {

    it('should throw 403 if refresh token is not found', async () => {
        prismaMock.refresh_tokens.findUnique.mockResolvedValue(null);
        await expect(service.refreshSession('bad_token', makeReq()))
            .rejects.toMatchObject({ status: 403, message: 'Invalid token' });
    });

    it('should throw 403 and revoke all tokens if token is revoked (SESSION_COMPROMISED)', async () => {
        prismaMock.refresh_tokens.findUnique.mockResolvedValue({
            token: 'tkn', user_id: 1, is_revoked: true,
            expires_at: new Date(Date.now() + 10000)
        });
        prismaMock.refresh_tokens.updateMany.mockResolvedValue({ count: 1 });
        await expect(service.refreshSession('tkn', makeReq()))
            .rejects.toMatchObject({ status: 403, message: 'Session compromised' });
        expect(prismaMock.refresh_tokens.updateMany).toHaveBeenCalledOnce();
    });

    it('should throw 403 if refresh token is expired', async () => {
        prismaMock.refresh_tokens.findUnique.mockResolvedValue({
            token: 'tkn', user_id: 1, is_revoked: false,
            expires_at: new Date(Date.now() - 10000) // past time
        });
        await expect(service.refreshSession('tkn', makeReq()))
            .rejects.toMatchObject({ status: 403, message: 'Token expired' });
    });

    it('should return new tokens when given a valid refresh token', async () => {
        prismaMock.refresh_tokens.findUnique.mockResolvedValue({
            token: 'valid_tkn', user_id: 1, is_revoked: false,
            expires_at: new Date(Date.now() + 100000)
        });
        prismaMock.refresh_tokens.update.mockResolvedValue({});
        prismaMock.refresh_tokens.create.mockResolvedValue({});
        prismaMock.users.findUnique.mockResolvedValue(makeUser());

        const result = await service.refreshSession('valid_tkn', makeReq({ platform: 'web' }));
        expect(result.accessToken).toBeDefined();
        expect(result.refreshToken).toBeDefined();

        const decoded = jwt.verify(result.accessToken, 'test_secret');
        expect(decoded.userId).toBe(1);
    });
});

describe('resetPassword', () => {

    it('should throw 400 if token is not found', async () => {
        prismaMock.password_reset_tokens.findUnique.mockResolvedValue(null);
        await expect(service.resetPassword('bad', 'NewPass123!', makeReq()))
            .rejects.toMatchObject({ status: 400, message: 'Invalid token' });
    });

    it('should throw 400 if token is expired', async () => {
        prismaMock.password_reset_tokens.findUnique.mockResolvedValue({
            token: 'tkn', user_id: 1,
            expires_at: new Date(Date.now() - 1000)
        });
        await expect(service.resetPassword('tkn', 'NewPass123!', makeReq()))
            .rejects.toMatchObject({ status: 400, message: 'Invalid token' });
    });

    it('should throw 400 if new password is weak', async () => {
        prismaMock.password_reset_tokens.findUnique.mockResolvedValue({
            token: 'tkn', user_id: 1,
            expires_at: new Date(Date.now() + 10000)
        });
        await expect(service.resetPassword('tkn', 'weak', makeReq()))
            .rejects.toMatchObject({ status: 400, message: 'Weak password' });
    });

    it('should update password when valid data is provided', async () => {
        prismaMock.password_reset_tokens.findUnique.mockResolvedValue({
            token: 'tkn', user_id: 1,
            expires_at: new Date(Date.now() + 10000)
        });
        prismaMock.users.update.mockResolvedValue({});
        prismaMock.password_reset_tokens.delete.mockResolvedValue({});

        await service.resetPassword('tkn', 'NewPass123!', makeReq());

        expect(prismaMock.users.update).toHaveBeenCalledOnce();
        expect(prismaMock.password_reset_tokens.delete).toHaveBeenCalledOnce();
    });
});

describe('createRefreshToken', () => {

    it('should create a token with an 8-hour expiry for web', async () => {
        prismaMock.refresh_tokens.create.mockResolvedValue({});
        await service.createRefreshToken(1, makeReq({ platform: 'web' }));
        const call = prismaMock.refresh_tokens.create.mock.calls[0][0];
        const diff = call.data.expires_at - Date.now();
        expect(diff).toBeGreaterThan(7 * 60 * 60 * 1000);
        expect(diff).toBeLessThan(9 * 60 * 60 * 1000);
    });

    it('should create a token with a 30-day expiry for mobile', async () => {
        prismaMock.refresh_tokens.create.mockResolvedValue({});
        await service.createRefreshToken(1, makeReq({ platform: 'mobile' }));
        const call = prismaMock.refresh_tokens.create.mock.calls[0][0];
        const diff = call.data.expires_at - Date.now();
        expect(diff).toBeGreaterThan(29 * 24 * 60 * 60 * 1000);
    });
});