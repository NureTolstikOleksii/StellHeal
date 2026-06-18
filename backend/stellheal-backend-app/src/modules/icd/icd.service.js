import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const raw = JSON.parse(readFileSync(join(__dirname, '../../shared/resources/icd_uk.json'), 'utf8'));

const ICD_DATA = raw.data.map(row => ({
    code: row[7],
    name: row[9],
    group: row[6],
})).filter(d => d.code && d.code !== '-' && d.name && d.name !== '-');

export const searchICD = async (query) => {
    const q = query.toLowerCase().trim();

    return ICD_DATA
        .filter(d =>
            d.code.toLowerCase().includes(q) ||
            d.name.toLowerCase().includes(q) ||
            d.group.toLowerCase().includes(q)
        )
        .slice(0, 10);
};