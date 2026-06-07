import { describe, it, expect, vi, beforeEach } from 'vitest';


const { viPrismaMock } = vi.hoisted(() => {
    return {
        viPrismaMock: {
            users: {
                count:    vi.fn(),
                findMany: vi.fn(),
            },
            prescriptions: {
                count:    vi.fn(),
            },
            prescription_medications: {
                count:    vi.fn(),
                findMany: vi.fn(),
            },
            audit_logs: {
                findMany: vi.fn(),
                count:    vi.fn(),
            }
        }
    };
});

vi.mock('../../src/config/prisma.js', () => ({ default: viPrismaMock }));

const { StatsService } = await import('../../src/modules/stats/stats.service.js');

let service;

beforeEach(() => {
    vi.clearAllMocks();
    service = new StatsService();
});


describe('getClinicStats', () => {
    it('should return aggregated counts for clinic statistics', async () => {
        viPrismaMock.users.count.mockResolvedValueOnce(50);
        viPrismaMock.users.count.mockResolvedValueOnce(15);
        viPrismaMock.prescriptions.count.mockResolvedValue(25);
        viPrismaMock.prescription_medications.count.mockResolvedValueOnce(120);
        viPrismaMock.prescription_medications.count.mockResolvedValueOnce(10);

        const result = await service.getClinicStats();

        expect(result).toEqual({
            activePatients: 50,
            medicalStaff: 15,
            treatmentPlans: 25,
            deviceTriggers: 120,
            missedAppointments: 10
        });
    });
});

describe('getDoctorStats', () => {
    it('should calculate and map statistics correctly for each doctor', async () => {
        const mockDoctors = [
            {
                first_name: 'Gregory',
                last_name: 'House',
                avatar: 'house.png',
                medical_staff: { specialization: 'Diagnostics' },
                prescriptions_prescriptions_doctor_idTousers: [
                    {
                        prescription_medications: [
                            { intake_status: true, intake_at: new Date('2026-12-31') },
                            { intake_status: false, intake_at: new Date('2026-12-31') },
                            { intake_status: true, intake_at: new Date('2020-01-01') },
                            { intake_status: null, intake_at: new Date('2026-12-31') }
                        ]
                    }
                ]
            }
        ];

        viPrismaMock.users.findMany.mockResolvedValue(mockDoctors);

        const result = await service.getDoctorStats();

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({
            name: 'House Gregory',
            avatar: 'house.png',
            specialization: 'Diagnostics',
            patients: 1,
            active: 3,
            intakeRate: 67
        });
    });

    it('should return null intakeRate if doctor has no status tracking data', async () => {
        const mockDoctors = [
            {
                first_name: 'John',
                last_name: 'Doe',
                avatar: null,
                medical_staff: null,
                prescriptions_prescriptions_doctor_idTousers: []
            }
        ];

        viPrismaMock.users.findMany.mockResolvedValue(mockDoctors);
        const result = await service.getDoctorStats();

        expect(result[0].intakeRate).toBeNull();
        expect(result[0].specialization).toBeNull();
    });
});

describe('getIntakeWeekStats', () => {
    it('should structure days correctly and filter intake results per day', async () => {
        // Заморожуємо час на 3 червня 2026 (Середа)
        const mockCurrentTime = new Date(Date.UTC(2026, 5, 3, 12, 0, 0));
        vi.setSystemTime(mockCurrentTime);

        viPrismaMock.prescription_medications.findMany.mockResolvedValue([
            { intake_at: new Date(Date.UTC(2026, 5, 1, 10, 0)), intake_status: true },
            { intake_at: new Date(Date.UTC(2026, 5, 1, 15, 0)), intake_status: true },
            { intake_at: new Date(Date.UTC(2026, 5, 2, 9, 0)),  intake_status: false },
        ]);

        const result = await service.getIntakeWeekStats(0);

        expect(result.weekOffset).toBe(0);
        expect(result.days).toHaveLength(7);

        expect(result.days[0]).toEqual({
            day: 'Mon',
            date: '2026-06-01',
            taken: 2,
            missed: 0
        });

        expect(result.days[1]).toEqual({
            day: 'Tue',
            date: '2026-06-02',
            taken: 0,
            missed: 1
        });

        vi.useRealTimers();
    });
});

describe('getAuditLog', () => {
    it('should fetch paginated audit logs with mapped user attributes', async () => {
        const mockLogs = [
            {
                id: 1,
                action: 'LOGIN',
                entity: 'USER',
                entity_id: 12,
                description: 'User logged in',
                ip_address: '192.168.1.1',
                created_at: new Date('2026-06-01T10:00:00.000Z'),
                users: {
                    first_name: 'Admin',
                    last_name: 'Main',
                    avatar: 'admin.jpg',
                    roles: { role_name: 'SuperAdmin' }
                }
            }
        ];

        viPrismaMock.audit_logs.findMany.mockResolvedValue(mockLogs);
        viPrismaMock.audit_logs.count.mockResolvedValue(1);

        const result = await service.getAuditLog({ limit: 10, page: 1 });

        expect(result.total).toBe(1);
        expect(result.page).toBe(1);
        expect(result.pages).toBe(1);
        expect(result.logs[0]).toEqual({
            id: 1,
            action: 'LOGIN',
            entity: 'USER',
            entity_id: 12,
            description: 'User logged in',
            ip_address: '192.168.1.1',
            created_at: '2026-06-01T10:00:00.000Z',
            user: {
                name: 'Main Admin',
                avatar: 'admin.jpg',
                role: 'SuperAdmin'
            }
        });
    });

    it('should handle logs without user relations safely', async () => {
        viPrismaMock.audit_logs.findMany.mockResolvedValue([
            { id: 2, action: 'SYSTEM_REBOOT', users: null, created_at: null }
        ]);
        viPrismaMock.audit_logs.count.mockResolvedValue(1);

        const result = await service.getAuditLog();
        expect(result.logs[0].user).toBeNull();
        expect(result.logs[0].created_at).toBeNull();
    });
});

describe('getAuditActions', () => {
    it('should extract a flat sorted list of unique action strings', async () => {
        viPrismaMock.audit_logs.findMany.mockResolvedValue([
            { action: 'CREATE' },
            { action: 'DELETE' },
            { action: 'UPDATE' }
        ]);

        const result = await service.getAuditActions();

        expect(viPrismaMock.audit_logs.findMany).toHaveBeenCalledWith({
            select: { action: true },
            distinct: ['action'],
            orderBy: { action: 'asc' }
        });
        expect(result).toEqual(['CREATE', 'DELETE', 'UPDATE']);
    });
});

it('returns 100% intakeRate when all medications taken', async () => {
    viPrismaMock.users.findMany.mockResolvedValue([{
        first_name: 'John', last_name: 'Doe', avatar: null, medical_staff: null,
        prescriptions_prescriptions_doctor_idTousers: [{
            prescription_medications: [
                { intake_status: true, intake_at: new Date('2026-12-31') },
                { intake_status: true, intake_at: new Date('2026-12-31') },
            ]
        }]
    }]);
    const result = await service.getDoctorStats();
    expect(result[0].intakeRate).toBe(100);
});

it('shifts dates correctly for weekOffset=-1 (previous week)', async () => {
    vi.setSystemTime(new Date(Date.UTC(2026, 5, 3, 12, 0, 0)));
    viPrismaMock.prescription_medications.findMany.mockResolvedValue([]);
    const result = await service.getIntakeWeekStats(-1);
    expect(result.days[0].date).toBe('2026-05-25');
    expect(result.days[6].date).toBe('2026-05-31');
    vi.useRealTimers();
});

it('calculates pages correctly for multiple pages', async () => {
    viPrismaMock.audit_logs.findMany.mockResolvedValue([]);
    viPrismaMock.audit_logs.count.mockResolvedValue(25);
    const result = await service.getAuditLog({ limit: 10, page: 1 });
    expect(result.pages).toBe(3);
});

it('passes action filter to prisma when provided', async () => {
    viPrismaMock.audit_logs.findMany.mockResolvedValue([]);
    viPrismaMock.audit_logs.count.mockResolvedValue(0);
    await service.getAuditLog({ action: 'LOGIN' });
    expect(viPrismaMock.audit_logs.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { action: 'LOGIN' } })
    );
});