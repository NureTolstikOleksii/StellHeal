import PDFDocument from 'pdfkit';

export const generatePrescriptionPdf = async (prescription, totalTaken) => {
    return new Promise((resolve) => {

        const formatDate = (date) =>
            new Date(date).toLocaleDateString('uk-UA');

        const formatDateTime = (date) =>
            new Date(date).toLocaleString('uk-UA');

        const doc = new PDFDocument({ margin: 50 });
        const buffers = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));

        // === Шрифт ===
        doc.registerFont('Roboto', 'src/fonts/Roboto-Regular.ttf');
        doc.font('Roboto');

        // === Логотип ===
        doc.image('public/logo.png', doc.page.width / 2 - 40, 40, { width: 70 })
            .moveDown(4);

        // === Заголовок ===
        doc.fontSize(20)
            .text('Звiт про призначення', { align: 'center' })
            .moveDown();

        const patient = prescription.users_prescriptions_patient_idTousers;

        const fullName = `${patient.last_name} ${patient.first_name} ${patient.patronymic || ''}`.trim();

        const now = new Date();

        // === Основна інформація ===
        doc.fontSize(12)
            .text(`ПIБ пацiєнта: ${fullName}`)
            .text(`Дiагноз: ${prescription.diagnosis || '—'}`)
            .text(`Дата призначення: ${formatDate(prescription.date_issued)}`)
            .text(`Лiкар: ${prescription.users_prescriptions_doctor_idTousers.last_name} ${prescription.users_prescriptions_doctor_idTousers.first_name.charAt(0)}.`)
            .text(`Всього прийнято лiкiв: ${totalTaken}`)
            .text(`Дата формування звiту: ${formatDateTime(now)}`)
            .moveDown();

        // === Формування medsMap (як було) ===
        const medsMap = {};

        for (const pm of prescription.prescription_medications) {
            const name = pm.medications?.name || "Unknown";
            const key = name;

            if (!medsMap[key]) {
                medsMap[key] = {
                    name,
                    frequency: pm.frequency,
                    duration: prescription.duration,
                    intake_times: []
                };
            }

            if (pm.intake_time && pm.quantity !== null) {
                const timeStr = pm.intake_time.toLocaleTimeString('uk-UA', {
                    hour: '2-digit',
                    minute: '2-digit'
                });

                const alreadyExists = medsMap[key].intake_times
                    .some(it => it.time === timeStr && it.quantity === pm.quantity);

                if (!alreadyExists) {
                    medsMap[key].intake_times.push({
                        time: timeStr,
                        quantity: pm.quantity
                    });
                }
            }
        }

        // === Препарати ===
        doc.fontSize(13)
            .text('Препарати:', { underline: true })
            .moveDown(0.5);

        let counter = 1;

        for (const med of Object.values(medsMap)) {
            doc.font('Roboto').text(`${counter}. ${med.name}`);

            doc.text(`   Частота: ${med.frequency}`)
                .text(`   Тривалiсть: ${med.duration} днiв`)
                .text(`   Час прийому:`);

            if (med.intake_times.length === 0) {
                doc.text(`     —`);
            } else {
                med.intake_times.forEach((intake) => {
                    doc.text(`     • ${intake.time} — ${intake.quantity} табл.`);
                });
            }

            doc.moveDown();
            counter++;
        }

        // === Footer ===
        doc.moveDown(2);

        doc.fontSize(10).fillColor('gray')
            .text('StellHeal — Медична інформаційна система', { align: 'center' });

        doc.fontSize(8).fillColor('gray')
            .text('© 2025 StellHeal. Усі права захищено.', { align: 'center' });

        doc.end();
    });
};