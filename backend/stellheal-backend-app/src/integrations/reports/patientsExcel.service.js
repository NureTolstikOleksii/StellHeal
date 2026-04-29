import ExcelJS from 'exceljs';

export const generatePatientsExcel = async (patients) => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Пацієнти');

    const now = new Date().toLocaleString('uk-UA');

    sheet.mergeCells('A1:F1');
    sheet.getCell('A1').value = 'Звіт про пацієнтів';

    sheet.addRow([]);
    sheet.addRow([`Дата: ${now}`]);

    sheet.addRow([
        'ID',
        'ПІБ',
        'Email',
        'Телефон',
        'Адреса',
        'Дата народження'
    ]);

    patients.forEach(p => {
        sheet.addRow([
            p.user_id,
            `${p.last_name} ${p.first_name}`,
            p.login,
            p.phone,
            p.contact_info,
            p.date_of_birth
        ]);
    });

    return await workbook.xlsx.writeBuffer();
};