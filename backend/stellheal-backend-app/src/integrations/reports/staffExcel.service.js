import ExcelJS from 'exceljs';

export const generateStaffExcel = async (doctors, nurses) => {

    const formatDate = (val) => {
        if (!val) return '—';
        return new Date(val).toLocaleDateString('uk-UA', {
            day: '2-digit', month: '2-digit', year: 'numeric'
        });
    };

    const formatDateTime = (val) => {
        if (!val) return '—';
        return new Date(val).toLocaleString('uk-UA', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    };

    const calcAge = (dob) => {
        if (!dob) return '—';
        return Math.floor((Date.now() - new Date(dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25));
    };

    const calcExperience = (admissionDate) => {
        if (!admissionDate) return '—';
        const years = Math.floor((Date.now() - new Date(admissionDate).getTime()) / (1000 * 60 * 60 * 24 * 365.25));
        if (years === 0) return 'менше року';
        return `${years} р.`;
    };

    const now = new Date();

    const COLORS = {
        titleBg:     'FF0D47A1',
        doctorBg:    'FF1565C0',
        nurseBg:     'FF00695C',
        subHeaderBg: 'FFE3F2FD',
        nurseSubBg:  'FFE0F2F1',
        altRow:      'FFF5F5F5',
        white:       'FFFFFFFF',
        gray:        'FF9E9E9E',
        border:      'FFB0BEC5',
        yellow:      'FFFFF9C4',
    };

    const border = () => ({
        top:    { style: 'thin', color: { argb: COLORS.border } },
        left:   { style: 'thin', color: { argb: COLORS.border } },
        bottom: { style: 'thin', color: { argb: COLORS.border } },
        right:  { style: 'thin', color: { argb: COLORS.border } },
    });

    const fill = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });

    const workbook = new ExcelJS.Workbook();

    // АРКУШ 1: Зведений список
    const sheet = workbook.addWorksheet('Список працівників');
    sheet.columns = [
        { width: 6  },
        { width: 28 },
        { width: 8  },
        { width: 14 },
        { width: 24 },
        { width: 18 },
        { width: 22 },
        { width: 14 },
        { width: 12 },
        { width: 14 },
    ];

    sheet.mergeCells('A1:J1');
    const t1 = sheet.getCell('A1');
    t1.value     = 'ЗВІТ ПРО МЕДИЧНИХ ПРАЦІВНИКІВ';
    t1.font      = { size: 16, bold: true, color: { argb: COLORS.white } };
    t1.alignment = { horizontal: 'center', vertical: 'middle' };
    t1.fill      = fill(COLORS.titleBg);
    sheet.getRow(1).height = 36;

    sheet.mergeCells('A2:J2');
    const t2 = sheet.getCell('A2');
    t2.value     = `Дата формування: ${formatDateTime(now)}   |   Лікарів: ${doctors.length}   |   Медперсоналу: ${nurses.length}   |   Всього: ${doctors.length + nurses.length}`;
    t2.font      = { size: 10, italic: true, color: { argb: COLORS.gray } };
    t2.alignment = { horizontal: 'left', vertical: 'middle' };
    t2.fill      = fill(COLORS.subHeaderBg);
    sheet.getRow(2).height = 20;

    sheet.addRow([]);

    const colHeaders = ['№', 'ПІБ', 'Вік', 'Дата народження', 'Email', 'Телефон', 'Спеціалізація', 'Зміна', 'Стаж', 'Дата прийому'];

    const addSectionHeader = (ws, label, color) => {
        ws.addRow([]);
        ws.mergeCells(`A${ws.lastRow.number}:J${ws.lastRow.number}`);
        const sRow = ws.lastRow;
        sRow.getCell(1).value     = label;
        sRow.getCell(1).font      = { bold: true, size: 13, color: { argb: COLORS.white } };
        sRow.getCell(1).fill      = fill(color);
        sRow.getCell(1).alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
        sRow.getCell(1).border    = border();
        sRow.height               = 26;
    };

    const addColHeaders = (ws, color) => {
        const hRow = ws.addRow(colHeaders);
        hRow.height = 24;
        hRow.eachCell(cell => {
            cell.font      = { bold: true, size: 10, color: { argb: COLORS.white } };
            cell.fill      = fill(color);
            cell.border    = border();
            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        });
    };

    const addPersonRow = (ws, person, idx, altColor) => {
        const fullName = `${person.last_name} ${person.first_name} ${person.patronymic || ''}`.trim();
        const row = ws.addRow([
            idx + 1,
            fullName,
            calcAge(person.date_of_birth),
            formatDate(person.date_of_birth),
            person.login,
            person.phone || '—',
            person.medical_staff?.specialization || '—',
            person.medical_staff?.shift || '—',
            calcExperience(person.medical_staff?.admission_date),
            formatDate(person.medical_staff?.admission_date),
        ]);
        row.height = 20;
        const rowFill = idx % 2 === 0 ? COLORS.white : altColor;
        row.eachCell(cell => {
            cell.border    = border();
            cell.fill      = fill(rowFill);
            cell.font      = { size: 10 };
            cell.alignment = { vertical: 'middle', wrapText: true };
        });
        [1, 3, 4, 8, 9, 10].forEach(c => {
            row.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' };
        });
        return row;
    };

    // Лікарі
    addSectionHeader(sheet, `👨‍⚕️  ЛІКАРІ  (${doctors.length})`, COLORS.doctorBg);
    addColHeaders(sheet, COLORS.doctorBg);
    doctors.forEach((d, i) => addPersonRow(sheet, d, i, COLORS.subHeaderBg));

    // Медперсонал
    addSectionHeader(sheet, `🩺  МЕДПЕРСОНАЛ  (${nurses.length})`, COLORS.nurseBg);
    addColHeaders(sheet, COLORS.nurseBg);
    nurses.forEach((n, i) => addPersonRow(sheet, n, i, COLORS.nurseSubBg));

    // ── АРКУШ 2: Лікарі детально
    const docSheet = workbook.addWorksheet('Лікарі');
    docSheet.columns = [
        { width: 6  }, { width: 28 }, { width: 8  }, { width: 16 },
        { width: 26 }, { width: 18 }, { width: 36 }, { width: 22 },
        { width: 14 }, { width: 14 },
    ];

    docSheet.mergeCells('A1:J1');
    const d1 = docSheet.getCell('A1');
    d1.value     = 'ЛІКАРІ — ДЕТАЛЬНА ІНФОРМАЦІЯ';
    d1.font      = { size: 14, bold: true, color: { argb: COLORS.white } };
    d1.alignment = { horizontal: 'center', vertical: 'middle' };
    d1.fill      = fill(COLORS.doctorBg);
    docSheet.getRow(1).height = 30;

    docSheet.addRow([]);
    addColHeaders(docSheet, COLORS.doctorBg);

    doctors.forEach((d, i) => {
        const row = addPersonRow(docSheet, d, i, COLORS.subHeaderBg);
        // Додаємо адресу в окремий рядок якщо є
        if (d.contact_info) {
            const aRow = docSheet.addRow(['', `   📍 ${d.contact_info}`]);
            aRow.getCell(2).font      = { size: 9, italic: true, color: { argb: COLORS.gray } };
            aRow.getCell(2).alignment = { vertical: 'middle' };
            aRow.height               = 16;
        }
    });

    // АРКУШ 3: Медперсонал детально
    const nurseSheet = workbook.addWorksheet('Медперсонал');
    nurseSheet.columns = [
        { width: 6  }, { width: 28 }, { width: 8  }, { width: 16 },
        { width: 26 }, { width: 18 }, { width: 36 }, { width: 22 },
        { width: 14 }, { width: 14 },
    ];

    nurseSheet.mergeCells('A1:J1');
    const n1 = nurseSheet.getCell('A1');
    n1.value     = 'МЕДПЕРСОНАЛ — ДЕТАЛЬНА ІНФОРМАЦІЯ';
    n1.font      = { size: 14, bold: true, color: { argb: COLORS.white } };
    n1.alignment = { horizontal: 'center', vertical: 'middle' };
    n1.fill      = fill(COLORS.nurseBg);
    nurseSheet.getRow(1).height = 30;

    nurseSheet.addRow([]);
    addColHeaders(nurseSheet, COLORS.nurseBg);

    nurses.forEach((n, i) => {
        addPersonRow(nurseSheet, n, i, COLORS.nurseSubBg);
        if (n.contact_info) {
            const aRow = nurseSheet.addRow(['', `   📍 ${n.contact_info}`]);
            aRow.getCell(2).font      = { size: 9, italic: true, color: { argb: COLORS.gray } };
            aRow.getCell(2).alignment = { vertical: 'middle' };
            aRow.height               = 16;
        }
    });

    // АРКУШ 4: Статистика
    const stats = workbook.addWorksheet('Статистика');
    stats.columns = [{ width: 35 }, { width: 15 }];

    stats.mergeCells('A1:B1');
    const s1 = stats.getCell('A1');
    s1.value     = 'ЗАГАЛЬНА СТАТИСТИКА';
    s1.font      = { size: 14, bold: true, color: { argb: COLORS.white } };
    s1.alignment = { horizontal: 'center', vertical: 'middle' };
    s1.fill      = fill(COLORS.titleBg);
    stats.getRow(1).height = 30;

    stats.addRow([]);

    const specMap = {};
    doctors.forEach(d => {
        const spec = d.medical_staff?.specialization || 'Не вказано';
        specMap[spec] = (specMap[spec] || 0) + 1;
    });

    const shiftMap = {};
    nurses.forEach(n => {
        const shift = n.medical_staff?.shift || 'Не вказано';
        shiftMap[shift] = (shiftMap[shift] || 0) + 1;
    });

    const addStatRow = (label, value, headerColor = null) => {
        const sRow = stats.addRow([label, value]);
        sRow.height = 22;
        if (headerColor) {
            sRow.eachCell(cell => {
                cell.font      = { bold: true, size: 11, color: { argb: COLORS.white } };
                cell.fill      = fill(headerColor);
                cell.border    = border();
                cell.alignment = { vertical: 'middle' };
            });
        } else {
            sRow.getCell(1).font      = { size: 11 };
            sRow.getCell(1).fill      = fill(COLORS.subHeaderBg);
            sRow.getCell(1).border    = border();
            sRow.getCell(1).alignment = { vertical: 'middle' };
            sRow.getCell(2).font      = { size: 11, bold: true };
            sRow.getCell(2).fill      = fill(COLORS.white);
            sRow.getCell(2).border    = border();
            sRow.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
        }
    };

    addStatRow('ЗАГАЛЬНІ ДАНІ', '', COLORS.titleBg);
    addStatRow('Всього працівників', doctors.length + nurses.length);
    addStatRow('Лікарів', doctors.length);
    addStatRow('Медперсоналу', nurses.length);

    stats.addRow([]);
    addStatRow('СПЕЦІАЛІЗАЦІЇ ЛІКАРІВ', '', COLORS.doctorBg);
    Object.entries(specMap).forEach(([spec, count]) => addStatRow(spec, count));

    stats.addRow([]);
    addStatRow('ЗМІНИ МЕДПЕРСОНАЛУ', '', COLORS.nurseBg);
    Object.entries(shiftMap).forEach(([shift, count]) => addStatRow(shift, count));

    return await workbook.xlsx.writeBuffer();
};