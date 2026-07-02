import { describe, it, expect, vi, beforeEach } from 'vitest';


const prismaMock = {
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
};

vi.mock('../../src/config/prisma.js',                                () => ({ default: prismaMock }));
vi.mock('../../src/shared/logger/auditLogger.js',                    () => ({ logAction: vi.fn() }));
vi.mock('../../src/shared/constants/actions.js',                     () => ({ ACTIONS: {} }));
vi.mock('../../src/integrations/resend/emailService.js',             () => ({ sendWelcomeEmail: vi.fn() }));
vi.mock('../../src/integrations/azure/azure.storage.js',             () => ({
    getPrescriptionFileUrl: vi.fn().mockResolvedValue('https://blob/file.pdf'),
    uploadPrescriptionFile: vi.fn().mockResolvedValue('blob-name'),
}));
vi.mock('../../src/integrations/reports/patientsExcel.service.js',   () => ({ generatePatientsExcel:  vi.fn().mockResolvedValue(Buffer.from('')) }));
vi.mock('../../src/integrations/reports/treatmentReport.service.js', () => ({ generateTreatmentExcel: vi.fn().mockResolvedValue(Buffer.from('')) }));
vi.mock('../../src/integrations/reports/prescriptionPdf.service.js', () => ({ generatePrescriptionPdf: vi.fn().mockResolvedValue(Buffer.from('')) }));
vi.mock('../../src/shared/timezone/timezone.service.js', () => ({
    getUserTimezone:   vi.fn().mockResolvedValue('Europe/Kyiv'),
    getStartOfDayInTz: vi.fn().mockReturnValue(new Date('2026-06-01T00:00:00.000Z')),
    localToUtc:        vi.fn((date, time) => new Date(`${date}T${time}:00.000Z`)),
}));
vi.mock('../../src/shared/errors/AppError.js', () => ({
    AppError: class AppError extends Error {
        constructor(code, message, status) { super(message); this.code = code; this.status = status; }
    }
}));
vi.mock('../../src/shared/constants/errorCodes.js', () => ({
    ERROR_CODES: {
        VALIDATION_ERROR: 'VALIDATION_ERROR',
        USER_EXISTS:      'USER_EXISTS',
        USER_NOT_FOUND:   'USER_NOT_FOUND',
        NOT_FOUND:        'NOT_FOUND',
        FORBIDDEN:        'FORBIDDEN',
    }
}));

const { PatientsService } = await import('../../src/modules/patients/patients.service.js');

const makeReq = (user = { userId: 1 }) => ({
    user, headers: { 'user-agent': 'test' }, ip: '127.0.0.1'
});

const makeUser = (o = {}) => ({
    user_id: 1, first_name: 'John', last_name: 'Doe', patronymic: 'A.',
    login: 'patient@test.com', phone: '+380991234567',
    contact_info: 'Kyiv', avatar: null,
    date_of_birth: new Date('1990-01-01'), ...o
});

const makePrescription = (o = {}) => ({
    prescription_id: 1, diagnosis: 'Flu', icd_code: 'J11',
    date_issued: new Date('2026-06-01'), end_date: new Date('2026-06-15'),
    duration: 14, ward_id: 2, patient_id: 1, doctor_id: 10,
    complaints: 'Headache', anamnesis: null, objective_status: null,
    recommendations: null, notes: null,
    prescription_medications: [], prescription_files: [],
    users_prescriptions_doctor_idTousers: { first_name: 'Ivan', last_name: 'Petrov' },
    wards: { ward_number: '3' }, ...o
});

let service;
beforeEach(() => { vi.clearAllMocks(); service = new PatientsService(); });


describe('getAllPatients', () => {

    it('повертає список пацієнтів з правильною структурою', async () => {
        prismaMock.users.findMany.mockResolvedValue([makeUser()]);
        const result = await service.getAllPatients();
        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({ id: 1, email: 'patient@test.com' });
    });

    it('повертає порожній масив якщо пацієнтів немає', async () => {
        prismaMock.users.findMany.mockResolvedValue([]);
        expect(await service.getAllPatients()).toEqual([]);
    });
});

describe('getById', () => {

    it('повертає пацієнта за id', async () => {
        prismaMock.users.findUnique.mockResolvedValue(makeUser());
        const result = await service.getById(1);
        expect(result.id).toBe(1);
        expect(result.email).toBe('patient@test.com');
    });

    it('кидає 404 якщо пацієнта не знайдено', async () => {
        prismaMock.users.findUnique.mockResolvedValue(null);
        await expect(service.getById(999))
            .rejects.toMatchObject({ status: 404, message: 'Patient not found' });
    });
});

describe('createPatient', () => {

    it('кидає 400 якщо email вже існує', async () => {
        prismaMock.users.findUnique.mockResolvedValue(makeUser());
        await expect(service.createPatient({ email: 'patient@test.com' }, makeReq()))
            .rejects.toMatchObject({ status: 400, message: 'A user with this email already exists' });
    });

    it('створює пацієнта і повертає userId та email', async () => {
        prismaMock.users.findUnique.mockResolvedValue(null);
        prismaMock.users.create.mockResolvedValue(makeUser());
        prismaMock.notifications.create.mockResolvedValue({});

        const result = await service.createPatient({
            email: 'new@test.com', first_name: 'Jane', last_name: 'Doe'
        }, makeReq());

        expect(result.userId).toBe(1);
        expect(prismaMock.users.create).toHaveBeenCalledOnce();
    });
});

describe('updatePatient', () => {

    it('кидає 404 якщо пацієнта не знайдено', async () => {
        prismaMock.users.findUnique.mockResolvedValue(null);
        await expect(service.updatePatient(999, {}, makeReq()))
            .rejects.toMatchObject({ status: 404, message: 'Patient not found' });
    });

    it('оновлює пацієнта і повертає оновлені дані', async () => {
        prismaMock.users.findUnique.mockResolvedValue(makeUser());
        prismaMock.users.update.mockResolvedValue(makeUser({ first_name: 'Updated' }));

        const result = await service.updatePatient(1, {
            first_name: 'Updated', last_name: 'Doe', email: 'patient@test.com'
        }, makeReq());

        expect(result.message).toBe('Patient successfully updated');
        expect(prismaMock.users.update).toHaveBeenCalledOnce();
    });
});

describe('deletePatient', () => {

    it('кидає 404 якщо пацієнта не знайдено', async () => {
        prismaMock.users.findUnique.mockResolvedValue(null);
        await expect(service.deletePatient(999, makeReq()))
            .rejects.toMatchObject({ status: 404, message: 'Patient not found' });
    });

    it('видаляє пацієнта і повертає повідомлення', async () => {
        prismaMock.users.findUnique.mockResolvedValue(makeUser());
        prismaMock.users.delete.mockResolvedValue({});

        const result = await service.deletePatient(1, makeReq());
        expect(result.message).toBe('Patient successfully deleted');
        expect(prismaMock.users.delete).toHaveBeenCalledOnce();
    });
});

describe('getCounts', () => {

    it('повертає загальну кількість та кількість на лікуванні', async () => {
        prismaMock.users.count.mockResolvedValue(10);
        prismaMock.prescriptions.count.mockResolvedValue(4);

        const result = await service.getCounts();
        expect(result.totalPatients).toBe(10);
        expect(result.onTreatment).toBe(4);
    });
});

describe('getCurrentTreatment', () => {

    it('повертає порожній масив якщо немає активних призначень', async () => {
        prismaMock.prescriptions.findMany.mockResolvedValue([]);
        expect(await service.getCurrentTreatment(1)).toEqual([]);
    });

    it('дедуплікує препарати по name+frequency', async () => {
        const p = makePrescription({
            prescription_medications: [
                { medication_name: 'Aspirin',   frequency: '1 раз на день' },
                { medication_name: 'Aspirin',   frequency: '1 раз на день' }, // дублікат
                { medication_name: 'Ibuprofen', frequency: '2 рази на день' },
            ]
        });
        prismaMock.prescriptions.findMany.mockResolvedValue([p]);

        const result = await service.getCurrentTreatment(1);
        expect(result[0].medications).toHaveLength(2);
    });

    it('формує правильний рядок для medication', async () => {
        const p = makePrescription({
            prescription_medications: [
                { medication_name: 'Aspirin', frequency: '1 раз на день' }
            ]
        });
        prismaMock.prescriptions.findMany.mockResolvedValue([p]);

        const result = await service.getCurrentTreatment(1);
        expect(result[0].medications[0]).toBe('Aspirin - 1 раз на день');
    });
});

describe('getPrescriptionHistoryByPatient', () => {

    it('кидає 400 якщо patientId не передано', async () => {
        await expect(service.getPrescriptionHistoryByPatient(null))
            .rejects.toMatchObject({ status: 400, message: 'patientId is required' });
    });

    it('повертає список з правильними полями', async () => {
        prismaMock.prescriptions.findMany.mockResolvedValue([
            { prescription_id: 1, diagnosis: 'Flu',  date_issued: new Date('2026-01-01') },
            { prescription_id: 2, diagnosis: 'Cold', date_issued: new Date('2026-02-01') },
        ]);

        const result = await service.getPrescriptionHistoryByPatient(1);
        expect(result).toHaveLength(2);
        expect(result[0]).toMatchObject({ prescriptionId: 1, diagnosis: 'Flu' });
    });
});

describe('getPrescriptionDetails', () => {

    it('кидає 404 якщо призначення не знайдено', async () => {
        prismaMock.prescriptions.findUnique.mockResolvedValue(null);
        await expect(service.getPrescriptionDetails(999))
            .rejects.toMatchObject({ status: 404, message: 'Prescription not found' });
    });

    it('дедуплікує intake_times по UTC часу', async () => {
        const p = makePrescription({
            prescription_medications: [
                { medication_name: 'Aspirin', frequency: '2 рази', quantity: 1, medications: null,
                    intake_at: { toISOString: () => '2026-06-01T08:00:00.000Z' } },
                { medication_name: 'Aspirin', frequency: '2 рази', quantity: 1, medications: null,
                    intake_at: { toISOString: () => '2026-06-01T08:00:00.000Z' } }, // дублікат
                { medication_name: 'Aspirin', frequency: '2 рази', quantity: 1, medications: null,
                    intake_at: { toISOString: () => '2026-06-01T20:00:00.000Z' } }, // інший час
            ]
        });
        prismaMock.prescriptions.findUnique.mockResolvedValue(p);
        prismaMock.prescription_medications.aggregate.mockResolvedValue({ _sum: { quantity: 5 } });

        const result = await service.getPrescriptionDetails(1);
        expect(result.medications[0].intake_times).toHaveLength(2);
        expect(result.total_taken).toBe(5);
    });

    it('рахує duration по унікальних датах', async () => {
        const p = makePrescription({
            prescription_medications: [
                { medication_name: 'Aspirin', frequency: '1 раз', quantity: 1, medications: null,
                    intake_at: { toISOString: () => '2026-06-01T08:00:00.000Z' } },
                { medication_name: 'Aspirin', frequency: '1 раз', quantity: 1, medications: null,
                    intake_at: { toISOString: () => '2026-06-02T08:00:00.000Z' } },
                { medication_name: 'Aspirin', frequency: '1 раз', quantity: 1, medications: null,
                    intake_at: { toISOString: () => '2026-06-02T20:00:00.000Z' } }, // та ж дата
            ]
        });
        prismaMock.prescriptions.findUnique.mockResolvedValue(p);
        prismaMock.prescription_medications.aggregate.mockResolvedValue({ _sum: { quantity: 0 } });

        const result = await service.getPrescriptionDetails(1);
        expect(result.medications[0].duration).toBe(2);
    });
});

describe('deletePrescription', () => {

    it('кидає 404 якщо призначення не знайдено', async () => {
        prismaMock.prescriptions.findUnique.mockResolvedValue(null);
        await expect(service.deletePrescription(999, makeReq()))
            .rejects.toMatchObject({ status: 404 });
    });

    it('видаляє prescription і всі medication records', async () => {
        prismaMock.prescriptions.findUnique.mockResolvedValue(makePrescription());
        prismaMock.prescription_medications.deleteMany.mockResolvedValue({ count: 5 });
        prismaMock.prescriptions.delete.mockResolvedValue({});

        await service.deletePrescription(1, makeReq());
        expect(prismaMock.prescription_medications.deleteMany).toHaveBeenCalledOnce();
        expect(prismaMock.prescriptions.delete).toHaveBeenCalledOnce();
    });
});

describe('getMobileTreatment', () => {

    it('повертає порожній масив якщо немає активних призначень', async () => {
        prismaMock.prescriptions.findMany.mockResolvedValue([]);
        expect(await service.getMobileTreatment(1)).toEqual([]);
    });

    it('рахує duration по унікальних датах (не рядках)', async () => {
        const p = makePrescription({
            prescription_medications: [
                {
                    medication_name: 'Aspirin', frequency: '1 раз', quantity: 1,
                    intake_at: {toISOString: () => '2026-06-01T08:00:00.000Z'}
                },
                {
                    medication_name: 'Aspirin', frequency: '1 раз', quantity: 1,
                    intake_at: {toISOString: () => '2026-06-02T08:00:00.000Z'}
                },
                {
                    medication_name: 'Aspirin', frequency: '1 раз', quantity: 1,
                    intake_at: {toISOString: () => '2026-06-02T20:00:00.000Z'}
                },
            ]
        });
        prismaMock.prescriptions.findMany.mockResolvedValue([p]);

        const result = await service.getMobileTreatment(1);
        expect(result[0].medications[0].duration).toBe(2);
    });

    it('повертає правильні поля prescription', async () => {
        prismaMock.prescriptions.findMany.mockResolvedValue([makePrescription()]);
        const result = await service.getMobileTreatment(1);
        expect(result[0]).toMatchObject({
            prescriptionId: 1,
            name: 'Flu',
            ward: '3',
        });
    });
});

describe('getTreatmentHistory', () => {

    it('returns empty array when no past prescriptions', async () => {
        prismaMock.prescriptions.findMany.mockResolvedValue([]);
        expect(await service.getTreatmentHistory(1)).toEqual([]);
    });

    it('returns past prescriptions with deduplicated medications', async () => {
        const p = makePrescription({
            prescription_medications: [
                { medication_name: 'Aspirin',   frequency: '1x' },
                { medication_name: 'Aspirin',   frequency: '1x' },
                { medication_name: 'Ibuprofen', frequency: '2x' },
            ]
        });
        prismaMock.prescriptions.findMany.mockResolvedValue([p]);

        const result = await service.getTreatmentHistory(1);
        expect(result[0].medications).toHaveLength(2);
    });

    it('returns correct fields per prescription', async () => {
        prismaMock.prescriptions.findMany.mockResolvedValue([makePrescription()]);
        const result = await service.getTreatmentHistory(1);
        expect(result[0]).toMatchObject({
            prescriptionId: 1,
            name:           'Flu',
            duration:       14,
        });
    });
});

describe('generateTreatmentReport', () => {

    it('throws 404 if patient not found', async () => {
        prismaMock.users.findUnique.mockResolvedValue(null);
        await expect(service.generateTreatmentReport(999))
            .rejects.toMatchObject({ status: 404 });
    });

    it('returns excel buffer when patient exists', async () => {
        prismaMock.users.findUnique.mockResolvedValue(makeUser());
        prismaMock.prescriptions.findMany.mockResolvedValue([]);
        const result = await service.generateTreatmentReport(1);
        expect(Buffer.isBuffer(result)).toBe(true);
    });
});

describe('generatePrescriptionReport', () => {

    it('throws 404 if prescription not found', async () => {
        prismaMock.prescriptions.findUnique.mockResolvedValue(null);
        await expect(service.generatePrescriptionReport(999))
            .rejects.toMatchObject({ status: 404 });
    });

    it('returns pdf buffer when prescription exists', async () => {
        prismaMock.prescriptions.findUnique.mockResolvedValue(makePrescription());
        prismaMock.prescription_medications.aggregate.mockResolvedValue({ _sum: { quantity: 10 } });
        const result = await service.generatePrescriptionReport(1);
        expect(Buffer.isBuffer(result)).toBe(true);
    });
});

describe('getPrescriptionFiles', () => {

    it('returns empty array when no files', async () => {
        prismaMock.prescription_files.findMany.mockResolvedValue([]);
        expect(await service.getPrescriptionFiles(1)).toEqual([]);
    });

    it('returns files with signed URLs', async () => {
        prismaMock.prescription_files.findMany.mockResolvedValue([{
            file_id:     1,
            file_name:   'report.pdf',
            file_type:   'pdf',
            file_url:    'blob-name',
            uploaded_at: new Date('2026-06-01T10:00:00.000Z'),
        }]);

        const result = await service.getPrescriptionFiles(1);
        expect(result[0].url).toBe('https://blob/file.pdf');
        expect(result[0].file_name).toBe('report.pdf');
    });
});

describe('getAllPatientsForStaff', () => {

    it('returns empty array when no active patients', async () => {
        prismaMock.users.findMany.mockResolvedValue([]);
        expect(await service.getAllPatientsForStaff()).toEqual([]);
    });

    it('returns patients with ward from latest prescription', async () => {
        prismaMock.users.findMany.mockResolvedValue([{
            ...makeUser(),
            prescriptions_prescriptions_patient_idTousers: [{
                wards: { ward_number: '5' }
            }]
        }]);

        const result = await service.getAllPatientsForStaff();
        expect(result[0].ward).toBe('5');
    });

    it('returns "—" for ward when no prescription', async () => {
        prismaMock.users.findMany.mockResolvedValue([{
            ...makeUser(),
            prescriptions_prescriptions_patient_idTousers: []
        }]);

        const result = await service.getAllPatientsForStaff();
        expect(result[0].ward).toBe('—');
    });
});

describe('getPrescriptionById', () => {

    it('throws 404 if prescription not found', async () => {
        prismaMock.prescriptions.findUnique.mockResolvedValue(null);
        await expect(service.getPrescriptionById(999))
            .rejects.toMatchObject({ status: 404 });
    });

    it('returns prescription with medications and schedule', async () => {
        const future = new Date(Date.now() + 24 * 60 * 60 * 1000);

        prismaMock.prescriptions.findUnique.mockResolvedValue(makePrescription({
            diagnosis:       'Diabetes',
            icd_code:        'E11',
            ward_id:         3,
            complaints:      'Thirst',
            prescription_medications: [{
                medication_name: 'Metformin',
                quantity:        1,
                frequency:       '2 раз(и) на день',
                intake_at:       future,
            }],
            prescription_files: [],
            users_prescriptions_doctor_idTousers: { first_name: 'Ivan', last_name: 'Petrov' },
            wards: { ward_number: '3' },
        }));

        const result = await service.getPrescriptionById(1);
        expect(result.diagnosis).toBe('Diabetes');
        expect(result.medications).toHaveLength(1);
        expect(result.schedule).toHaveLength(1);
    });

    it('deduplicates medications by name', async () => {
        const future = new Date(Date.now() + 86400000);
        prismaMock.prescriptions.findUnique.mockResolvedValue(makePrescription({
            prescription_medications: [
                { medication_name: 'Aspirin', quantity: 1, frequency: '1x',
                    intake_at: { toISOString: () => new Date(Date.now() + 3600000).toISOString() } },
                { medication_name: 'Aspirin', quantity: 1, frequency: '1x',
                    intake_at: { toISOString: () => future.toISOString() } },
            ],
            prescription_files: [],
            users_prescriptions_doctor_idTousers: { first_name: 'Ivan', last_name: 'Petrov' },
        }));

        const result = await service.getPrescriptionById(1);
        expect(result.medications).toHaveLength(1);
    });
});

describe('createPrescription', () => {

    it('throws 400 when required fields missing', async () => {
        await expect(service.createPrescription(1, 1, {
            diagnosis: '', wardId: '', medications: []
        }, [], makeReq()))
            .rejects.toMatchObject({ status: 400 });
    });

    it('throws 400 when medications array is empty', async () => {
        await expect(service.createPrescription(1, 1, {
            diagnosis: 'Flu', wardId: 1, medications: []
        }, [], makeReq()))
            .rejects.toMatchObject({ status: 400 });
    });

    it('creates prescription and returns prescriptionId', async () => {
        prismaMock.prescriptions.create.mockResolvedValue({ prescription_id: 99 });
        prismaMock.prescription_medications.create.mockResolvedValue({});
        prismaMock.prescription_medications.findFirst.mockResolvedValue(null);

        const result = await service.createPrescription(1, 1, {
            diagnosis:   'Flu',
            wardId:      2,
            medications: JSON.stringify([{
                medicationName: 'Aspirin',
                quantity:       1,
                timesPerDay:    2,
                duration:       7,
            }]),
            schedule: JSON.stringify([{
                name: 'Aspirin',
                time: '08:00',
            }]),
        }, [], makeReq());

        expect(result.prescriptionId).toBe(99);
        expect(prismaMock.prescriptions.create).toHaveBeenCalledOnce();
    });
});

describe('updatePrescription', () => {

    it('updates prescription and returns success message', async () => {
        prismaMock.prescriptions.update.mockResolvedValue({});
        prismaMock.prescription_medications.deleteMany.mockResolvedValue({ count: 3 });
        prismaMock.prescription_medications.create.mockResolvedValue({});
        prismaMock.prescription_medications.findFirst.mockResolvedValue(null);

        const result = await service.updatePrescription(1, {
            diagnosis:   'Updated Flu',
            wardId:      2,
            medications: JSON.stringify([{
                medicationName: 'Aspirin',
                quantity:       1,
                timesPerDay:    2,
                duration:       5,
            }]),
            schedule: JSON.stringify([{ name: 'Aspirin', time: '09:00' }]),
        }, [], makeReq());

        expect(result.message).toBe('Призначення оновлено');
        expect(prismaMock.prescriptions.update).toHaveBeenCalledOnce();
        expect(prismaMock.prescription_medications.deleteMany).toHaveBeenCalledOnce();
    });
});