import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

process.env.JWT_SECRET        = 'test_secret';
process.env.DATABASE_URL      = 'postgresql://fake:fake@localhost:5432/fake';
process.env.GROQ_API_KEY      = 'fake';
process.env.AZURE_STORAGE_CONNECTION_STRING = 'DefaultEndpointsProtocol=https;AccountName=fake;AccountKey=dGVzdA==;EndpointSuffix=core.windows.net';


const { viPrismaMock } = vi.hoisted(() => ({
    viPrismaMock: {
        users: {
            findUnique: vi.fn(),
            update:     vi.fn(),
            create:     vi.fn(),
        },
        refresh_tokens: {
            create:     vi.fn(),
            findUnique: vi.fn(),
            update:     vi.fn(),
            updateMany: vi.fn(),
        },
        audit_logs: { create: vi.fn() },
        $connect:   vi.fn(),
        $disconnect: vi.fn(),
    }
}));

vi.mock('../../src/config/prisma.js',                    () => ({ default: viPrismaMock }));
vi.mock('../../src/shared/logger/auditLogger.js',        () => ({ logAction: vi.fn() }));
vi.mock('../../src/shared/constants/actions.js',         () => ({ ACTIONS: { LOGIN: 'LOGIN', LOGIN_FAILED: 'LOGIN_FAILED', SECURITY_EVENT: 'SECURITY_EVENT' } }));
vi.mock('../../src/integrations/resend/emailService.js', () => ({ sendResetPasswordEmail: vi.fn() }));
vi.mock('../../src/integrations/firebase/firebaseConfig.js', () => ({ default: { messaging: vi.fn() } }));
vi.mock('node-cron',                                     () => ({ default: { schedule: vi.fn() } }));
vi.mock('@azure/storage-blob',                           () => ({
    BlobServiceClient: { fromConnectionString: vi.fn().mockReturnValue({
            getContainerClient: vi.fn().mockReturnValue({ listBlobsFlat: vi.fn().mockReturnValue([]) })
        })}
}));
vi.mock('../../src/middleware/rateLimiter.js', () => ({
    globalLimiter: (req, res, next) => next(),
    loginLimiter:  (req, res, next) => next(),
    registerLimiter: (req, res, next) => next(),
}));

const { createApp } = await import('../../src/app.js');
const app = createApp();

const makeDbUser = (overrides = {}) => ({
    user_id:               1,
    login:                 'doctor@test.com',
    password:              bcrypt.hashSync('Qwerty123!', 10),
    role_id:               1,
    failed_login_attempts: 0,
    lock_until:            null,
    roles:                 { role_name: 'admin' },
    first_name:            'Ivan',
    last_name:             'Petrov',
    avatar:                null,
    ...overrides
});

beforeAll(() => vi.clearAllMocks());
afterAll(() => vi.clearAllMocks());


describe('POST /api/auth/login', () => {

    it('returns 200 with accessToken and refreshToken on success', async () => {
        viPrismaMock.users.findUnique.mockResolvedValue(makeDbUser());
        viPrismaMock.users.update.mockResolvedValue({});
        viPrismaMock.refresh_tokens.create.mockResolvedValue({});

        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'doctor@test.com', password: 'Qwerty123!', platform: 'web' });

        expect(res.status).toBe(200);
        expect(res.body.accessToken).toBeDefined();
        expect(res.body.refreshToken).toBeDefined();
        expect(res.body.user.id).toBe(1);
    });

    it('returns 401 when user not found', async () => {
        viPrismaMock.users.findUnique.mockResolvedValue(null);

        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'nobody@test.com', password: 'Qwerty123!', platform: 'web' });

        expect(res.status).toBe(401);
        expect(res.body.code).toBe('USER_NOT_FOUND');
    });

    it('returns 401 when password is incorrect', async () => {
        viPrismaMock.users.findUnique.mockResolvedValue(makeDbUser());
        viPrismaMock.users.update.mockResolvedValue({});

        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'doctor@test.com', password: 'WrongPass!', platform: 'web' });

        expect(res.status).toBe(401);
        expect(res.body.code).toBe('INVALID_PASSWORD');
    });

    it('returns 400 when platform is missing', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'doctor@test.com', password: 'Qwerty123!' });

        expect(res.status).toBe(400);
    });

    it('returns 403 when web user tries to login with patient role', async () => {
        viPrismaMock.users.findUnique.mockResolvedValue(makeDbUser({ role_id: 3 }));
        viPrismaMock.users.update.mockResolvedValue({});

        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'patient@test.com', password: 'Qwerty123!', platform: 'web' });

        expect(res.status).toBe(403);
        expect(res.body.code).toBe('FORBIDDEN');
    });

    it('returns 403 when account is locked', async () => {
        viPrismaMock.users.findUnique.mockResolvedValue(makeDbUser({
            lock_until: new Date(Date.now() + 60000)
        }));

        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'doctor@test.com', password: 'Qwerty123!', platform: 'web' });

        expect(res.status).toBe(403);
        expect(res.body.code).toBe('ACCOUNT_LOCKED');
    });
});

describe('POST /api/auth/refresh', () => {

    it('returns 200 with new tokens', async () => {
        viPrismaMock.refresh_tokens.findUnique.mockResolvedValue({
            token:      'valid-refresh-token',
            user_id:    1,
            is_revoked: false,
            expires_at: new Date(Date.now() + 100000),
        });
        viPrismaMock.refresh_tokens.update.mockResolvedValue({});
        viPrismaMock.refresh_tokens.create.mockResolvedValue({});
        viPrismaMock.users.findUnique.mockResolvedValue(makeDbUser());

        const res = await request(app)
            .post('/api/auth/refresh')
            .send({ refreshToken: 'valid-refresh-token' });

        expect(res.status).toBe(200);
        expect(res.body.accessToken).toBeDefined();
        expect(res.body.refreshToken).toBeDefined();
    });

    it('returns 401 when refresh token missing', async () => {
        const res = await request(app)
            .post('/api/auth/refresh')
            .send({});

        expect(res.status).toBe(401);
    });

    it('returns 403 when refresh token is revoked', async () => {
        viPrismaMock.refresh_tokens.findUnique.mockResolvedValue({
            token:      'revoked-token',
            user_id:    1,
            is_revoked: true,
            expires_at: new Date(Date.now() + 100000),
        });
        viPrismaMock.refresh_tokens.updateMany.mockResolvedValue({ count: 1 });

        const res = await request(app)
            .post('/api/auth/refresh')
            .send({ refreshToken: 'revoked-token' });

        expect(res.status).toBe(403);
        expect(res.body.code).toBe('SESSION_COMPROMISED');
    });

    it('returns 403 when refresh token expired', async () => {
        viPrismaMock.refresh_tokens.findUnique.mockResolvedValue({
            token:      'expired-token',
            user_id:    1,
            is_revoked: false,
            expires_at: new Date(Date.now() - 1000),
        });

        const res = await request(app)
            .post('/api/auth/refresh')
            .send({ refreshToken: 'expired-token' });

        expect(res.status).toBe(403);
        expect(res.body.code).toBe('TOKEN_EXPIRED');
    });
});

describe('POST /api/auth/logout', () => {

    it('returns 200 on successful logout', async () => {
        const token = jwt.sign({ userId: 1, roleId: 1 }, 'test_secret', { expiresIn: '15m' });
        viPrismaMock.refresh_tokens.updateMany.mockResolvedValue({ count: 1 });

        const res = await request(app)
            .post('/api/auth/logout')
            .set('Authorization', `Bearer ${token}`)
            .send({ refreshToken: 'some-refresh-token' });

        expect(res.status).toBe(200);
    });

    it('returns 401 without auth token', async () => {
        const res = await request(app)
            .post('/api/auth/logout')
            .send({ refreshToken: 'some-token' });

        expect(res.status).toBe(401);
    });
});

describe('GET /', () => {

    it('returns 200 with running message', async () => {
        const res = await request(app).get('/');
        expect(res.status).toBe(200);
        expect(res.text).toContain('running');
    });
});

describe('404 handler', () => {

    it('returns 404 for unknown routes', async () => {
        const res = await request(app).get('/api/nonexistent-route');
        expect(res.status).toBe(404);
        expect(res.body.code).toBe('NOT_FOUND');
    });
});