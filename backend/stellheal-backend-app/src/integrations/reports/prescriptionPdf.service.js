import PDFDocument from 'pdfkit';

export const generatePrescriptionPdf = async (prescription, totalTaken) => {

    return new Promise((resolve) => {
        const doc = new PDFDocument();
        const buffers = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));

        const patient = prescription.users_prescriptions_patient_idTousers;

        doc.text('Звіт про призначення');
        doc.text(`Пацієнт: ${patient.last_name} ${patient.first_name}`);
        doc.text(`Діагноз: ${prescription.diagnosis}`);
        doc.text(`Прийнято ліків: ${totalTaken}`);

        doc.end();
    });
};