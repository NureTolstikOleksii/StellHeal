import { describe, it, expect, vi, beforeEach } from 'vitest';


const prismaMock = {
    notification_recipients: {
        findMany:    vi.fn(),
        updateMany:  vi.fn(),
    },
    notifications: {
        create: vi.fn(),
    },
    users: {
        findMany: vi.fn(),
        update:   vi.fn(),
    },
    containers: {
        findUnique: vi.fn(),
    },
    prescription_medications: {
        update:     vi.fn(),
        findUnique: vi.fn(),
        findFirst:  vi.fn(),
    },
    compartment_medications: {
        findFirst: vi.fn(),
        update:    vi.fn(),
        delete:    vi.fn(),
    },
    compartments: {
        update: vi.fn(),
    },
    audit_logs: { create: vi.fn() },
};

const firebaseMock = {
    messaging: vi.fn().mockReturnValue({
        send: vi.fn().mockResolvedValue('message-id'),
    }),
};

vi.mock('../../src/config/prisma.js',                    () => ({ default: prismaMock }));
vi.mock('../../src/integrations/firebase/firebaseConfig.js', () => ({ default: firebaseMock }));
vi.mock('../../src/shared/logger/auditLogger.js',        () => ({ logAction: vi.fn() }));
vi.mock('../../src/shared/constants/actions.js',         () => ({ ACTIONS: { UPDATE: 'UPDATE' } }));
vi.mock('../../src/shared/errors/AppError.js', () => ({
    AppError: class AppError extends Error {
        constructor(code, message, status) { super(message); this.code = code; this.status = status; }
    }
}));
vi.mock('../../src/shared/constants/errorCodes.js', () => ({
    ERROR_CODES: { INTERNAL_ERROR: 'INTERNAL_ERROR', NOT_FOUND: 'NOT_FOUND' }
}));
vi.mock('../../src/shared/timezone/timezone.service.js', () => ({
    utcToLocalTime: vi.fn().mockReturnValue('08:00'),
}));

const { NotificationService } = await import('../../src/modules/notifications/notifications.service.js');

const makePatient = (o = {}) => ({
    user_id: 1, first_name: 'John', last_name: 'Doe', patronymic: 'A.',
    firebase_token: 'fcm-token-patient',
    prescriptions_prescriptions_patient_idTousers: [{
        wards: { ward_number: '3' }
    }],
    ...o
});

const makeContainerContext = (o = {}) => ({
    container_id:     1,
    container_number: 1,
    users: makePatient(o.patient || {}),
    ...o
});

const makeMed = (o = {}) => ({
    prescription_med_id: 10,
    medication_name:     'Aspirin',
    quantity:            2,
    intake_at:           new Date('2026-06-01T08:00:00.000Z'),
    medications:         null,
    prescriptions: {
        users_prescriptions_doctor_idTousers: { timezone: 'Europe/Kyiv' }
    },
    ...o
});

let service;
beforeEach(() => { vi.clearAllMocks(); service = new NotificationService(); });


describe('getUserNotifications', () => {

    it('returns empty array when no notifications', async () => {
        prismaMock.notification_recipients.findMany.mockResolvedValue([]);
        const result = await service.getUserNotifications(1);
        expect(result).toEqual([]);
    });

    it('returns notifications with correct shape', async () => {
        prismaMock.notification_recipients.findMany.mockResolvedValue([{
            notification_id: 5,
            is_read:         false,
            notifications: {
                notification_type: 'warning',
                message:           'Test message',
                sent_at:           new Date('2026-06-01T10:00:00.000Z'),
            }
        }]);

        const result = await service.getUserNotifications(1);
        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
            id:      5,
            type:    'warning',
            message: 'Test message',
            is_read: false,
        });
        expect(result[0].sent_at).toBe('2026-06-01T10:00:00.000Z');
    });

    it('returns null for sent_at when not set', async () => {
        prismaMock.notification_recipients.findMany.mockResolvedValue([{
            notification_id: 1,
            is_read:         true,
            notifications: {
                notification_type: 'info',
                message:           'No date',
                sent_at:           null,
            }
        }]);

        const result = await service.getUserNotifications(1);
        expect(result[0].sent_at).toBeNull();
    });
});

describe('markNotificationsRead', () => {

    it('calls updateMany with correct where clause', async () => {
        prismaMock.notification_recipients.updateMany.mockResolvedValue({ count: 3 });
        await service.markNotificationsRead(1);
        expect(prismaMock.notification_recipients.updateMany).toHaveBeenCalledWith({
            where: { user_id: 1, is_read: false },
            data:  { is_read: true },
        });
    });
});

describe('saveFcmToken', () => {

    it('updates firebase_token for user', async () => {
        prismaMock.users.update.mockResolvedValue({});
        await service.saveFcmToken(1, 'new-fcm-token');
        expect(prismaMock.users.update).toHaveBeenCalledWith({
            where: { user_id: 1 },
            data:  { firebase_token: 'new-fcm-token' },
        });
    });
});

describe('sendNotification', () => {

    it('calls firebase messaging with correct payload', async () => {
        await service.sendNotification('fcm-token', 'Title', 'Body');
        expect(firebaseMock.messaging().send).toHaveBeenCalledWith({
            notification: { title: 'Title', body: 'Body' },
            token:        'fcm-token',
        });
    });

    it('throws 500 if firebase send fails', async () => {
        firebaseMock.messaging().send.mockRejectedValueOnce(new Error('Firebase error'));
        await expect(service.sendNotification('bad-token', 'T', 'B'))
            .rejects.toMatchObject({ status: 500 });
    });
});

describe('getContainerContext', () => {

    it('returns null if container has no patient', async () => {
        prismaMock.containers.findUnique.mockResolvedValue({ users: null });
        const result = await service.getContainerContext(1);
        expect(result).toBeNull();
    });

    it('returns correct context when patient exists', async () => {
        prismaMock.containers.findUnique.mockResolvedValue(makeContainerContext());
        const result = await service.getContainerContext(1);
        expect(result.patientFullName).toBe('Doe John A.');
        expect(result.ward).toBe('3');
        expect(result.containerNumber).toBe(1);
    });

    it('returns "—" for ward when no active prescription', async () => {
        prismaMock.containers.findUnique.mockResolvedValue(makeContainerContext({
            patient: makePatient({
                prescriptions_prescriptions_patient_idTousers: []
            })
        }));
        const result = await service.getContainerContext(1);
        expect(result.ward).toBe('—');
    });
});

describe('sendWeightAlert', () => {

    it('throws 404 if container has no patient', async () => {
        prismaMock.prescription_medications.update.mockResolvedValue({});
        prismaMock.compartment_medications.findFirst.mockResolvedValue(null);
        prismaMock.containers.findUnique.mockResolvedValue({ users: null });

        await expect(service.sendWeightAlert(1, 10))
            .rejects.toMatchObject({ status: 404, message: 'Patient not found' });
    });

    it('marks intake_status as false', async () => {
        prismaMock.prescription_medications.update.mockResolvedValue({});
        prismaMock.compartment_medications.findFirst.mockResolvedValue(null);
        prismaMock.containers.findUnique.mockResolvedValue(makeContainerContext());
        prismaMock.prescription_medications.findUnique.mockResolvedValue(makeMed());
        prismaMock.users.findMany.mockResolvedValue([]);
        prismaMock.notifications.create.mockResolvedValue({});

        await service.sendWeightAlert(1, 10);

        expect(prismaMock.prescription_medications.update).toHaveBeenCalledWith({
            where: { prescription_med_id: 10 },
            data:  { intake_status: false },
        });
    });

    it('clears compartment when compartment_medication exists', async () => {
        prismaMock.prescription_medications.update.mockResolvedValue({});
        prismaMock.compartment_medications.findFirst.mockResolvedValue({
            compartment_med_id: 5,
            compartment_id:     3,
        });
        prismaMock.compartment_medications.update.mockResolvedValue({});
        prismaMock.compartments.update.mockResolvedValue({});
        prismaMock.compartment_medications.delete.mockResolvedValue({});
        prismaMock.containers.findUnique.mockResolvedValue(makeContainerContext());
        prismaMock.prescription_medications.findUnique.mockResolvedValue(makeMed());
        prismaMock.users.findMany.mockResolvedValue([]);
        prismaMock.notifications.create.mockResolvedValue({});

        await service.sendWeightAlert(1, 10);

        expect(prismaMock.compartments.update).toHaveBeenCalledWith({
            where: { compartment_id: 3 },
            data:  { is_filled: false, last_filled_at: null },
        });
        expect(prismaMock.compartment_medications.delete).toHaveBeenCalledOnce();
    });

    it('creates notification for patient', async () => {
        prismaMock.prescription_medications.update.mockResolvedValue({});
        prismaMock.compartment_medications.findFirst.mockResolvedValue(null);
        prismaMock.containers.findUnique.mockResolvedValue(makeContainerContext());
        prismaMock.prescription_medications.findUnique.mockResolvedValue(makeMed());
        prismaMock.users.findMany.mockResolvedValue([]);
        prismaMock.notifications.create.mockResolvedValue({});

        await service.sendWeightAlert(1, 10);
        expect(prismaMock.notifications.create).toHaveBeenCalledOnce();
    });

    it('creates separate notification for nurses when nurses exist', async () => {
        prismaMock.prescription_medications.update.mockResolvedValue({});
        prismaMock.compartment_medications.findFirst.mockResolvedValue(null);
        prismaMock.containers.findUnique.mockResolvedValue(makeContainerContext());
        prismaMock.prescription_medications.findUnique.mockResolvedValue(makeMed());
        prismaMock.users.findMany.mockResolvedValue([
            { user_id: 2, firebase_token: null },
            { user_id: 3, firebase_token: null },
        ]);
        prismaMock.notifications.create.mockResolvedValue({});

        await service.sendWeightAlert(1, 10);
        expect(prismaMock.notifications.create).toHaveBeenCalledTimes(2);
    });

    it('sends push to patient if firebase_token exists', async () => {
        prismaMock.prescription_medications.update.mockResolvedValue({});
        prismaMock.compartment_medications.findFirst.mockResolvedValue(null);
        prismaMock.containers.findUnique.mockResolvedValue(makeContainerContext());
        prismaMock.prescription_medications.findUnique.mockResolvedValue(makeMed());
        prismaMock.users.findMany.mockResolvedValue([]);
        prismaMock.notifications.create.mockResolvedValue({});

        await service.sendWeightAlert(1, 10);
        expect(firebaseMock.messaging().send).toHaveBeenCalledOnce();
    });

    it('returns success message', async () => {
        prismaMock.prescription_medications.update.mockResolvedValue({});
        prismaMock.compartment_medications.findFirst.mockResolvedValue(null);
        prismaMock.containers.findUnique.mockResolvedValue(makeContainerContext());
        prismaMock.prescription_medications.findUnique.mockResolvedValue(makeMed());
        prismaMock.users.findMany.mockResolvedValue([]);
        prismaMock.notifications.create.mockResolvedValue({});

        const result = await service.sendWeightAlert(1, 10);
        expect(result.message).toBe('Alert sent');
    });
});

describe('sendIntakeReminder', () => {

    it('throws 404 if container has no patient', async () => {
        prismaMock.containers.findUnique.mockResolvedValue({ users: null });
        await expect(service.sendIntakeReminder(1, 10))
            .rejects.toMatchObject({ status: 404, message: 'Patient not found' });
    });

    it('creates INTAKE_REMINDER notification for patient', async () => {
        prismaMock.containers.findUnique.mockResolvedValue(makeContainerContext());
        prismaMock.prescription_medications.findUnique.mockResolvedValue(makeMed());
        prismaMock.notifications.create.mockResolvedValue({});

        await service.sendIntakeReminder(1, 10);

        const call = prismaMock.notifications.create.mock.calls[0][0];
        expect(call.data.notification_type).toBe('INTAKE_REMINDER');
        expect(call.data.message).toContain('Aspirin');
    });

    it('sends push notification if patient has firebase_token', async () => {
        prismaMock.containers.findUnique.mockResolvedValue(makeContainerContext());
        prismaMock.prescription_medications.findUnique.mockResolvedValue(makeMed());
        prismaMock.notifications.create.mockResolvedValue({});

        await service.sendIntakeReminder(1, 10);
        expect(firebaseMock.messaging().send).toHaveBeenCalledOnce();
    });

    it('does not send push if no firebase_token', async () => {
        prismaMock.containers.findUnique.mockResolvedValue(makeContainerContext({
            patient: makePatient({ firebase_token: null })
        }));
        prismaMock.prescription_medications.findUnique.mockResolvedValue(makeMed());
        prismaMock.notifications.create.mockResolvedValue({});

        await service.sendIntakeReminder(1, 10);
        expect(firebaseMock.messaging().send).not.toHaveBeenCalled();
    });

    it('returns success message', async () => {
        prismaMock.containers.findUnique.mockResolvedValue(makeContainerContext());
        prismaMock.prescription_medications.findUnique.mockResolvedValue(makeMed());
        prismaMock.notifications.create.mockResolvedValue({});

        const result = await service.sendIntakeReminder(1, 10);
        expect(result.message).toBe('Intake reminder sent');
    });

    it('includes medication quantity and local time in message', async () => {
        prismaMock.containers.findUnique.mockResolvedValue(makeContainerContext());
        prismaMock.prescription_medications.findUnique.mockResolvedValue(makeMed({ quantity: 3 }));
        prismaMock.notifications.create.mockResolvedValue({});

        await service.sendIntakeReminder(1, 10);

        const call = prismaMock.notifications.create.mock.calls[0][0];
        expect(call.data.message).toContain('3 табл.');
        expect(call.data.message).toContain('08:00');
    });
});