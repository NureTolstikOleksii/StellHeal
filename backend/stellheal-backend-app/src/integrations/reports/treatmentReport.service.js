import ExcelJS from 'exceljs';

export const generateTreatmentExcel = async (patient, prescriptions) => {
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

    const formatTime = (isoString) => {
        if (!isoString) return '—';
        return new Date(isoString).toLocaleTimeString('uk-UA', {
            hour: '2-digit', minute: '2-digit'
        });
    };

    const now = new Date();

    const COLORS = {
        headerBg:    'FF1565C0',
        subHeaderBg: 'FFE3F2FD',
        titleBg:     'FF0D47A1',
        takenBg:     'FFE8F5E9',
        missedBg:    'FFFCE4EC',
        pendingBg:   'FFFFF9C4',
        borderColor: 'FFB0BEC5',
        white:       'FFFFFFFF',
        gray:        'FF9E9E9E',
        darkText:    'FF212121',
    };

    const border = (color = COLORS.borderColor) => ({
        top:    { style: 'thin', color: { argb: color } },
        left:   { style: 'thin', color: { argb: color } },
        bottom: { style: 'thin', color: { argb: color } },
        right:  { style: 'thin', color: { argb: color } },
    });

    const fill = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });

    // ── АРКУШ 1: Зведений звіт
    const summary = workbook.addWorksheet('Зведений звіт');
    summary.columns = [
        { width: 5  },
        { width: 14 },
        { width: 14 },
        { width: 28 },
        { width: 8  },
        { width: 22 },
        { width: 10 },
        { width: 12 },
        { width: 42 },
    ];

    // Заголовок
    summary.mergeCells('A1:I1');
    const t1 = summary.getCell('A1');
    t1.value = 'ЗВІТ З ЛІКУВАННЯ ПАЦІЄНТА';
    t1.font      = { size: 16, bold: true, color: { argb: COLORS.white } };
    t1.alignment = { horizontal: 'center', vertical: 'middle' };
    t1.fill      = fill(COLORS.titleBg);
    summary.getRow(1).height = 36;

    // Інфо про пацієнта
    const patientName = `${patient.last_name} ${patient.first_name} ${patient.patronymic || ''}`.trim();
    const dob         = patient.date_of_birth ? formatDate(patient.date_of_birth) : '—';

    summary.mergeCells('A2:I2');
    const p2 = summary.getCell('A2');
    p2.value     = `Пацієнт: ${patientName}   |   Дата народження: ${dob}   |   Телефон: ${patient.phone || '—'}`;
    p2.font      = { size: 11, italic: true, color: { argb: COLORS.darkText } };
    p2.alignment = { horizontal: 'left', vertical: 'middle' };
    p2.fill      = fill(COLORS.subHeaderBg);
    summary.getRow(2).height = 22;

    summary.mergeCells('A3:I3');
    const p3 = summary.getCell('A3');
    p3.value     = `Дата формування звіту: ${formatDateTime(now)}   |   Всього призначень: ${prescriptions.length}`;
    p3.font      = { size: 10, italic: true, color: { argb: COLORS.gray } };
    p3.alignment = { horizontal: 'left', vertical: 'middle' };
    p3.fill      = fill(COLORS.subHeaderBg);
    summary.getRow(3).height = 20;

    summary.addRow([]);

    // Заголовки колонок
    const summaryHeaders = ['№', 'Дата призначення', 'Дата завершення', 'Діагноз', 'Палата', 'Лікар', 'Днів', 'Прийнято', 'Препарати'];
    const hRow = summary.addRow(summaryHeaders);
    hRow.height = 28;
    hRow.eachCell((cell, col) => {
        cell.font      = { bold: true, size: 11, color: { argb: COLORS.white } };
        cell.fill      = fill(COLORS.headerBg);
        cell.border    = border();
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    });

    // Дані
    prescriptions.forEach((p, idx) => {
        const total   = p.prescription_medications?.length || 0;
        const taken   = p.prescription_medications?.filter(pm => pm.intake_status === true).length  || 0;
        const missed  = p.prescription_medications?.filter(pm => pm.intake_status === false).length || 0;
        const rate    = total > 0 ? Math.round((taken / total) * 100) : 0;

        // препарати по medication_name
        const medSet  = new Set();
        const medList = [];
        (p.prescription_medications || []).forEach(pm => {
            const name = pm.medication_name || pm.medications?.name || 'Невідомо';
            const freq = pm.frequency || '—';
            const key  = `${name}__${freq}`;
            if (!medSet.has(key)) {
                medSet.add(key);
                medList.push(`${medList.length + 1}. ${name} — ${freq}`);
            }
        });

        const doctorName = `${p.users_prescriptions_doctor_idTousers?.last_name || ''} ${p.users_prescriptions_doctor_idTousers?.first_name || ''}`.trim();
        const wardNum    = p.wards?.ward_number || p.ward_id || '—';

        const row = summary.addRow([
            idx + 1,
            formatDate(p.date_issued),
            formatDate(p.end_date),
            p.diagnosis || '—',
            wardNum,
            doctorName,
            p.duration || 0,
            `${taken}/${total} (${rate}%)`,
            medList.join('\n'),
        ]);

        row.height    = Math.max(24, medList.length * 18);
        row.alignment = { vertical: 'top', wrapText: true };

        const rowFill = rate >= 80 ? COLORS.takenBg : rate >= 50 ? COLORS.pendingBg : total === 0 ? COLORS.white : COLORS.missedBg;
        row.eachCell(cell => {
            cell.border    = border();
            cell.alignment = { vertical: 'top', wrapText: true };
            cell.fill      = fill(rowFill);
        });
        [1, 2, 3, 5, 7, 8].forEach(c => {
            row.getCell(c).alignment = { horizontal: 'center', vertical: 'top', wrapText: true };
        });
    });

    // ── АРКУШ 2: Деталі по кожному призначенню
    const details = workbook.addWorksheet('Деталі призначень');
    details.columns = [
        { width: 5  },
        { width: 22 },
        { width: 12 },
        { width: 10 },
        { width: 12 },
        { width: 8  },
        { width: 10 },
        { width: 14 },
    ];

    prescriptions.forEach((p, pIdx) => {
        details.addRow([]);
        const presTitle = details.addRow([
            `Призначення №${pIdx + 1}`,
            `Дата: ${formatDate(p.date_issued)} — ${formatDate(p.end_date)}`,
            '',
            `Діагноз: ${p.diagnosis || '—'}`,
            '',
            '',
            `Палата: ${p.wards?.ward_number || '—'}`,
            `Лікар: ${p.users_prescriptions_doctor_idTousers?.last_name || ''} ${p.users_prescriptions_doctor_idTousers?.first_name || ''}`.trim(),
        ]);
        presTitle.getCell(1).font      = { bold: true, size: 12, color: { argb: COLORS.white } };
        presTitle.getCell(1).fill      = fill(COLORS.headerBg);
        presTitle.height               = 24;
        presTitle.eachCell(cell => {
            cell.fill   = fill(COLORS.headerBg);
            cell.font   = { bold: true, color: { argb: COLORS.white } };
            cell.border = border();
        });

        // Клінічна картина
        if (p.complaints || p.recommendations) {
            if (p.complaints) {
                const cRow = details.addRow(['', 'Скарги:', p.complaints]);
                cRow.getCell(2).font = { bold: true };
                cRow.getCell(3).alignment = { wrapText: true };
                cRow.height = Math.max(18, Math.ceil(p.complaints.length / 60) * 16);
            }
            if (p.recommendations) {
                const rRow = details.addRow(['', 'Рекомендації:', p.recommendations]);
                rRow.getCell(2).font = { bold: true };
                rRow.getCell(3).alignment = { wrapText: true };
                rRow.height = Math.max(18, Math.ceil(p.recommendations.length / 60) * 16);
            }
        }

        // Заголовки таблиці препаратів
        const medHeader = details.addRow(['№', 'Препарат', 'Частота', 'Днів', 'Час прийому (Київ)', 'Табл.', 'Статус', 'Дата прийому']);
        medHeader.height = 22;
        medHeader.eachCell(cell => {
            cell.font      = { bold: true, size: 10, color: { argb: COLORS.white } };
            cell.fill      = fill('FF1976D2');
            cell.border    = border();
            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        });

        // Рядки препаратів
        const meds = p.prescription_medications || [];
        meds
            .sort((a, b) => new Date(a.intake_at) - new Date(b.intake_at))
            .forEach((pm, mIdx) => {
                const name   = pm.medication_name || pm.medications?.name || '—';
                const time   = pm.intake_at ? formatTime(pm.intake_at.toISOString()) : '—';
                const date   = pm.intake_at ? formatDate(pm.intake_at.toISOString()) : '—';
                const status = pm.intake_status === true  ? '✓ Прийнято'
                    : pm.intake_status === false ? '✗ Пропущено'
                        : '◯ Очікується';

                const mRow = details.addRow([
                    mIdx + 1,
                    name,
                    pm.frequency || '—',
                    '—',
                    time,
                    pm.quantity || '—',
                    status,
                    date,
                ]);

                const mFill = pm.intake_status === true  ? COLORS.takenBg
                    : pm.intake_status === false ? COLORS.missedBg
                        : COLORS.pendingBg;

                mRow.eachCell(cell => {
                    cell.border    = border();
                    cell.fill      = fill(mFill);
                    cell.font      = { size: 10 };
                    cell.alignment = { vertical: 'middle', wrapText: true };
                });
                mRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
                mRow.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };
                mRow.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' };
                mRow.getCell(7).alignment = { horizontal: 'center', vertical: 'middle' };
                mRow.getCell(8).alignment = { horizontal: 'center', vertical: 'middle' };
                mRow.height = 18;
            });
    });

    // ── АРКУШ 3: Статистика виконання
    const stats = workbook.addWorksheet('Статистика');
    stats.columns = [{ width: 30 }, { width: 15 }, { width: 15 }, { width: 15 }, { width: 15 }];

    stats.mergeCells('A1:E1');
    const st1 = stats.getCell('A1');
    st1.value     = 'СТАТИСТИКА ВИКОНАННЯ ПРИЗНАЧЕНЬ';
    st1.font      = { size: 14, bold: true, color: { argb: COLORS.white } };
    st1.alignment = { horizontal: 'center', vertical: 'middle' };
    st1.fill      = fill(COLORS.titleBg);
    stats.getRow(1).height = 30;

    stats.addRow([]);

    const statsHeader = stats.addRow(['Призначення', 'Всього', 'Прийнято', 'Пропущено', 'Виконання']);
    statsHeader.height = 24;
    statsHeader.eachCell(cell => {
        cell.font      = { bold: true, color: { argb: COLORS.white } };
        cell.fill      = fill(COLORS.headerBg);
        cell.border    = border();
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    let grandTotal = 0, grandTaken = 0, grandMissed = 0;

    prescriptions.forEach((p, idx) => {
        const total  = p.prescription_medications?.length || 0;
        const taken  = p.prescription_medications?.filter(pm => pm.intake_status === true).length  || 0;
        const missed = p.prescription_medications?.filter(pm => pm.intake_status === false).length || 0;
        const rate   = total > 0 ? `${Math.round((taken / total) * 100)}%` : '—';

        grandTotal  += total;
        grandTaken  += taken;
        grandMissed += missed;

        const sRow = stats.addRow([
            `${idx + 1}. ${p.diagnosis || '—'} (${formatDate(p.date_issued)})`,
            total, taken, missed, rate,
        ]);

        const rFill = taken / total >= 0.8 ? COLORS.takenBg : taken / total >= 0.5 ? COLORS.pendingBg : COLORS.missedBg;
        sRow.eachCell(cell => {
            cell.border    = border();
            cell.fill      = fill(rFill);
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
        });
        sRow.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
        sRow.height = 20;
    });

    const totalRate = grandTotal > 0 ? `${Math.round((grandTaken / grandTotal) * 100)}%` : '—';
    const totRow = stats.addRow(['РАЗОМ', grandTotal, grandTaken, grandMissed, totalRate]);
    totRow.height = 24;
    totRow.eachCell(cell => {
        cell.font      = { bold: true, color: { argb: COLORS.white } };
        cell.fill      = fill(COLORS.titleBg);
        cell.border    = border();
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
    totRow.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };

    return await workbook.xlsx.writeBuffer();
};