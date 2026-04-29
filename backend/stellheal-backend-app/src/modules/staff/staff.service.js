import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { sendStaffCredentialsEmail } from '../../integrations/resend/emailService.js';
import ExcelJS from 'exceljs';
import admin from "../../integrations/firebase/firebaseConfig.js";

export class StaffService {
    // отримати список мед. працівників
    async getAllMedicalStaff(db) {
        return await db.users.findMany({
            where: {
                medical_staff: {
                    isNot: null,
                },
            },
            include: {
                medical_staff: true,
                roles: true,
            },
            orderBy: {
                last_name: 'asc',
            },
        });
    }

    // кількість працівників
    async getStaffCount(db) {
        return await db.users.count({
            where: {
                role_id: {
                    in: [1, 2]
                }
            }
        });
    }

    // додати працівника
    async addStaff(db, data) {
        const existingUser = await db.users.findUnique({
            where: { login: data.login }
        });

        if (existingUser) {
            const error = new Error('Користувач з такою поштою вже існує');
            error.statusCode = 400;
            throw error;
        }

        const plainPassword = nanoid(10);
        const hashedPassword = await bcrypt.hash(plainPassword, 10);

        const [createdUser] = await db.$transaction([
            db.users.create({
                data: {
                    first_name: data.first_name,
                    last_name: data.last_name,
                    patronymic: data.patronymic,
                    login: data.login,
                    phone: data.phone,
                    contact_info: data.contact_info,
                    password: hashedPassword,
                    role_id: Number(data.role_id),
                    date_of_birth: data.date_of_birth ? new Date(data.date_of_birth) : null,
                }
            }),
        ]);

        if (data.specialization) {
            await db.medical_staff.create({
                data: {
                    staff_id: createdUser.user_id,
                    specialization: data.specialization,
                    shift: data.shift || null,
                    admission_date: new Date()
                }
            });
        }
        // відправка на пошту
        await sendStaffCredentialsEmail(data.login, plainPassword);

        const now = new Date();
        const notification = await db.notifications.create({
            data: {
                notification_type: 'success',
                message: `Вітаємо вас у системі, ${createdUser.last_name} ${createdUser.first_name}!`,
                sent_date: now,
                sent_time: new Date(now.getTime() + (3 * 60 * 60 * 1000)),
            }
        });

        await db.notification_recipients.create({
            data: {
                notification_id: notification.notification_id,
                user_id: createdUser.user_id,
                is_read: false
            }
        });

        return createdUser;
    }

    // оновлення працівника
    async updateStaff(db, id, data) {
        const role_id = data.role_id;
        const {
            first_name,
            last_name,
            patronymic,
            login,
            phone,
            contact_info,
            date_of_birth,
            specialization,
            shift
        } = data;

        return db.$transaction([
            db.users.update({
                where: { user_id: id },
                data: {
                    first_name,
                    last_name,
                    patronymic,
                    login,
                    phone,
                    contact_info,
                    date_of_birth: date_of_birth ? new Date(date_of_birth) : null,
                    role_id
                }
            }),
            db.medical_staff.upsert({
                where: { staff_id: id },
                update: { specialization, shift },
                create: {
                    staff_id: id,
                    specialization,
                    shift,
                    admission_date: new Date()
                }
            })
        ]);
    }

    // видалити
    async deleteStaff(db, userId) {
        await db.users.delete({
            where: { user_id: userId }
        });
    }

    // експортування в Excel
    async exportStaffToExcel(db) {
        const doctors = await db.users.findMany({
            where: { role_id: 1 },
            include: { medical_staff: true }
        });

        const nurses = await db.users.findMany({
            where: { role_id: 2 },
            include: { medical_staff: true }
        });

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

        // === Дата формування ===
        sheet.mergeCells('A2:J2');
        const dateCell = sheet.getCell('A2');
        dateCell.value = `Дата формування звіту: ${now}`;
        dateCell.font = { italic: true };
        dateCell.alignment = { horizontal: 'left' };

        let currentRow = 3;

        const addStyledRow = (rowData, options = {}) => {
            const row = sheet.insertRow(currentRow++, rowData);
            if (options.bold) row.font = { bold: true };
            if (options.fill) row.eachCell(cell => {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: options.fill },
                };
            });
            if (options.border) row.eachCell(cell => {
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' },
                };
            });
            if (options.alignment) row.alignment = { vertical: 'middle', horizontal: options.alignment };
            return row;
        };

        const headers = ['Прізвище', 'Ім’я', 'По-батькові', 'Дата народження', 'Телефон', 'Пошта', 'Адреса', 'Спеціалізація', 'Зміна', 'Дата працевлаштування'];
        const headerOptions = { bold: true, fill: 'FFF4CC', border: true, alignment: 'center' };

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

        currentRow++; // Пропуск рядка

        // === Медперсонал ===
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

        sheet.columns = [
            { width: 20 }, // Прізвище
            { width: 20 }, // Ім’я
            { width: 20 }, // По-батькові
            { width: 25 }, // Дата народження
            { width: 20 }, // Телефон
            { width: 30 }, // Пошта
            { width: 40 }, // Адреса
            { width: 25 }, // Спеціалізація
            { width: 20 }, // Зміна
            { width: 30 }, // Дата працевлаштування
        ];

        return await workbook.xlsx.writeBuffer();
    }

}
