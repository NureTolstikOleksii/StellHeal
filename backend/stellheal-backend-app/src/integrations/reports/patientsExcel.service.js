import ExcelJS from 'exceljs';

export const generatePatientsExcel = async (patients) => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Пацієнти');

    const now = new Date().toLocaleString('uk-UA', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });

    // === Назва звіту ===
    sheet.mergeCells('A1:F1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = 'Звіт про зареєстрованих пацієнтів';
    titleCell.font = { size: 16, bold: true };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // === Дата ===
    sheet.mergeCells('A2:F2');
    const dateCell = sheet.getCell('A2');
    dateCell.value = `Дата формування звіту: ${now}`;
    dateCell.font = { italic: true };
    dateCell.alignment = { horizontal: 'left' };

    // === Заголовки ===
    const headers = ['ID', 'ПІБ', 'Email', 'Телефон', 'Адреса', 'Дата народження'];
    const columnWidths = [7, 30, 30, 20, 30, 18];

    const headerRow = sheet.addRow(headers);
    headerRow.font = { bold: true };
    headerRow.alignment = {
        horizontal: 'center',
        vertical: 'middle',
        wrapText: true
    };

    headerRow.eachCell((cell, colNumber) => {
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

        sheet.getColumn(colNumber).width = columnWidths[colNumber - 1];
    });

    // === Дані ===
    patients.forEach(p => {
        const row = sheet.addRow([
            p.user_id,
            `${p.last_name} ${p.first_name} ${p.patronymic || ''}`.trim(),
            p.login,
            p.phone || '',
            p.contact_info || '',
            p.date_of_birth
                ? new Date(p.date_of_birth).toLocaleDateString('uk-UA')
                : ''
        ]);

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