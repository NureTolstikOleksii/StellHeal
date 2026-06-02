import ExcelJS from 'exceljs';

export const generateContainerExcel = async (containers) => {

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

    const now = new Date();

    const COLORS = {
        titleBg:     'FF0D47A1',
        headerBg:    'FF1565C0',
        subHeaderBg: 'FFE3F2FD',
        onlineBg:    'FFE8F5E9',
        offlineBg:   'FFFCE4EC',
        filledBg:    'FFE8F5E9',
        emptyBg:     'FFF5F5F5',
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

    // ════════════════════════════════════════════════════════════════════════
    // ── АРКУШ 1: Зведений список контейнерів ────────────────────────────────
    // ════════════════════════════════════════════════════════════════════════
    const sheet = workbook.addWorksheet('Контейнери');
    sheet.columns = [
        { width: 6  },  // №
        { width: 12 },  // Номер
        { width: 28 },  // Пацієнт
        { width: 12 },  // Статус
        { width: 10 },  // Онлайн
        { width: 16 },  // Остання активність
        { width: 10 },  // Відсіків
        { width: 10 },  // Заповнено
        { width: 16 },  // Device UID
    ];

    // Заголовок
    sheet.mergeCells('A1:I1');
    const t1 = sheet.getCell('A1');
    t1.value     = 'ЗВІТ ПРО КОНТЕЙНЕРИ';
    t1.font      = { size: 16, bold: true, color: { argb: COLORS.white } };
    t1.alignment = { horizontal: 'center', vertical: 'middle' };
    t1.fill      = fill(COLORS.titleBg);
    sheet.getRow(1).height = 36;

    // Підзаголовок
    const online  = containers.filter(c => c.is_online).length;
    const offline = containers.length - online;
    sheet.mergeCells('A2:I2');
    const t2 = sheet.getCell('A2');
    t2.value     = `Дата формування: ${formatDateTime(now)}   |   Всього: ${containers.length}   |   Онлайн: ${online}   |   Офлайн: ${offline}`;
    t2.font      = { size: 10, italic: true, color: { argb: COLORS.gray } };
    t2.alignment = { horizontal: 'left', vertical: 'middle' };
    t2.fill      = fill(COLORS.subHeaderBg);
    sheet.getRow(2).height = 20;

    sheet.addRow([]);

    // Заголовки колонок
    const hRow = sheet.addRow(['№', 'Контейнер', 'Пацієнт', 'Статус', 'Онлайн', 'Остання активність', 'Відсіків', 'Заповнено', 'Device UID']);
    hRow.height = 26;
    hRow.eachCell(cell => {
        cell.font      = { bold: true, size: 11, color: { argb: COLORS.white } };
        cell.fill      = fill(COLORS.headerBg);
        cell.border    = border();
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    });

    // Дані
    containers.forEach((c, idx) => {
        const patientName  = c.users
            ? `${c.users.last_name} ${c.users.first_name} ${c.users.patronymic || ''}`.trim()
            : '—';
        const totalComps   = c.compartments?.length || 0;
        const filledComps  = c.compartments?.filter(comp => comp.is_filled).length || 0;
        const isOnline     = c.is_online ? '✓ Онлайн' : '✗ Офлайн';

        const row = sheet.addRow([
            idx + 1,
            `№${c.container_number}`,
            patientName,
            c.status || '—',
            isOnline,
            formatDateTime(c.last_seen),
            totalComps,
            `${filledComps}/${totalComps}`,
            c.device_uid || '—',
        ]);

        row.height = 20;
        const rowFill = c.is_online ? COLORS.onlineBg : idx % 2 === 0 ? COLORS.white : COLORS.altRow;
        row.eachCell(cell => {
            cell.border    = border();
            cell.fill      = fill(rowFill);
            cell.font      = { size: 10 };
            cell.alignment = { vertical: 'middle', wrapText: true };
        });
        [1, 2, 5, 7, 8].forEach(col => {
            row.getCell(col).alignment = { horizontal: 'center', vertical: 'middle' };
        });
        // Підсвітити статус онлайн/офлайн
        row.getCell(5).font = {
            size: 10, bold: true,
            color: { argb: c.is_online ? 'FF2E7D32' : 'FFC62828' }
        };
    });

    // ════════════════════════════════════════════════════════════════════════
    // ── АРКУШ 2: Деталі відсіків ─────────────────────────────────────────────
    // ════════════════════════════════════════════════════════════════════════
    const details = workbook.addWorksheet('Відсіки');
    details.columns = [
        { width: 6  },  // №
        { width: 12 },  // Контейнер
        { width: 26 },  // Пацієнт
        { width: 10 },  // Відсік №
        { width: 12 },  // Стан
        { width: 26 },  // Препарат
        { width: 22 },  // Ким заповнено
        { width: 16 },  // Час заповнення
        { width: 16 },  // Час відкриття
    ];

    details.mergeCells('A1:I1');
    const d1 = details.getCell('A1');
    d1.value     = 'ДЕТАЛІ ВІДСІКІВ';
    d1.font      = { size: 14, bold: true, color: { argb: COLORS.white } };
    d1.alignment = { horizontal: 'center', vertical: 'middle' };
    d1.fill      = fill(COLORS.titleBg);
    details.getRow(1).height = 30;

    details.addRow([]);

    const dhRow = details.addRow(['№', 'Контейнер', 'Пацієнт', 'Відсік', 'Стан', 'Препарат', 'Ким заповнено', 'Заповнено о', 'Відкрито о']);
    dhRow.height = 24;
    dhRow.eachCell(cell => {
        cell.font      = { bold: true, size: 10, color: { argb: COLORS.white } };
        cell.fill      = fill(COLORS.headerBg);
        cell.border    = border();
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    });

    let rowIdx = 0;
    containers.forEach(c => {
        const patientName = c.users
            ? `${c.users.last_name} ${c.users.first_name}`.trim()
            : '—';
        const contLabel   = `№${c.container_number}`;

        (c.compartments || [])
            .sort((a, b) => (a.compartment_number || 0) - (b.compartment_number || 0))
            .forEach(comp => {
                const lastMed     = comp.compartment_medications?.at(-1);
                const medName     = lastMed?.prescription_medications?.medication_name
                    || lastMed?.prescription_medications?.medications?.name
                    || '—';
                const filledBy    = lastMed?.users
                    ? `${lastMed.users.last_name} ${lastMed.users.first_name}`.trim()
                    : '—';
                const fillTime    = formatDateTime(lastMed?.fill_time);
                const openTime    = formatDateTime(lastMed?.open_time);
                const isFilled    = comp.is_filled;
                const statusLabel = isFilled ? '● Заповнено' : '○ Вільно';

                const row = details.addRow([
                    ++rowIdx,
                    contLabel,
                    patientName,
                    comp.compartment_number || '—',
                    statusLabel,
                    medName,
                    filledBy,
                    fillTime,
                    openTime,
                ]);

                row.height = 20;
                const rowFill = isFilled ? COLORS.filledBg : COLORS.emptyBg;
                row.eachCell(cell => {
                    cell.border    = border();
                    cell.fill      = fill(rowFill);
                    cell.font      = { size: 10 };
                    cell.alignment = { vertical: 'middle', wrapText: true };
                });
                [1, 4, 7, 8, 9].forEach(col => {
                    row.getCell(col).alignment = { horizontal: 'center', vertical: 'middle' };
                });
                row.getCell(5).font = {
                    size: 10, bold: true,
                    color: { argb: isFilled ? 'FF2E7D32' : 'FF9E9E9E' }
                };
            });
    });

    // ════════════════════════════════════════════════════════════════════════
    // ── АРКУШ 3: Статистика ─────────────────────────────────────────────────
    // ════════════════════════════════════════════════════════════════════════
    const stats = workbook.addWorksheet('Статистика');
    stats.columns = [{ width: 35 }, { width: 15 }];

    stats.mergeCells('A1:B1');
    const s1 = stats.getCell('A1');
    s1.value     = 'СТАТИСТИКА КОНТЕЙНЕРІВ';
    s1.font      = { size: 14, bold: true, color: { argb: COLORS.white } };
    s1.alignment = { horizontal: 'center', vertical: 'middle' };
    s1.fill      = fill(COLORS.titleBg);
    stats.getRow(1).height = 30;

    stats.addRow([]);

    const totalComps  = containers.reduce((s, c) => s + (c.compartments?.length || 0), 0);
    const filledComps = containers.reduce((s, c) => s + (c.compartments?.filter(comp => comp.is_filled).length || 0), 0);
    const assigned    = containers.filter(c => c.users).length;

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
    addStatRow('Всього контейнерів',        containers.length);
    addStatRow('Онлайн',                    online);
    addStatRow('Офлайн',                    offline);
    addStatRow('Призначено пацієнтам',      assigned);
    addStatRow('Без пацієнта',              containers.length - assigned);

    stats.addRow([]);
    addStatRow('ВІДСІКИ', '', COLORS.headerBg);
    addStatRow('Всього відсіків',           totalComps);
    addStatRow('Заповнених відсіків',       filledComps);
    addStatRow('Вільних відсіків',          totalComps - filledComps);
    addStatRow('Заповненість (%)',          totalComps > 0 ? `${Math.round((filledComps / totalComps) * 100)}%` : '—');

    return await workbook.xlsx.writeBuffer();
};