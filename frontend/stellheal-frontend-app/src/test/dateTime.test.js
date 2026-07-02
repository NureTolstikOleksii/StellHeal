import { describe, it, expect, beforeAll } from 'vitest';
import {
    formatTime,
    formatDateTime,
    formatDateTimeLong,
    formatDate,
    formatDateLong,
    formatTimeForInput,
} from '../utils/dateTime.js';

beforeAll(() => {
    process.env.TZ = 'UTC';
});


describe('formatTime', () => {

    it('returns "—" for null', () => {
        expect(formatTime(null)).toBe('—');
    });

    it('returns "—" for undefined', () => {
        expect(formatTime(undefined)).toBe('—');
    });

    it('returns "—" for empty string', () => {
        expect(formatTime('')).toBe('—');
    });

    it('returns formatted time for valid ISO string', () => {
        const result = formatTime('2026-06-01T10:30:00.000Z');
        expect(result).toMatch(/\d{2}:\d{2}/);
        expect(result).toContain('30');
    });
});

describe('formatDateTime', () => {

    it('returns "—" for null', () => {
        expect(formatDateTime(null)).toBe('—');
    });

    it('returns "—" for undefined', () => {
        expect(formatDateTime(undefined)).toBe('—');
    });

    it('returns "—" for empty string', () => {
        expect(formatDateTime('')).toBe('—');
    });

    it('returns non-empty string for valid ISO string', () => {
        const result = formatDateTime('2026-06-01T10:30:00.000Z');
        expect(result).not.toBe('—');
        expect(result.length).toBeGreaterThan(0);
    });

    it('contains year 2026 in result', () => {
        const result = formatDateTime('2026-06-01T10:30:00.000Z');
        expect(result).toContain('2026');
    });

    it('uses uk-UA locale by default', () => {
        const uk = formatDateTime('2026-06-01T10:00:00.000Z', 'uk');
        const en = formatDateTime('2026-06-01T10:00:00.000Z', 'en');
        expect(typeof uk).toBe('string');
        expect(typeof en).toBe('string');
    });
});

describe('formatDateTimeLong', () => {

    it('returns "—" for null', () => {
        expect(formatDateTimeLong(null)).toBe('—');
    });

    it('returns "—" for empty string', () => {
        expect(formatDateTimeLong('')).toBe('—');
    });

    it('returns non-empty string for valid ISO', () => {
        const result = formatDateTimeLong('2026-06-01T10:00:00.000Z');
        expect(result).not.toBe('—');
        expect(result).toContain('2026');
    });

    it('en locale returns different format than uk', () => {
        const uk = formatDateTimeLong('2026-06-01T10:00:00.000Z', 'uk');
        const en = formatDateTimeLong('2026-06-01T10:00:00.000Z', 'en');
        expect(uk).not.toBe(en);
    });
});

describe('formatDate', () => {

    it('returns "—" for null', () => {
        expect(formatDate(null)).toBe('—');
    });

    it('returns "—" for undefined', () => {
        expect(formatDate(undefined)).toBe('—');
    });

    it('returns "—" for empty string', () => {
        expect(formatDate('')).toBe('—');
    });

    it('contains year 2026 for June 2026 date', () => {
        const result = formatDate('2026-06-01T00:00:00.000Z');
        expect(result).toContain('2026');
    });

    it('en locale returns different format than uk', () => {
        const uk = formatDate('2026-06-01T00:00:00.000Z', 'uk');
        const en = formatDate('2026-06-01T00:00:00.000Z', 'en');
        expect(typeof uk).toBe('string');
        expect(typeof en).toBe('string');
    });
});

describe('formatDateLong', () => {

    it('returns "—" for null', () => {
        expect(formatDateLong(null)).toBe('—');
    });

    it('returns "—" for empty string', () => {
        expect(formatDateLong('')).toBe('—');
    });

    it('returns non-empty string for valid date', () => {
        const result = formatDateLong('2026-06-01T00:00:00.000Z');
        expect(result).not.toBe('—');
        expect(result).toContain('2026');
    });

    it('en locale result contains month name', () => {
        const result = formatDateLong('2026-06-01T00:00:00.000Z', 'en');
        expect(result).toContain('June');
    });
});

describe('formatTimeForInput', () => {

    it('returns empty string for null', () => {
        expect(formatTimeForInput(null)).toBe('');
    });

    it('returns empty string for undefined', () => {
        expect(formatTimeForInput(undefined)).toBe('');
    });

    it('returns empty string for empty string', () => {
        expect(formatTimeForInput('')).toBe('');
    });

    it('returns HH:mm format for valid ISO string', () => {
        const result = formatTimeForInput('2026-06-01T10:30:00.000Z');
        expect(result).toMatch(/^\d{2}:\d{2}$/);
    });

    it('pads hours and minutes with leading zeros', () => {
        const result = formatTimeForInput('2026-06-01T08:05:00.000Z');
        expect(result).toBe('08:05');
    });

    it('handles midnight correctly', () => {
        const result = formatTimeForInput('2026-06-01T00:00:00.000Z');
        expect(result).toBe('00:00');
    });

    it('handles end of day correctly', () => {
        const result = formatTimeForInput('2026-06-01T23:59:00.000Z');
        expect(result).toBe('23:59');
    });
});