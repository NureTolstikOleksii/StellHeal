import PDFDocument from 'pdfkit';

export const generatePrescriptionPdf = async (prescription, totalTaken) => {
    return new Promise((resolve) => {

        const formatDate = (isoString) => {
            if (!isoString) return '—';
            return new Date(isoString).toLocaleDateString('uk-UA', {
                day: '2-digit', month: '2-digit', year: 'numeric',
            });
        };

        const formatDateTime = (isoString) => {
            if (!isoString) return '—';
            return new Date(isoString).toLocaleString('uk-UA', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit',
            });
        };

        const formatTime = (isoString) => {
            if (!isoString) return '—';
            return new Date(isoString).toLocaleTimeString('uk-UA', {
                hour: '2-digit', minute: '2-digit',
            });
        };

        const doc     = new PDFDocument({ margin: 50 });
        const buffers = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));

        doc.registerFont('Roboto', 'src/fonts/Roboto-Regular.ttf');
        doc.font('Roboto');

        // ── Логотип ───────────────────────────────────────────────────────────
        doc.image('public/logo.png', doc.page.width / 2 - 40, 40, { width: 70 })
            .moveDown(4);

        // ── Заголовок ─────────────────────────────────────────────────────────
        doc.fontSize(20)
            .text('Звiт з лікування', { align: 'center' })
            .moveDown();

        const patient  = prescription.users_prescriptions_patient_idTousers;
        const doctor   = prescription.users_prescriptions_doctor_idTousers;
        const ward     = prescription.wards;
        const fullName = `${patient.last_name} ${patient.first_name} ${patient.patronymic || ''}`.trim();
        const now      = new Date();

        // ── Пацієнт ───────────────────────────────────────────────────────────
        doc.fontSize(13)
            .text('Iнформацiя про пацiєнта:', { underline: true })
            .moveDown(0.3);

        doc.fontSize(12)
            .text(`ПIБ: ${fullName}`)
            .text(`Дата народження: ${patient.date_of_birth ? formatDate(patient.date_of_birth.toISOString()) : '—'}`)
            .text(`Телефон: ${patient.phone || '—'}`)
            .text(`Адреса: ${patient.contact_info || '—'}`)
            .text(`Палата: ${ward?.ward_number || '—'}`)
            .moveDown();

        // ── Призначення ───────────────────────────────────────────────────────
        doc.fontSize(13)
            .text('Призначення:', { underline: true })
            .moveDown(0.3);

        doc.fontSize(12)
            .text(`Лiкар: ${doctor.last_name} ${doctor.first_name} ${doctor.patronymic || ''}`.trim())
            .text(`Дата призначення: ${formatDate(prescription.date_issued?.toISOString())}`)
            .text(`Дата закiнчення: ${formatDate(prescription.end_date?.toISOString())}`)
            .text(`Тривалiсть: ${prescription.duration || '—'} днiв`)
            .text(`Дiагноз: ${prescription.diagnosis || '—'}`)
            .text(`Код МКХ: ${prescription.icd_code || '—'}`)
            .moveDown();

        // ── Клінічна картина ──────────────────────────────────────────────────
        if (prescription.complaints || prescription.anamnesis ||
            prescription.objective_status || prescription.recommendations || prescription.notes) {

            doc.fontSize(13)
                .text('Клiнiчна картина:', { underline: true })
                .moveDown(0.3);

            doc.fontSize(12);

            if (prescription.complaints) {
                doc.text('Скарги:')
                    .font('Roboto').fontSize(11)
                    .text(`   ${prescription.complaints}`, { width: 480 })
                    .fontSize(12)
                    .moveDown(0.3);
            }

            if (prescription.anamnesis) {
                doc.text('Анамнез:')
                    .fontSize(11)
                    .text(`   ${prescription.anamnesis}`, { width: 480 })
                    .fontSize(12)
                    .moveDown(0.3);
            }

            if (prescription.objective_status) {
                doc.text("Об'єктивний стан:")
                    .fontSize(11)
                    .text(`   ${prescription.objective_status}`, { width: 480 })
                    .fontSize(12)
                    .moveDown(0.3);
            }

            if (prescription.recommendations) {
                doc.text('Рекомендацiї:')
                    .fontSize(11)
                    .text(`   ${prescription.recommendations}`, { width: 480 })
                    .fontSize(12)
                    .moveDown(0.3);
            }

            if (prescription.notes) {
                doc.text('Примiтки:')
                    .fontSize(11)
                    .text(`   ${prescription.notes}`, { width: 480 })
                    .fontSize(12)
                    .moveDown(0.3);
            }

            doc.moveDown(0.5);
        }

        // ── Статистика прийому ────────────────────────────────────────────────
        doc.fontSize(13)
            .text('Статистика:', { underline: true })
            .moveDown(0.3);

        const totalMeds   = prescription.prescription_medications.length;
        const takenMeds   = prescription.prescription_medications.filter(pm => pm.intake_status === true).length;
        const missedMeds  = prescription.prescription_medications.filter(pm => pm.intake_status === false).length;
        const pendingMeds = prescription.prescription_medications.filter(pm => pm.intake_status === null).length;
        const intakeRate  = totalMeds > 0 ? Math.round((takenMeds / totalMeds) * 100) : 0;

        doc.fontSize(12)
            .text(`Всього прийомiв: ${totalMeds}`)
            .text(`Прийнято: ${takenMeds}`)
            .text(`Пропущено: ${missedMeds}`)
            .text(`Очiкується: ${pendingMeds}`)
            .text(`Виконання: ${intakeRate}%`)
            .text(`Всього таблеток прийнято: ${totalTaken}`)
            .moveDown();

        // ── Препарати ─────────────────────────────────────────────────────────
        const medsMap = {};

        for (const pm of prescription.prescription_medications) {
            const name = pm.medication_name || pm.medications?.name || "Unknown";

            if (!medsMap[name]) {
                medsMap[name] = {
                    name,
                    frequency:    pm.frequency || '—',
                    duration:     0,
                    intake_times: [],
                    _dates:       new Set(),
                    _times:       new Set(),
                };
            }

            if (pm.intake_at) {
                const iso     = pm.intake_at.toISOString();
                const dateStr = iso.substring(0, 10);
                const timeStr = iso.substring(11, 16);

                medsMap[name]._dates.add(dateStr);

                if (!medsMap[name]._times.has(timeStr)) {
                    medsMap[name]._times.add(timeStr);
                    medsMap[name].intake_times.push({
                        time:     formatTime(iso),
                        quantity: pm.quantity,
                    });
                }
            }
        }

        const meds = Object.values(medsMap).map(({ _dates, _times, ...med }) => ({
            ...med,
            duration: _dates.size,
        }));

        meds.forEach(med => {
            med.intake_times.sort((a, b) => a.time.localeCompare(b.time));
        });

        doc.fontSize(13)
            .text('Препарати:', { underline: true })
            .moveDown(0.5);

        meds.forEach((med, idx) => {
            doc.font('Roboto').fontSize(12).text(`${idx + 1}. ${med.name}`);
            doc.text(`   Частота: ${med.frequency}`)
                .text(`   Тривалiсть: ${med.duration} днiв`)
                .text(`   Час прийому:`);

            if (med.intake_times.length === 0) {
                doc.text(`     —`);
            } else {
                med.intake_times.forEach(intake => {
                    doc.text(`     • ${intake.time} — ${intake.quantity} табл.`);
                });
            }

            doc.moveDown();
        });

        // ── Footer ────────────────────────────────────────────────────────────
        doc.moveDown(1);
        doc.fontSize(11).fillColor('gray')
            .text(`Дата формування звiту: ${formatDateTime(now.toISOString())}`, { align: 'right' });
        doc.moveDown(1);
        doc.fontSize(10).fillColor('gray')
            .text('StellHeal — Медична iнформацiйна система', { align: 'center' });
        doc.fontSize(8).fillColor('gray')
            .text('© 2025 StellHeal. Усi права захищено.', { align: 'center' });

        doc.end();
    });
};