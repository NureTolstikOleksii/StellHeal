import ExcelJS from 'exceljs';

export const generateTreatmentExcel = async (patient, prescriptions) => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Звіт з лікування');

    const now = new Date().toLocaleString('uk-UA', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });

    // === Назва звіту ===
    sheet.mergeCells('A1:H1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = 'Звіт про лікування пацієнта';
    titleCell.font = { size: 16, bold: true };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // === Пацієнт ===
    sheet.mergeCells('A2:H2');
    const patientInfoCell = sheet.getCell('A2');
    patientInfoCell.value = `Пацієнт: ${patient.last_name} ${patient.first_name}`;
    patientInfoCell.font = { italic: true };
    patientInfoCell.alignment = { horizontal: 'left' };

    // === Дата формування ===
    sheet.mergeCells('A3:H3');
    const dateCell = sheet.getCell('A3');
    dateCell.value = `Дата формування звіту: ${now}`;
    dateCell.font = { italic: true };
    dateCell.alignment = { horizontal: 'left' };

    // === Колонки ===
    const headers = [
        '№',
        'Дата призначення',
        'Дата завершення',
        'Діагноз',
        'Палата',
        'Лікар',
        'Тривалість (днів)',
        'Призначені препарати'
    ];

    const columnWidths = [5, 15, 15, 20, 10, 20, 15, 60];
    sheet.columns = columnWidths.map(width => ({ width }));

    // === Header row ===
    const headerRow = sheet.addRow(headers);
    headerRow.font = { bold: true };
    headerRow.alignment = {
        horizontal: 'center',
        vertical: 'middle',
        wrapText: true
    };

    headerRow.eachCell(cell => {
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFE599' }
        };
        cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
        };
    });

    // === Дані ===
    prescriptions.forEach((p, index) => {
        const uniqueMedMap = new Map();

        (p.prescription_medications || []).forEach(pm => {
            const name = pm?.medications?.name || 'Невідомо';
            const freq = pm?.frequency || 'н/д';
            const key = `${name}__${freq}`;

            if (!uniqueMedMap.has(key)) {
                uniqueMedMap.set(key, `${name} — ${freq}`);
            }
        });

        const meds = Array.from(uniqueMedMap.values())
            .map((text, i) => `${i + 1}. ${text}`)
            .join('\n');

        const row = sheet.addRow([
            index + 1,
            p.date_issued ? new Date(p.date_issued).toLocaleDateString('uk-UA') : '',
            p.end_date ? new Date(p.end_date).toLocaleDateString('uk-UA') : '',
            p.diagnosis || '',
            p.ward_id || '-',
            `${p.users_prescriptions_doctor_idTousers?.last_name || ''} ${p.users_prescriptions_doctor_idTousers?.first_name || ''}`,
            p.duration || 0,
            meds
        ]);

        const medLines = meds.split('\n').length;
        row.height = Math.max(20, medLines * 18);

        row.alignment = { vertical: 'top', wrapText: true };

        row.eachCell(cell => {
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
        });
    });

    return await workbook.xlsx.writeBuffer();
};