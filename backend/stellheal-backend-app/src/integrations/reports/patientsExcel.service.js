import ExcelJS from 'exceljs';

export const generatePatientsExcel = async (patients) => {
    const workbook = new ExcelJS.Workbook();

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
        const diff = Date.now() - new Date(dob).getTime();
        return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
    };

    const now = new Date();

    const COLORS = {
        titleBg:     'FF0D47A1',
        headerBg:    'FF1565C0',
        subHeaderBg: 'FFE3F2FD',
        altRow:      'FFF5F5F5',
        white:       'FFFFFFFF',
        gray:        'FF9E9E9E',
        darkText:    'FF212121',
        green:       'FFE8F5E9',
        yellow:      'FFFFF9C4',
        border:      'FFB0BEC5',
    };

    const border = () => ({
        top:    { style: 'thin', color: { argb: COLORS.border } },
        left:   { style: 'thin', color: { argb: COLORS.border } },
        bottom: { style: 'thin', color: { argb: COLORS.border } },
        right:  { style: 'thin', color: { argb: COLORS.border } },
    });

    const fill = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });

    // ════════════════════════════════════════════════════════════════════════
    // ── АРКУШ 1: Список пацієнтів ───────────────────────────────────────────
    // ════════════════════════════════════════════════════════════════════════
    const sheet = workbook.addWorksheet('Список пацієнтів');
    sheet.columns = [
        { width: 6  },  // №
        { width: 30 },  // ПІБ
        { width: 8  },  // Вік
        { width: 16 },  // Дата народження
        { width: 26 },  // Email (login)
        { width: 18 },  // Телефон
        { width: 30 },  // Адреса
        { width: 10 },  // Активних призначень
        { width: 12 },  // Палата
    ];

    // Заголовок
    sheet.mergeCells('A1:I1');
    const t1 = sheet.getCell('A1');
    t1.value     = 'ЗВІТ ПРО ЗАРЕЄСТРОВАНИХ ПАЦІЄНТІВ';
    t1.font      = { size: 16, bold: true, color: { argb: COLORS.white } };
    t1.alignment = { horizontal: 'center', vertical: 'middle' };
    t1.fill      = fill(COLORS.titleBg);
    sheet.getRow(1).height = 36;

    // Підзаголовок
    sheet.mergeCells('A2:I2');
    const t2 = sheet.getCell('A2');
    t2.value     = `Дата формування: ${formatDateTime(now)}   |   Всього пацієнтів: ${patients.length}`;
    t2.font      = { size: 10, italic: true, color: { argb: COLORS.gray } };
    t2.alignment = { horizontal: 'left', vertical: 'middle' };
    t2.fill      = fill(COLORS.subHeaderBg);
    sheet.getRow(2).height = 20;

    sheet.addRow([]);

    // Заголовки колонок
    const headers = ['№', 'ПІБ', 'Вік', 'Дата народження', 'Email', 'Телефон', 'Адреса', 'Призначень', 'Палата'];
    const hRow = sheet.addRow(headers);
    hRow.height = 28;
    hRow.eachCell(cell => {
        cell.font      = { bold: true, size: 11, color: { argb: COLORS.white } };
        cell.fill      = fill(COLORS.headerBg);
        cell.border    = border();
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    });

    // Дані
    patients.forEach((p, idx) => {
        const fullName    = `${p.last_name} ${p.first_name} ${p.patronymic || ''}`.trim();
        const age         = calcAge(p.date_of_birth);
        const activePres  = p.prescriptions_prescriptions_patient_idTousers?.filter(
            pr => pr.end_date && new Date(pr.end_date) >= now
        ).length ?? 0;

        // Поточна палата з активного призначення
        const activePrescription = p.prescriptions_prescriptions_patient_idTousers?.find(
            pr => pr.end_date && new Date(pr.end_date) >= now
        );
        const ward = activePrescription?.wards?.ward_number || '—';

        const row = sheet.addRow([
            idx + 1,
            fullName,
            age,
            formatDate(p.date_of_birth),
            p.login,
            p.phone || '—',
            p.contact_info || '—',
            activePres,
            ward,
        ]);

        row.height    = 20;
        const rowFill = idx % 2 === 0 ? COLORS.white : COLORS.altRow;
        row.eachCell(cell => {
            cell.border    = border();
            cell.fill      = fill(rowFill);
            cell.font      = { size: 10 };
            cell.alignment = { vertical: 'middle', wrapText: true };
        });
        [1, 3, 4, 8, 9].forEach(c => {
            row.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' };
        });

        // Підсвітити якщо є активне призначення
        if (activePres > 0) {
            row.getCell(8).fill = fill(COLORS.green);
            row.getCell(8).font = { bold: true, size: 10 };
        }
    });

    // ════════════════════════════════════════════════════════════════════════
    // ── АРКУШ 2: Деталі по пацієнтах ────────────────────────────────────────
    // ════════════════════════════════════════════════════════════════════════
    const details = workbook.addWorksheet('Деталі');
    details.columns = [
        { width: 6  },  // №
        { width: 28 },  // ПІБ
        { width: 8  },  // Вік
        { width: 20 },  // Email
        { width: 16 },  // Телефон
        { width: 14 },  // Дата призначення
        { width: 28 },  // Діагноз
        { width: 10 },  // Палата
        { width: 12 },  // Статус призначення
    ];

    details.mergeCells('A1:I1');
    const d1 = details.getCell('A1');
    d1.value     = 'ДЕТАЛІ ПАЦІЄНТІВ ТА ЇХ ПРИЗНАЧЕНЬ';
    d1.font      = { size: 14, bold: true, color: { argb: COLORS.white } };
    d1.alignment = { horizontal: 'center', vertical: 'middle' };
    d1.fill      = fill(COLORS.titleBg);
    details.getRow(1).height = 30;

    details.addRow([]);

    patients.forEach((p, idx) => {
        const fullName = `${p.last_name} ${p.first_name} ${p.patronymic || ''}`.trim();
        const age      = calcAge(p.date_of_birth);
        const pres     = p.prescriptions_prescriptions_patient_idTousers || [];

        // Заголовок пацієнта
        const pRow = details.addRow([
            idx + 1,
            fullName,
            `${age} р.`,
            p.login,
            p.phone || '—',
            `Нар.: ${formatDate(p.date_of_birth)}`,
            `Адреса: ${p.contact_info || '—'}`,
            '',
            `Призначень: ${pres.length}`,
        ]);
        pRow.height = 24;
        pRow.eachCell(cell => {
            cell.fill   = fill(COLORS.subHeaderBg);
            cell.font   = { bold: true, size: 11 };
            cell.border = border();
            cell.alignment = { vertical: 'middle', wrapText: true };
        });

        if (pres.length === 0) {
            const noRow = details.addRow(['', '', 'Призначень немає', '', '', '', '', '', '']);
            noRow.getCell(3).font      = { italic: true, color: { argb: COLORS.gray } };
            noRow.getCell(3).alignment = { horizontal: 'left', vertical: 'middle' };
            noRow.height = 18;
        } else {
            // Заголовки призначень
            const phRow = details.addRow(['', '№', 'Діагноз', 'Код МКХ', 'Дата від', 'Дата до', 'Палата', 'Лікар', 'Статус']);
            phRow.height = 20;
            phRow.eachCell(cell => {
                cell.font      = { bold: true, size: 10, color: { argb: COLORS.white } };
                cell.fill      = fill('FF1976D2');
                cell.border    = border();
                cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            });

            pres
                .sort((a, b) => new Date(b.date_issued) - new Date(a.date_issued))
                .forEach((pr, prIdx) => {
                    const isActive  = pr.end_date && new Date(pr.end_date) >= now;
                    const status    = isActive ? '✓ Активне' : '— Завершено';
                    const doctorName = `${pr.users_prescriptions_doctor_idTousers?.last_name || ''} ${pr.users_prescriptions_doctor_idTousers?.first_name?.charAt(0) || ''}.`.trim();

                    const prRow = details.addRow([
                        '',
                        prIdx + 1,
                        pr.diagnosis || '—',
                        pr.icd_code  || '—',
                        formatDate(pr.date_issued),
                        formatDate(pr.end_date),
                        pr.wards?.ward_number || '—',
                        doctorName,
                        status,
                    ]);

                    const prFill = isActive ? COLORS.green : COLORS.altRow;
                    prRow.height = 18;
                    prRow.eachCell(cell => {
                        cell.border    = border();
                        cell.fill      = fill(prFill);
                        cell.font      = { size: 10 };
                        cell.alignment = { vertical: 'middle', wrapText: true };
                    });
                    [2, 5, 6, 7, 9].forEach(c => {
                        prRow.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' };
                    });
                });
        }

        details.addRow([]);
    });

    // ════════════════════════════════════════════════════════════════════════
    // ── АРКУШ 3: Загальна статистика ────────────────────────────────────────
    // ════════════════════════════════════════════════════════════════════════
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

    const totalPatients  = patients.length;
    const activePatients = patients.filter(p =>
        p.prescriptions_prescriptions_patient_idTousers?.some(
            pr => pr.end_date && new Date(pr.end_date) >= now
        )
    ).length;
    const totalPres = patients.reduce(
        (sum, p) => sum + (p.prescriptions_prescriptions_patient_idTousers?.length || 0), 0
    );
    const activePres = patients.reduce(
        (sum, p) => sum + (p.prescriptions_prescriptions_patient_idTousers?.filter(
            pr => pr.end_date && new Date(pr.end_date) >= now
        ).length || 0), 0
    );

    const statsRows = [
        ['Всього пацієнтів',                  totalPatients],
        ['Пацієнтів з активним призначенням', activePatients],
        ['Пацієнтів без призначень',           totalPatients - activePatients],
        ['', ''],
        ['Всього призначень',                 totalPres],
        ['Активних призначень',               activePres],
        ['Завершених призначень',             totalPres - activePres],
    ];

    statsRows.forEach(([label, value]) => {
        if (!label) { stats.addRow([]); return; }
        const sRow = stats.addRow([label, value]);
        sRow.height = 22;
        sRow.getCell(1).font      = { size: 11 };
        sRow.getCell(1).border    = border();
        sRow.getCell(1).fill      = fill(COLORS.subHeaderBg);
        sRow.getCell(1).alignment = { vertical: 'middle' };
        sRow.getCell(2).font      = { size: 11, bold: true };
        sRow.getCell(2).border    = border();
        sRow.getCell(2).fill      = fill(COLORS.white);
        sRow.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
    });

    return await workbook.xlsx.writeBuffer();
};