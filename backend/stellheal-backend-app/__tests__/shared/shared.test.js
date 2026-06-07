import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppError } from '../../src/shared/errors/AppError.js';

describe('AppError', () => {

    it('extends Error', () => {
        const err = new AppError('CODE', 'message', 400);
        expect(err).toBeInstanceOf(Error);
        expect(err).toBeInstanceOf(AppError);
    });

    it('sets code, message and status', () => {
        const err = new AppError('NOT_FOUND', 'Resource not found', 404);
        expect(err.code).toBe('NOT_FOUND');
        expect(err.message).toBe('Resource not found');
        expect(err.status).toBe(404);
    });

    it('defaults status to 400 when not provided', () => {
        const err = new AppError('BAD_REQUEST', 'Bad input');
        expect(err.status).toBe(400);
    });

    it('defaults details to null when not provided', () => {
        const err = new AppError('ERR', 'msg', 500);
        expect(err.details).toBeNull();
    });

    it('stores details when provided', () => {
        const details = { field: 'email', reason: 'invalid' };
        const err = new AppError('VALIDATION', 'Validation failed', 422, details);
        expect(err.details).toEqual(details);
    });
});

const { viPrismaMock } = vi.hoisted(() => ({
    viPrismaMock: {
        users:      { findUnique: vi.fn() },
        audit_logs: { create:     vi.fn() },
    }
}));

vi.mock('../../src/config/prisma.js', () => ({ default: viPrismaMock }));

const {
    getUserTimezone,
    getStartOfDayInTz,
    utcToLocalTime,
    localToUtc,
    utcToLocalDate,
} = await import('../../src/shared/timezone/timezone.service.js');

describe('getUserTimezone', () => {

    beforeEach(() => vi.clearAllMocks());

    it('returns timezone from DB when user exists', async () => {
        viPrismaMock.users.findUnique.mockResolvedValue({ timezone: 'Europe/Kyiv' });
        const result = await getUserTimezone(1);
        expect(result).toBe('Europe/Kyiv');
    });

    it('returns "UTC" when user not found', async () => {
        viPrismaMock.users.findUnique.mockResolvedValue(null);
        const result = await getUserTimezone(999);
        expect(result).toBe('UTC');
    });

    it('returns "UTC" when timezone field is null', async () => {
        viPrismaMock.users.findUnique.mockResolvedValue({ timezone: null });
        const result = await getUserTimezone(1);
        expect(result).toBe('UTC');
    });
});

describe('getStartOfDayInTz', () => {

    it('returns a Date object', () => {
        const result = getStartOfDayInTz('Europe/Kyiv');
        expect(result).toBeInstanceOf(Date);
    });

    it('returns midnight UTC for UTC timezone', () => {
        const result = getStartOfDayInTz('UTC');
        expect(result.toISOString()).toMatch(/T00:00:00\.000Z$/);
    });
});

describe('utcToLocalTime', () => {

    it('converts UTC date to local HH:mm string', () => {
        const utc = new Date('2026-06-01T10:00:00.000Z');
        const result = utcToLocalTime(utc, 'Europe/Kyiv');
        expect(result).toMatch(/^\d{2}:\d{2}$/);
    });

    it('returns "00:00" for midnight UTC in UTC timezone', () => {
        const utc = new Date('2026-06-01T00:00:00.000Z');
        expect(utcToLocalTime(utc, 'UTC')).toBe('00:00');
    });

    it('returns correct time for UTC timezone', () => {
        const utc = new Date('2026-06-01T14:30:00.000Z');
        expect(utcToLocalTime(utc, 'UTC')).toBe('14:30');
    });

    it('returns correct time for New York timezone (UTC-4 summer)', () => {
        const utc = new Date('2026-06-01T16:00:00.000Z');
        expect(utcToLocalTime(utc, 'America/New_York')).toBe('12:00');
    });
});

describe('localToUtc', () => {

    it('converts local date+time to UTC Date', () => {
        const result = localToUtc('2026-06-01', '12:00', 'UTC');
        expect(result).toBeInstanceOf(Date);
        expect(result.toISOString()).toBe('2026-06-01T12:00:00.000Z');
    });

    it('converts Kyiv local time to UTC correctly (UTC+3 summer)', () => {
        const result = localToUtc('2026-06-01', '15:00', 'Europe/Kyiv');
        expect(result.toISOString()).toBe('2026-06-01T12:00:00.000Z');
    });

    it('returns a Date object', () => {
        expect(localToUtc('2026-01-01', '08:00', 'UTC')).toBeInstanceOf(Date);
    });
});

describe('utcToLocalDate', () => {

    it('returns date string in yyyy-MM-dd format', () => {
        const utc = new Date('2026-06-01T12:00:00.000Z');
        expect(utcToLocalDate(utc, 'UTC')).toBe('2026-06-01');
    });

    it('shifts date forward for timezone ahead of UTC', () => {
        const utc = new Date('2026-06-01T23:00:00.000Z');
        expect(utcToLocalDate(utc, 'Europe/Kyiv')).toBe('2026-06-02');
    });

    it('shifts date back for timezone behind UTC', () => {
        const utc = new Date('2026-06-01T02:00:00.000Z');
        expect(utcToLocalDate(utc, 'America/Chicago')).toBe('2026-05-31');
    });
});

const { logAction } = await import('../../src/shared/logger/auditLogger.js');

describe('logAction', () => {

    beforeEach(() => vi.clearAllMocks());

    it('creates audit log with correct fields', async () => {
        viPrismaMock.audit_logs.create.mockResolvedValue({});
        await logAction({
            userId:      1,
            action:      'LOGIN',
            entity:      'USER',
            entityId:    5,
            description: 'User logged in',
            req:         { ip: '127.0.0.1' }
        });

        expect(viPrismaMock.audit_logs.create).toHaveBeenCalledWith({
            data: {
                user_id:     1,
                action:      'LOGIN',
                entity:      'USER',
                entity_id:   5,
                description: 'User logged in',
                metadata:    undefined,
                ip_address:  '127.0.0.1',
            }
        });
    });

    it('stores null for userId and ip when not provided', async () => {
        viPrismaMock.audit_logs.create.mockResolvedValue({});
        await logAction({ action: 'SYSTEM', entity: 'APP', req: null });

        const call = viPrismaMock.audit_logs.create.mock.calls[0][0];
        expect(call.data.user_id).toBeNull();
        expect(call.data.ip_address).toBeNull();
    });

    it('does not throw when prisma fails (swallows error)', async () => {
        viPrismaMock.audit_logs.create.mockRejectedValue(new Error('DB error'));

        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        await expect(
            logAction({ action: 'TEST', entity: 'TEST', req: null })
        ).resolves.not.toThrow();

        consoleSpy.mockRestore();
    });
});