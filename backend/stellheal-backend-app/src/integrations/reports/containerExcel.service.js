import ExcelJS from 'exceljs';

export const generateContainerExcel = async (containers) => {

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Контейнери');

    const now = new Date().toLocaleString('uk-UA', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });

    // === Назва звіту ===
    sheet.mergeCells('A1:G1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = 'Звіт про контейнери та заповнення';
    titleCell.font = { size: 16, bold: true };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // === Дата ===
    sheet.mergeCells('A2:G2');
    const dateCell = sheet.getCell('A2');
    dateCell.value = `Дата формування звіту: ${now}`;
    dateCell.font = { italic: true };
    dateCell.alignment = { horizontal: 'left' };

    // === Headers ===
    const headers = [
        'ID',
        'Номер контейнера',
        'Пацієнт',
        'Статус',
        'Відсік',
        'Препарат',
        'Працівник/час заповнення'
    ];

    const columnWidths = [7, 18, 28, 14, 10, 28, 35];

    const headerRow = sheet.addRow(headers);
    headerRow.font = { bold: true };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };

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
    containers.forEach(container => {

        const patientName = container.users
            ? `${container.users.last_name} ${container.users.first_name}`.trim()
            : '-';

        const compartments = container.compartments || [];
        const rowSpan = compartments.length || 1;
        const startRow = sheet.lastRow.number + 1;

        compartments.forEach((compartment, idx) => {

            const meds = compartment.compartment_medications || [];
            const lastFill = meds.at(-1);

            const medicationName =
                lastFill?.prescription_medications?.medications?.name || '-';

            const filledBy = lastFill?.users
                ? `${lastFill.users.last_name} ${lastFill.users.first_name}`
                : '-';

            const filledAt = lastFill?.fill_time
                ? new Date(lastFill.fill_time).toLocaleString('uk-UA')
                : '-';

            const row = sheet.addRow([
                idx === 0 ? container.container_id : '',
                idx === 0 ? container.container_number : '',
                idx === 0 ? patientName : '',
                idx === 0 ? container.status : '',
                compartment.compartment_number || '-',
                medicationName,
                filledBy !== '-' && filledAt !== '-'
                    ? `${filledBy} | ${filledAt}`
                    : '-'
            ]);

            row.alignment = { vertical: 'middle', wrapText: true };

            row.eachCell(cell => {
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });
        });

        // === Merge як було ===
        if (rowSpan > 1) {
            sheet.mergeCells(`A${startRow}:A${startRow + rowSpan - 1}`);
            sheet.mergeCells(`B${startRow}:B${startRow + rowSpan - 1}`);
            sheet.mergeCells(`C${startRow}:C${startRow + rowSpan - 1}`);
            sheet.mergeCells(`D${startRow}:D${startRow + rowSpan - 1}`);
        }
    });

    return await workbook.xlsx.writeBuffer();
};