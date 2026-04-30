import ExcelJS from 'exceljs';

export const generateStaffExcel = async (doctors, nurses) => {

    const formatDate = (date) => {
        if (!date) return '';
        const d = new Date(date);
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}.${month}.${year}`;
    };

    const now = new Date().toLocaleString('uk-UA', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Працівники');

    // === Заголовок ===
    sheet.mergeCells('A1:J1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = 'Звіт про медичних працівників';
    titleCell.font = { size: 16, bold: true };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // === Дата ===
    sheet.mergeCells('A2:J2');
    const dateCell = sheet.getCell('A2');
    dateCell.value = `Дата формування звіту: ${now}`;
    dateCell.font = { italic: true };
    dateCell.alignment = { horizontal: 'left' };

    let currentRow = 3;

    const addStyledRow = (rowData, options = {}) => {
        const row = sheet.insertRow(currentRow++, rowData);

        if (options.bold) row.font = { bold: true };

        if (options.fill) {
            row.eachCell(cell => {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: options.fill },
                };
            });
        }

        if (options.border) {
            row.eachCell(cell => {
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' },
                };
            });
        }

        if (options.alignment) {
            row.alignment = {
                vertical: 'middle',
                horizontal: options.alignment
            };
        }

        return row;
    };

    const headers = [
        'Прізвище', 'Ім’я', 'По-батькові',
        'Дата народження', 'Телефон', 'Пошта',
        'Адреса', 'Спеціалізація', 'Зміна', 'Дата працевлаштування'
    ];

    const headerOptions = {
        bold: true,
        fill: 'FFF4CC',
        border: true,
        alignment: 'center'
    };

    // === Лікарі ===
    addStyledRow(['Лікарі'], { bold: true });
    addStyledRow(headers, headerOptions);

    doctors.forEach(user => {
        addStyledRow([
            user.last_name,
            user.first_name,
            user.patronymic || '',
            formatDate(user.date_of_birth),
            user.phone || '',
            user.login,
            user.contact_info,
            user.medical_staff?.specialization || '',
            user.medical_staff?.shift || '',
            formatDate(user.medical_staff?.admission_date)
        ], { border: true });
    });

    currentRow++; // пропуск

    // === Медперсонал (як було!) ===
    addStyledRow(['Медперсонал'], { bold: true });
    addStyledRow(headers, headerOptions);

    nurses.forEach(user => {
        addStyledRow([
            user.last_name,
            user.first_name,
            user.patronymic || '',
            formatDate(user.date_of_birth),
            user.phone || '',
            user.login,
            user.contact_info,
            user.medical_staff?.specialization || '',
            user.medical_staff?.shift || '',
            formatDate(user.medical_staff?.admission_date)
        ], { border: true });
    });

    // === ОРИГІНАЛЬНІ ширини колонок ===
    sheet.columns = [
        { width: 20 },
        { width: 20 },
        { width: 20 },
        { width: 25 },
        { width: 20 },
        { width: 30 },
        { width: 40 },
        { width: 25 },
        { width: 20 },
        { width: 30 },
    ];

    return await workbook.xlsx.writeBuffer();
};