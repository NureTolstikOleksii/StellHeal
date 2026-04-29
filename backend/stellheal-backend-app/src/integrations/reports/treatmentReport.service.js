import ExcelJS from 'exceljs';

export const generateTreatmentExcel = async (patient, prescriptions) => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Звіт з лікування');

    sheet.addRow([`Пацієнт: ${patient.last_name} ${patient.first_name}`]);

    sheet.addRow([
        '№',
        'Дата',
        'Діагноз',
        'Лікар',
        'Тривалість',
        'Препарати'
    ]);

    prescriptions.forEach((p, index) => {
        const meds = (p.prescription_medications || [])
            .map(pm => pm.medications?.name)
            .filter(Boolean)
            .join(', ');

        sheet.addRow([
            index + 1,
            p.date_issued,
            p.diagnosis,
            p.users_prescriptions_doctor_idTousers?.last_name,
            p.duration,
            meds
        ]);
    });

    return workbook.xlsx.writeBuffer();
};