import { describe, it, expect, vi } from 'vitest';


vi.mock('fs', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        readFileSync: vi.fn().mockReturnValue(JSON.stringify({
            data: [
                [null, null, null, null, null, null, 'Холера',    'A00.0', null, 'Холера, спричинена Vibrio cholerae'],
                [null, null, null, null, null, null, 'Холера',    'A00.1', null, 'Холера, спричинена Vibrio eltor'],
                [null, null, null, null, null, null, 'Туберкульоз', 'A15.0', null, 'Туберкульоз легень'],
                [null, null, null, null, null, null, 'Грип',      'J11',   null, 'Грип з невстановленим вірусом'],
                [null, null, null, null, null, null, 'Грип',      'J11.1', null, 'Грип з іншими респіраторними проявами'],
                [null, null, null, null, null, null, '-',         '-',     null, '-'],
                [null, null, null, null, null, null, 'Діабет',    'E11',   null, 'Цукровий діабет тип 2'],
                [null, null, null, null, null, null, 'Діабет',    'E11.0', null, 'Цукровий діабет тип 2 з комою'],
                [null, null, null, null, null, null, 'Діабет',    'E11.1', null, 'Цукровий діабет тип 2 з кетоацидозом'],
                [null, null, null, null, null, null, 'Діабет',    'E11.2', null, 'Цукровий діабет тип 2 з ускладненнями нирок'],
                [null, null, null, null, null, null, 'Діабет',    'E11.3', null, 'Цукровий діабет тип 2 з ускладненнями очей'],
                [null, null, null, null, null, null, 'Діабет',    'E11.4', null, 'Цукровий діабет тип 2 з неврологічними ускладненнями'],
            ]
        }))
    };
});

const { searchICD } = await import('../../src/modules/icd/icd.service.js');


describe('searchICD', () => {

    it('returns results matching by code', async () => {
        const result = await searchICD('A00');
        expect(result.length).toBeGreaterThan(0);
        expect(result.every(r => r.code.toLowerCase().includes('a00'))).toBe(true);
    });

    it('returns results matching by name', async () => {
        const result = await searchICD('туберкульоз');
        expect(result.length).toBeGreaterThan(0);
        expect(result[0].code).toBe('A15.0');
    });

    it('returns results matching by group name', async () => {
        const result = await searchICD('холера');
        expect(result.length).toBe(2);
        expect(result.every(r => r.group === 'Холера')).toBe(true);
    });

    it('search is case-insensitive', async () => {
        const upper  = await searchICD('ГРИП');
        const lower  = await searchICD('грип');
        const mixed  = await searchICD('Грип');
        expect(upper.length).toBe(lower.length);
        expect(upper.length).toBe(mixed.length);
        expect(upper.length).toBeGreaterThan(0);
    });

    it('returns maximum 10 results', async () => {
        const result = await searchICD('діабет');
        expect(result.length).toBeLessThanOrEqual(10);
    });

    it('returns empty array for no matches', async () => {
        const result = await searchICD('немає такого xyz');
        expect(result).toEqual([]);
    });

    it('filters out entries with code or name equal to "-"', async () => {
        const all = await searchICD('');
        expect(all.every(r => r.code !== '-' && r.name !== '-')).toBe(true);
    });

    it('returns correct shape for each result', async () => {
        const result = await searchICD('J11');
        expect(result.length).toBeGreaterThan(0);
        result.forEach(r => {
            expect(r).toHaveProperty('code');
            expect(r).toHaveProperty('name');
            expect(r).toHaveProperty('group');
        });
    });

    it('matches partial code search', async () => {
        const result = await searchICD('E11');
        expect(result.length).toBeGreaterThan(0);
        expect(result.every(r => r.code.startsWith('E11'))).toBe(true);
    });
});