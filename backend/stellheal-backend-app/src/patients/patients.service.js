import { randomBytes } from 'crypto';

import bcrypt from 'bcryptjs';
import ExcelJS from 'exceljs';
import {sendWelcomeEmail} from "../utils/emailService.js";

export class PatientsService {
    // отримання всіх пацієнтів
    async getAllPatients(db) {
        const patients = await db.users.findMany({
            where: {role_id: 3},
            select: {
                user_id: true,
                first_name: true,
                last_name: true,
                patronymic: true,
                login: true,
                phone: true,
                contact_info: true,
                avatar: true,
                date_of_birth: true
            }
        });

        return patients.map(p => ({
            id: p.user_id,
            name: `${p.first_name} ${p.last_name} ${p.patronymic}`,
            email: p.login,
            phone: p.phone,
            address: p.contact_info,
            dob: p.date_of_birth?.toLocaleDateString('uk-UA'),
            avatar: p.avatar || null
        }));
    }

    // отримання пацієнтів на лікуванні для медсестер
    async getAllPatientsForStaff(db) {
        const now = new Date();

        const patients = await db.users.findMany({
            where: {
                role_id: 3,
                prescriptions_prescriptions_patient_idTousers: {
                    some: {
                        end_date: {
                            gt: now
                        }
                    }
                }
            },
            select: {
                user_id: true,
                first_name: true,
                last_name: true,
                patronymic: true,
                login: true,
                phone: true,
                contact_info: true,
                avatar: true,
                date_of_birth: true,
                prescriptions_prescriptions_patient_idTousers: {
                    select: {
                        ward_id: true,
                        wards: {
                            select: {
                                ward_number: true
                            }
                        }
                    },
                    orderBy: {
                        date_issued: 'desc'
                    },
                    take: 1
                }
            }
        });

        return patients.map(p => ({
            id: p.user_id,
            name: `${p.first_name} ${p.last_name} ${p.patronymic}`,
            email: p.login,
            phone: p.phone,
            address: p.contact_info,
            dob: p.date_of_birth?.toLocaleDateString('uk-UA'),
            avatar: p.avatar || null,
            ward: p.prescriptions_prescriptions_patient_idTousers[0]?.wards?.ward_number || "—"
        }));
    }

    // підрахунок кількості пацієнтів
    async getCounts(db) {
        const totalPatients = await db.users.count({
            where: {role_id: 3}
        });

        const onTreatment = await db.prescriptions.count({
            where: {
                patient_id: {not: null},
                end_date: {gte: new Date()},
                users_prescriptions_patient_idTousers: {
                    role_id: 3
                }
            }
        });

        return {totalPatients, onTreatment};
    }

    // створення пацієнта
    async createPatient(db, data) {
        const { last_name, first_name, patronymic, email, birth_date, phone, address } = data;

        const exists = await db.users.findUnique({ where: { login: email } });
        if (exists) throw new Error('Користувач з такою поштою вже існує');

        const plainPassword = randomBytes(4).toString('hex'); // 8-символьний
        const hashedPassword = await bcrypt.hash(plainPassword, 10);

        const user = await db.users.create({
            data: {
                first_name,
                last_name,
                patronymic,
                login: email,
                password: hashedPassword,
                date_of_birth: birth_date ? new Date(birth_date) : null,
                phone,
                contact_info: address,
                role_id: 3,
            },
        });

        // відправка на пошту
        await sendWelcomeEmail(email, plainPassword);

        const now = new Date();
        const notification = await db.notifications.create({
            data: {
                notification_type: 'success',
                message: `Вітаємо вас у системі, ${user.last_name} ${user.first_name}!`,
                sent_date: now,
                sent_time: new Date(now.getTime() + (3 * 60 * 60 * 1000)) // +3 години (UTC+3)
            }
        });

        await db.notification_recipients.create({
            data: {
                notification_id: notification.notification_id,
                user_id: user.user_id,
                is_read: false
            }
        });

        return {
            message: 'Пацієнта створено успішно',
            userId: user.user_id,
            email,
        };
    }

    // звіт про пацієнтів Excel
    async exportPatientsToExcel(db) {
        const patients = await db.users.findMany({
            where: { role_id: 3 },
            select: {
                user_id: true,
                first_name: true,
                last_name: true,
                patronymic: true,
                login: true,
                phone: true,
                contact_info: true,
                date_of_birth: true
            }
        });

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

        // === Дата формування ===
        sheet.mergeCells('A2:F2');
        const dateCell = sheet.getCell('A2');
        dateCell.value = `Дата формування звіту: ${now}`;
        dateCell.font = { italic: true };
        dateCell.alignment = { horizontal: 'left' };

        // === Заголовки таблиці ===
        const headers = ['ID', 'ПІБ', 'Email', 'Телефон', 'Адреса', 'Дата народження'];
        const columnWidths = [7, 30, 30, 20, 30, 18];

        const headerRow = sheet.addRow(headers);
        headerRow.font = { bold: true };
        headerRow.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

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

        // === Додавання даних про пацієнтів ===
        patients.forEach(p => {
            const row = sheet.addRow([
                p.user_id,
                `${p.last_name} ${p.first_name} ${p.patronymic || ''}`.trim(),
                p.login,
                p.phone || '',
                p.contact_info || '',
                p.date_of_birth ? new Date(p.date_of_birth).toLocaleDateString('uk-UA') : ''
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
    }

    // отримання пацієнта по id
    async getById(db, id) {
        const user = await db.users.findUnique({
            where: { user_id: id },
            select: {
                user_id: true,
                first_name: true,
                last_name: true,
                patronymic: true,
                login: true,
                phone: true,
                contact_info: true,
                avatar: true,
                date_of_birth: true
            }
        });

        if (!user) throw new Error('Пацієнт не знайдений');

        return {
            id: user.user_id,
            name: `${user.last_name} ${user.first_name} ${user.patronymic}`,
            email: user.login,
            phone: user.phone,
            address: user.contact_info,
            avatar: user.avatar,
            dob: user.date_of_birth ? new Date(user.date_of_birth).toLocaleDateString('uk-UA') : ''
        };
    }

    // отримання поточного призначення
    async getCurrentTreatment(db, patientId) {
        const prescriptions = await db.prescriptions.findMany({
            where: {
                patient_id: patientId,
                end_date: { gte: new Date() }
            },
            include: {
                users_prescriptions_doctor_idTousers: true,
                prescription_medications: {
                    include: {
                        medications: true
                    }
                }
            }
        });

        return prescriptions.map(p => {
            const uniqueMeds = [];
            const seen = new Set();

            for (const pm of p.prescription_medications) {
                const med = pm.medications;
                if (!med) continue;

                const key = `${med.name}-${pm.frequency}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    uniqueMeds.push(`${med.name} - ${pm.frequency || ''}`);
                }
            }

            return {
                prescriptionId: p.prescription_id,
                name: p.diagnosis,
                date: p.date_issued?.toISOString(),
                endDate: p.end_date?.toISOString(),
                medications: uniqueMeds,
                ward: p.ward_id || '-',
                doctor: `${p.users_prescriptions_doctor_idTousers?.first_name || ''} ${p.users_prescriptions_doctor_idTousers?.last_name || ''}`,
                duration: p.duration || 0
            };
        });
    }

    // отримання історії призначень
    async getTreatmentHistory(db, patientId) {
        const prescriptions = await db.prescriptions.findMany({
            where: {
                patient_id: patientId,
                end_date: { lt: new Date() }
            },
            include: {
                users_prescriptions_doctor_idTousers: true,
                prescription_medications: {
                    include: {
                        medications: true
                    }
                }
            }
        });

        return prescriptions.map(p => {
            const seen = new Map();
            p.prescription_medications.forEach(pm => {
                const med = pm.medications;
                if (med && !seen.has(med.name)) {
                    seen.set(med.name, `${med.name} - ${pm.frequency || ''}`);
                }
            });

            return {
                prescriptionId: p.prescription_id,
                name: p.diagnosis,
                date: p.date_issued?.toISOString(),
                endDate: p.end_date?.toISOString(),
                medications: Array.from(seen.values()),
                ward: p.ward_id || '-',
                doctor: `${p.users_prescriptions_doctor_idTousers?.first_name || ''} ${p.users_prescriptions_doctor_idTousers?.last_name || ''}`,
                duration: p.duration || 0
            };
        });
    }

    // cтворення призначення
     async createPrescription(db, doctorId, patientId, data) {
        const { diagnosis, wardId, medications } = data;

        if (!diagnosis || !wardId || !Array.isArray(medications) || medications.length === 0) {
            throw new Error('Невірні дані для створення призначення');
        }

        const prescription = await db.prescriptions.create({
            data: {
                diagnosis,
                ward_id: wardId,
                patient_id: parseInt(patientId),
                duration: parseInt(medications[0].duration),
                doctor_id: doctorId,
                date_issued: new Date(),
            }
        });

        for (const med of medications) {
            const { medicationId, quantity, timesPerDay, duration } = med;
            const times = getIntakeTimes(Number(timesPerDay));
            const startDate = new Date();

            for (let day = 0; day < Number(duration); day++) {
                const date = addDays(startDate, day);

                for (const timeStr of times) {
                    const [hours, minutes] = timeStr.split(':');
                    const intakeTime = new Date(date);
                    intakeTime.setHours(Number(hours), Number(minutes), 0, 0);

                    await db.prescription_medications.create({
                        data: {
                            prescriptions: {
                                connect: { prescription_id: prescription.prescription_id }
                            },
                            medications: {
                                connect: { medication_id: medicationId }
                            },
                            quantity: parseInt(quantity),
                            frequency: `${timesPerDay} раз(и) на день`,
                            intake_date: date,
                            intake_time: intakeTime
                        }
                    });
                }
            }
        }

        return {
            message: 'Призначення успішно створено',
            prescriptionId: prescription.prescription_id
        };
    }

    // видалення призначення
    async deletePrescription(db, prescriptionId) {
        const id = Number(prescriptionId);

        await db.prescription_medications.deleteMany({
            where: { prescription_id: id }
        });

        await db.prescriptions.delete({
            where: { prescription_id: id }
        });
    }

    // видалення пацієнта
    async deletePatient(db, patientId) {
        const id = Number(patientId);

        const patient = await db.users.findUnique({
            where: { user_id: id },
        });

        if (!patient) {
            throw new Error('Пацієнта не знайдено');
        }

        await db.users.delete({
            where: { user_id: id }
        });

        return { message: 'Пацієнта успішно видалено' };
    }

    // редагування
    async updatePatient(db, id, data) {
        const {
            last_name,
            first_name,
            patronymic,
            email,
            phone,
            contact_info,
            birth_date,
        } = data;

        const existing = await db.users.findUnique({
            where: { user_id: id },
        });

        if (!existing) {
            throw new Error('Пацієнта не знайдено');
        }

        const updated = await db.users.update({
            where: { user_id: id },
            data: {
                last_name,
                first_name,
                patronymic,
                login: email,
                phone,
                contact_info,
                date_of_birth: birth_date ? new Date(birth_date) : null,
            },
        });

        return {
            message: 'Пацієнта успішно оновлено',
            user: {
                id: updated.user_id,
                name: `${updated.last_name} ${updated.first_name} ${updated.patronymic}`,
                email: updated.login,
                phone: updated.phone,
                address: updated.contact_info,
                dob: updated.date_of_birth?.toLocaleDateString('uk-UA'),
            },
        };
    }

    // звіт з лікування для доктора
    async generateTreatmentReport(db, patientId) {
        const patient = await db.users.findUnique({
            where: { user_id: patientId }
        });

        if (!patient) {
            throw new Error(`Пацієнта з ID ${patientId} не знайдено`);
        }

        const prescriptions = await db.prescriptions.findMany({
            where: { patient_id: patientId },
            include: {
                users_prescriptions_doctor_idTousers: true,
                prescription_medications: {
                    include: { medications: true }
                }
            },
            orderBy: { date_issued: 'desc' }
        });

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

        // === Дата та час формування ===
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

        // === Заголовок таблиці
        const headerRow = sheet.addRow(headers);
        headerRow.font = { bold: true };
        headerRow.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
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

        // === Призначення ===
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
            row.height = Math.max(20, medLines * 18); // більше висоти для читабельності

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
    }

    // --- mobile ---


    // історія лікувань для фронтенду (patient)
    async getPrescriptionHistoryByPatient(db, patientId) {
        if (!patientId) {
            throw new Error('patientId is required');
        }

        const history = await db.prescriptions.findMany({
            where: { patient_id: patientId },
            select: {
                prescription_id: true,
                diagnosis: true,
                date_issued: true
            },
            orderBy: {
                date_issued: 'desc'
            }
        });

        return history.map(p => ({
            prescriptionId: p.prescription_id,
            diagnosis: p.diagnosis,
            date: p.date_issued?.toLocaleDateString('uk-UA')
        }));
    }

    // історія лікувань для фронтенду (patient)
    async getPrescriptionDetails(db, prescriptionId) {
        const prescription = await db.prescriptions.findUnique({
            where: { prescription_id: prescriptionId },
            include: {
                users_prescriptions_doctor_idTousers: true,
                prescription_medications: {
                    include: {
                        medications: true
                    }
                }
            }
        });

        if (!prescription) return null;

        const formatDate = (date) =>
            new Date(date).toLocaleDateString('uk-UA');

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

            // Форматуємо час
            if (pm.intake_time && pm.quantity !== null) {
                const timeStr = pm.intake_time.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
                const existing = medsMap[key].intake_times;

                // Додаємо тільки якщо немає дубліката
                const alreadyExists = existing.some(it => it.time === timeStr && it.quantity === pm.quantity);
                if (!alreadyExists) {
                    existing.push({ time: timeStr, quantity: pm.quantity });
                }
            }
        }

        return {
            diagnosis: prescription.diagnosis || "N/A",
            date: formatDate(prescription.date_issued),
            doctor: `${prescription.users_prescriptions_doctor_idTousers.last_name} ${prescription.users_prescriptions_doctor_idTousers.first_name.charAt(0)}.`,
            total_taken: await db.prescription_medications.aggregate({
                where: {
                    prescription_id: prescriptionId,
                    intake_status: true
                },
                _sum: {
                    quantity: true
                }
            }).then(result => result._sum.quantity || 0),
            medications: Object.values(medsMap)
        };
    }

    // звіт в пдф для користувача (patient)
    async generatePrescriptionReport(req, res) {
        const { prescriptionId } = req.body;

        if (!prescriptionId) {
            return res.status(400).json({ message: 'Prescription ID is required' });
        }

        const db = req.db;

        const prescription = await db.prescriptions.findUnique({
            where: { prescription_id: prescriptionId },
            include: {
                users_prescriptions_doctor_idTousers: true,
                users_prescriptions_patient_idTousers: true,
                prescription_medications: {
                    include: {
                        medications: true
                    }
                }
            }
        });

        if (!prescription) return res.status(404).json({ message: 'Prescription not found' });

        const formatDate = (date) => new Date(date).toLocaleDateString('uk-UA');
        const formatDateTime = (date) => new Date(date).toLocaleString('uk-UA');

        const totalTaken = await db.prescription_medications.aggregate({
            where: {
                prescription_id: prescriptionId,
                intake_status: true
            },
            _sum: {
                quantity: true
            }
        }).then(res => res._sum.quantity || 0);

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
                const timeStr = pm.intake_time.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
                const alreadyExists = medsMap[key].intake_times.some(it => it.time === timeStr && it.quantity === pm.quantity);
                if (!alreadyExists) {
                    medsMap[key].intake_times.push({ time: timeStr, quantity: pm.quantity });
                }
            }
        }

        const PDFDocument = (await import('pdfkit')).default;
        const doc = new PDFDocument({ margin: 50 });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=prescription-report.pdf');

        doc.pipe(res);

        doc.registerFont('Roboto', 'fonts/Roboto-Regular.ttf');
        doc.font('Roboto');

        doc.image('public/logo.png', doc.page.width / 2 - 40, 40, { width: 70 }).moveDown(4);

        doc.fontSize(20).text('Звiт про призначення', { align: 'center' }).moveDown();

        const patient = prescription.users_prescriptions_patient_idTousers;
        const fullName = `${patient.last_name} ${patient.first_name} ${patient.patronymic || ''}`.trim();
        const now = new Date();

        doc.fontSize(12)
            .text(`ПIБ пацiєнта: ${fullName}`)
            .text(`Дiагноз: ${prescription.diagnosis || '—'}`)
            .text(`Дата призначення: ${formatDate(prescription.date_issued)}`)
            .text(`Лiкар: ${prescription.users_prescriptions_doctor_idTousers.last_name} ${prescription.users_prescriptions_doctor_idTousers.first_name.charAt(0)}.`)
            .text(`Всього прийнято лiкiв: ${totalTaken}`)
            .text(`Дата формування звiту: ${formatDateTime(now)}`)
            .moveDown();

        doc.fontSize(13).text('Препарати:', { underline: true }).moveDown(0.5);

        let counter = 1;
        for (const med of Object.values(medsMap)) {
            doc.font('Roboto').text(`${counter}. ${med.name}`);
            doc.font('Roboto')
                .text(`   Частота: ${med.frequency}`)
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

        doc.moveDown(2);
        doc.fontSize(10).fillColor('gray')
            .text('StellHeal — Медична інформаційна система', { align: 'center' });
        doc.fontSize(8).fillColor('gray')
            .text('© 2025 StellHeal. Усі права захищено.', { align: 'center' });

        doc.end();
    }

}

// допоміжні функції
function getIntakeTimes(timesPerDay) {
    switch (timesPerDay) {
        case 1:
            return ['10:00'];
        case 2:
            return ['10:00', '15:00'];
        case 3:
            return ['08:00', '14:00', '20:00'];
        case 4:
            return ['08:00', '12:00', '16:00', '20:00'];
        case 5:
            return ['07:00', '10:00', '13:00', '16:00', '19:00'];
        case 6:
            return ['06:00', '09:00', '12:00', '15:00', '18:00', '21:00'];
        case 7:
            return ['06:00', '09:00', '11:00', '13:00', '15:00', '17:00', '19:00'];
        case 8:
            return ['06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00'];
        case 9:
            return ['06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00'];
        case 10:
            return ['06:00', '07:30', '09:00', '10:30', '12:00', '13:30', '15:00', '16:30', '18:00', '19:30'];
        default:
            return ['10:00'];
    }
}

// додавання днів до дати
function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}
