import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const raw = JSON.parse(readFileSync(join(__dirname, 'icd_uk.json'), 'utf8'));

// Конвертуємо в зручний формат при старті
const ICD_DATA = raw.data.map(row => ({
    code: row[7],  // A00.0
    name: row[9],  // Холера, спричинена...
    group: row[6], // Холера (назва групи)
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