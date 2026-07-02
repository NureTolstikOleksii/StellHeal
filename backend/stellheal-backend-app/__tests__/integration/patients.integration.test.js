import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

process.env.JWT_SECRET        = 'test_secret';
process.env.DATABASE_URL      = 'postgresql://fake:fake@localhost:5432/fake';
process.env.GROQ_API_KEY      = 'fake';
process.env.AZURE_STORAGE_CONNECTION_STRING = 'DefaultEndpointsProtocol=https;AccountName=fake;AccountKey=dGVzdA==;EndpointSuffix=core.windows.net';

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
        prescriptions: {
            findMany:   vi.fn(),
            findUnique: vi.fn(),
            create:     vi.fn(),
            update:     vi.fn(),
            delete:     vi.fn(),
            count:      vi.fn(),
        },
        prescription_medications: {
            findMany:   vi.fn(),
            findFirst:  vi.fn(),
            create:     vi.fn(),
            createMany: vi.fn(),
            deleteMany: vi.fn(),
            aggregate:  vi.fn(),
        },
        prescription_files: {
            findMany:   vi.fn(),
            createMany: vi.fn(),
        },
        notifications: { create: vi.fn() },
        audit_logs:    { create: vi.fn() },
        $connect:      vi.fn(),
        $disconnect:   vi.fn(),
    }
}));

vi.mock('../../src/config/prisma.js',                                () => ({ default: viPrismaMock }));
vi.mock('../../src/shared/logger/auditLogger.js',                    () => ({ logAction: vi.fn() }));
vi.mock('../../src/shared/constants/actions.js',                     () => ({ ACTIONS: {} }));
vi.mock('../../src/integrations/resend/emailService.js',             () => ({ sendWelcomeEmail: vi.fn(), sendResetPasswordEmail: vi.fn() }));
vi.mock('../../src/integrations/firebase/firebaseConfig.js',         () => ({ default: { messaging: vi.fn() } }));
vi.mock('../../src/integrations/azure/azure.storage.js',             () => ({
    getPrescriptionFileUrl: vi.fn().mockResolvedValue('https://blob/file.pdf'),
    uploadPrescriptionFile: vi.fn().mockResolvedValue('blob-name'),
}));
vi.mock('../../src/integrations/reports/patientsExcel.service.js',   () => ({ generatePatientsExcel:  vi.fn().mockResolvedValue(Buffer.from('excel')) }));
vi.mock('../../src/integrations/reports/treatmentReport.service.js', () => ({ generateTreatmentExcel: vi.fn().mockResolvedValue(Buffer.from('excel')) }));
vi.mock('../../src/integrations/reports/prescriptionPdf.service.js', () => ({ generatePrescriptionPdf: vi.fn().mockResolvedValue(Buffer.from('pdf')) }));
vi.mock('../../src/shared/timezone/timezone.service.js', () => ({
    getUserTimezone:   vi.fn().mockResolvedValue('Europe/Kyiv'),
    getStartOfDayInTz: vi.fn().mockReturnValue(new Date('2026-06-01T00:00:00.000Z')),
    localToUtc:        vi.fn((date, time) => new Date(`${date}T${time}:00.000Z`)),
}));
vi.mock('node-cron', () => ({ default: { schedule: vi.fn() } }));
vi.mock('@azure/storage-blob', () => ({
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

const adminToken   = jwt.sign({ userId: 1, roleId: 1 }, 'test_secret', { expiresIn: '1h' });
const doctorToken  = jwt.sign({ userId: 2, roleId: 1 }, 'test_secret', { expiresIn: '1h' });
const patientToken = jwt.sign({ userId: 3, roleId: 3 }, 'test_secret', { expiresIn: '1h' });

const makePatient = (o = {}) => ({
    user_id:      1,
    first_name:   'John',
    last_name:    'Doe',
    patronymic:   'A.',
    login:        'patient@test.com',
    phone:        '+380991234567',
    contact_info: 'Kyiv',
    avatar:       null,
    date_of_birth: new Date('1990-01-01'),
    ...o
});

beforeEach(() => vi.clearAllMocks());
afterAll(() => vi.clearAllMocks());


describe('GET /api/patients', () => {

    it('returns 401 without token', async () => {
        const res = await request(app).get('/api/patients');
        expect(res.status).toBe(401);
    });

    it('returns 200 with list of patients', async () => {
        viPrismaMock.users.findMany.mockResolvedValue([makePatient()]);

        const res = await request(app)
            .get('/api/patients')
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body[0].email).toBe('patient@test.com');
    });

    it('returns empty array when no patients', async () => {
        viPrismaMock.users.findMany.mockResolvedValue([]);

        const res = await request(app)
            .get('/api/patients')
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });
});

describe('GET /api/patients/:id', () => {

    it('returns 401 without token', async () => {
        const res = await request(app).get('/api/patients/1');
        expect(res.status).toBe(401);
    });

    it('returns 200 with patient data', async () => {
        viPrismaMock.users.findUnique.mockResolvedValue(makePatient());

        const res = await request(app)
            .get('/api/patients/1')
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.email).toBe('patient@test.com');
    });

    it('returns 404 when patient not found', async () => {
        viPrismaMock.users.findUnique.mockResolvedValue(null);

        const res = await request(app)
            .get('/api/patients/999')
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(404);
        expect(res.body.code).toBe('USER_NOT_FOUND');
    });
});

describe('DELETE /api/patients/:id', () => {

    it('returns 401 without token', async () => {
        const res = await request(app).delete('/api/patients/1');
        expect(res.status).toBe(401);
    });

    it('returns 200 on successful delete', async () => {
        viPrismaMock.users.findUnique.mockResolvedValue(makePatient());
        viPrismaMock.users.delete.mockResolvedValue({});

        const res = await request(app)
            .delete('/api/patients/1')
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Пацієнта видалено');
    });

    it('returns 404 when patient not found', async () => {
        viPrismaMock.users.findUnique.mockResolvedValue(null);

        const res = await request(app)
            .delete('/api/patients/999')
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(404);
    });
});

describe('GET /api/patients/counts', () => {

    it('returns 401 without token', async () => {
        const res = await request(app).get('/api/patients/counts');
        expect(res.status).toBe(401);
    });

    it('returns 200 with totalPatients and onTreatment', async () => {
        viPrismaMock.users.count.mockResolvedValue(10);
        viPrismaMock.prescriptions.count.mockResolvedValue(4);

        const res = await request(app)
            .get('/api/patients/stats')
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.totalPatients).toBe(10);
        expect(res.body.onTreatment).toBe(4);
    });
});

describe('GET /api/patients/:id/current', () => {

    it('returns 401 without token', async () => {
        const res = await request(app).get('/api/patients/1/current');
        expect(res.status).toBe(401);
    });

    it('returns 200 with active prescriptions', async () => {
        viPrismaMock.prescriptions.findMany.mockResolvedValue([{
            prescription_id: 1,
            diagnosis:       'Flu',
            icd_code:        'J11',
            date_issued:     new Date(),
            end_date:        new Date(Date.now() + 86400000),
            duration:        7,
            ward_id:         1,
            complaints:      null, anamnesis: null,
            objective_status: null, recommendations: null, notes: null,
            prescription_medications: [],
            prescription_files:       [],
            users_prescriptions_doctor_idTousers: { first_name: 'Ivan', last_name: 'Petrov' },
        }]);

        const res = await request(app)
            .get('/api/patients/1/current')
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body[0].name).toBe('Flu');
    });
});