import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const raw = JSON.parse(readFileSync(join(__dirname, '../../shared/resources/icd_uk.json'), 'utf8'));

const pick = (...vals) => {
    for (const v of vals) {
        if (v && v !== '-') return v;
    }
    return null;
};

const ICD_DATA = raw.data
    .map(row => ({
        code:  pick(row[7], row[4]),
        name:  pick(row[9], row[6]),
        group: pick(row[6], row[3]) || '',
        block: row[3] || '',
    }))
    .filter(d => d.code && d.name);

const seen = new Set();
const ICD_UNIQUE = ICD_DATA.filter(d => {
    if (seen.has(d.code)) return false;
    seen.add(d.code);
    return true;
});

export const searchICD = async (query) => {
    const q = (query || '').toLowerCase().trim();
    if (!q) return [];

    const matches = ICD_UNIQUE.filter(d =>
        d.code.toLowerCase().includes(q) ||
        d.name.toLowerCase().includes(q) ||
        (d.group && d.group.toLowerCase().includes(q)) ||
        (d.block && d.block.toLowerCase().includes(q))
    );

    matches.sort((a, b) => {
        const aExact = a.code.toLowerCase() === q ? 0 : 1;
        const bExact = b.code.toLowerCase() === q ? 0 : 1;
        if (aExact !== bExact) return aExact - bExact;
        return a.code.length - b.code.length;
    });

    return matches.slice(0, 10);
};