import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
import admin from '../../integrations/firebase/firebaseConfig.js'; // вже є
import ExcelJS from 'exceljs';

export class ContainerService {

    // отримання статистики контейнерів
    async getContainerStats() {
        const activeCount = await prisma.containers.count({
            where: { status: 'active' }
        });

        const inactiveCount = await prisma.containers.count({
            where: { status: { not: 'active' } }
        });

        return { activeCount, inactiveCount };
    }

    // отримання кількості контейнерів
    async getTotalContainers() {
        const total = await prisma.containers.count();
        return total;
    }

    // отримання останні заповнення контейнерів
    async getLatestFillings() {
        const fillings = await prisma.compartment_medications.findMany({
            where: { fill_time: { not: null } },
            orderBy: { fill_time: 'desc' },
            take: 50,
            include: {
                users: true,
                compartments: {
                    include: {
                        containers: true
                    }
                }
            }
        });

        return fillings.map(f => {
            const containerNumber = f.compartments?.containers?.container_number || '???';
            const compartmentNumber = f.compartments?.compartment_number || '-';

            const fullName = f.users
                ? `${f.users.last_name} ${f.users.first_name} ${f.users.patronymic || ''}`.trim()
                : 'Невідомо';

            const time = f.fill_time
                ? new Date(f.fill_time).toLocaleTimeString('uk-UA', {
                    hour: '2-digit',
                    minute: '2-digit'
                })
                : '??:??';

            return {
                device_code: containerNumber,
                compartment_number: compartmentNumber,
                filled_by: fullName,
                time
            };
        });
    }

    // отримання вільних контейнерів
    async getFreeContainers() {
        return prisma.containers.findMany({
            where: {
                patient_id: null
            },
            orderBy: { container_number: 'asc' }
        });
    }

    // закріплення контейнера за пацієнтом
    async assignPatientToContainer(containerId, patientId) {
        const container = await prisma.containers.findUnique({
            where: { container_id: containerId }
        });

        if (!container) {
            throw new Error(`Контейнер з ID ${containerId} не знайдено`);
        }

        return prisma.containers.update({
            where: { container_id: containerId },
            data: { patient_id: patientId }
        });
    }

    // відкріплення контейнера від пацієнта
    async unassignContainer(containerId, patientId) {
        const container = await prisma.containers.findUnique({
            where: { container_id: containerId }
        });

        if (!container || container.patient_id !== patientId) {
            throw new Error('Контейнер не належить цьому пацієнту');
        }

        return prisma.containers.update({
            where: { container_id: containerId },
            data: { patient_id: null }
        });
    }

    // отримання всіх контейнерів
    async getAllContainers() {
        return prisma.containers.findMany({
            select: {
                container_id: true,
                container_number: true,
                patient_id: true
            }
        });
    }

    // отримання інформації про контейнер
    async getContainerDetails(containerId) {
        const container = await prisma.containers.findUnique({
            where: { container_id: containerId },
            include: {
                compartments: {
                    include: {
                        compartment_medications: {
                            include: {
                                prescription_medications: {
                                    include: {
                                        medications: true
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        if (!container) {
            throw new Error('Container not found');
        }

        const compartmentsInfo = container.compartments.map((comp) => {
            if (!comp.compartment_medications.length) {
                return `Comp. ${comp.compartment_number} - 0`;
            }

            const med = comp.compartment_medications[0]?.prescription_medications;

            const medName = med?.medications?.name || '?';
            const quantity = med?.quantity || '?';
            const rawTime = med?.intake_time;
            const intakeTime = rawTime
                ? rawTime.toISOString().substring(11, 16)
                : '??:??';

            return `Comp. ${comp.compartment_number} - ${medName} - ${quantity} табл. - ${intakeTime}`;
        });

        return {
            container_number: container.container_number,
            status: container.status || 'unknown',
            patient_id: container.patient_id || null,
            compartments: compartmentsInfo
        };
    }

    // очищення відсіку
    async clearCompartment(compartmentId) {
        const latestEntry = await prisma.compartment_medications.findFirst({
            where: { compartment_id: compartmentId },
            orderBy: { fill_time: 'desc' }
        });

        if (!latestEntry) {
            throw new Error('Compartment is already empty or not found');
        }

        await prisma.compartment_medications.delete({
            where: { compartment_med_id: latestEntry.compartment_med_id }
        });

        return { message: 'Compartment cleared' };
    }

    // отримання заповнених контейнерів
    async getFilledCompartments(containerId) {
        const compartments = await prisma.compartments.findMany({
            where: { container_id: containerId },
            include: {
                compartment_medications: {
                    orderBy: { fill_time: 'desc' },
                    take: 1,
                    include: {
                        prescription_medications: {
                            include: {
                                medications: true
                            }
                        }
                    }
                }
            },
            orderBy: { compartment_number: 'asc' }
        });

        return compartments.map(comp => {
            const med = comp.compartment_medications[0];

            return {
                compartment_id: comp.compartment_id,
                compartment_number: comp.compartment_number,
                isFilled: !!med,
                fill_time: med?.fill_time || null,
                medication: med?.prescription_medications?.medications?.name || null,
                quantity: med?.prescription_medications?.quantity || null,
                intake_time: med?.prescription_medications?.intake_time || null
            };
        });
    }

    //  отримання призначень на сьогодні
    async getTodayPrescriptions(patientId) {
        const today = new Date();
        const yyyyMMdd = today.toISOString().split('T')[0]; // "2025-05-18"
        const startOfToday = new Date(yyyyMMdd);

        return prisma.prescription_medications.findMany({
            where: {
                prescriptions: {
                    patient_id: patientId,
                    date_issued: { lte: startOfToday },
                    end_date: { gte: startOfToday }
                },
                intake_date: { equals: startOfToday },
                NOT: {
                    compartment_medications: {
                        some: {}
                    }
                }
            },
            include: {
                medications: true
            },
            orderBy: {
                intake_time: 'asc'
            }
        });
    }

    // додавання препарату до відсіку
    async addMedicationToCompartment(compartmentId, prescription_med_id, filled_by) {
        const now = new Date();
        const ukraineOffset = 3 * 60; // хвилин
        const fill_time = new Date(now.getTime() + ukraineOffset * 60 * 1000);

        const prescription = await prisma.prescription_medications.findUnique({
            where: { prescription_med_id },
            select: { intake_time: true }
        });

        if (!prescription) {
            throw new Error(`Не знайдено призначення з ID ${prescription_med_id}`);
        }

        const intakeTime = prescription.intake_time;
        const open_time = new Date(fill_time);

        if (intakeTime) {
            open_time.setHours(intakeTime.getHours());
            open_time.setMinutes(intakeTime.getMinutes());
            open_time.setSeconds(intakeTime.getSeconds());
            open_time.setMilliseconds(0);
        }

        return prisma.compartment_medications.create({
            data: {
                compartment_id: compartmentId,
                prescription_med_id,
                filled_by,
                fill_time,
                open_time
            }
        });
    }

    // отримання статистики прийому
    async getIntakeStatistics(patientId, dateStr) {
        const date = new Date(dateStr);
        const prescriptions = await prisma.prescription_medications.findMany({
            where: {
                prescriptions: {
                    patient_id: patientId,
                    date_issued: { lte: date },
                    end_date: { gte: date },
                },
                intake_date: { equals: date }
            },
            include: {
                medications: true
            },
            orderBy: {
                intake_time: 'asc'
            }
        });

        return prescriptions.map(p => ({
            prescription_med_id: p.prescription_med_id,
            medication: p.medications?.name || 'Unknown',
            quantity: p.quantity,
            intake_time: combineDateAndTime(p.intake_date, p.intake_time),
            isTaken: p.intake_status
        }));
    }

    // отримання дат для календаря
    async getPrescriptionDateRange(patientId) {
        const result = await prisma.prescriptions.aggregate({
            where: {
                patient_id: patientId,
            },
            _min: {
                date_issued: true,
            },
            _max: {
                end_date: true,
            }
        });

        if (!result._min.date_issued || !result._max.end_date) {
            throw new Error('No prescriptions found');
        }

        return {
            minDate: result._min.date_issued.toISOString().split('T')[0],
            maxDate: result._max.end_date.toISOString().split('T')[0],
        };
    }

    // отримання всіх даних про відсік
    async  getAllContainerDetails() {
        const containers = await prisma.containers.findMany({
            include: {
                compartments: {
                    include: {
                        compartment_medications: {
                            include: {
                                prescription_medications: {
                                    include: {
                                        medications: true
                                    }
                                }
                            }
                        }
                    }
                }
            },
            orderBy: {
                container_number: 'asc'
            }
        });

        return containers.map(container => {
            const compartmentDescriptions = container.compartments.map(comp => {
                const medEntry = comp.compartment_medications[0];
                const medName = medEntry?.prescription_medications?.medications?.name;
                const quantity = medEntry?.prescription_medications?.quantity;
                const time = medEntry?.prescription_medications?.intake_time;

                return formatCompartment(comp.compartment_number, medName, quantity, time);
            });

            return {
                container_id: container.container_id,
                container_number: container.container_number,
                status: container.status || 'Unknown',
                patient_id: container.patient_id,
                compartments: compartmentDescriptions
            };
        });
    }

    // звіт по контейнерам
    async exportContainersToExcel() {
        const containers = await prisma.containers.findMany({
            orderBy: { container_number: 'asc' },
            include: {
                users: true,
                compartments: {
                    orderBy: { compartment_number: 'asc' },
                    include: {
                        compartment_medications: {
                            orderBy: { compartment_med_id: 'asc' }, // додатково
                            include: {
                                prescription_medications: {
                                    include: {
                                        medications: true
                                    }
                                },
                                users: true
                            }
                        }
                    }
                }
            }
        });

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

        // === Дата формування ===
        sheet.mergeCells('A2:G2');
        const dateCell = sheet.getCell('A2');
        dateCell.value = `Дата формування звіту: ${now}`;
        dateCell.font = { italic: true };
        dateCell.alignment = { horizontal: 'left' };

        const headers = ['ID', 'Номер контейнера', 'Пацієнт', 'Статус', 'Відсік', 'Препарат', 'Працівник/час заповнення'];
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
                const medicationName = lastFill?.prescription_medications?.medications?.name || '-';
                const filledBy = lastFill?.users
                    ? `${lastFill.users.last_name} ${lastFill.users.first_name}`
                    : '-';
                const filledAt = lastFill?.fill_time
                    ? new Date(lastFill.fill_time).toLocaleString('uk-UA')
                    : '-';

                const rowData = [
                    idx === 0 ? container.container_id : '',
                    idx === 0 ? container.container_number : '',
                    idx === 0 ? patientName : '',
                    idx === 0 ? container.status : '',
                    compartment.compartment_number || '-',
                    medicationName,
                    filledBy !== '-' && filledAt !== '-' ? `${filledBy} | ${filledAt}` : '-'
                ];

                const row = sheet.addRow(rowData);
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

            if (rowSpan > 1) {
                sheet.mergeCells(`A${startRow}:A${startRow + rowSpan - 1}`);
                sheet.mergeCells(`B${startRow}:B${startRow + rowSpan - 1}`);
                sheet.mergeCells(`C${startRow}:C${startRow + rowSpan - 1}`);
                sheet.mergeCells(`D${startRow}:D${startRow + rowSpan - 1}`);
            }
        });



        return await workbook.xlsx.writeBuffer();
    }

    //--- ІоТ ---

    // отримання пацієнта закріпленого за контейнером
    async getPatientIdByContainer(containerId) {
        const container = await prisma.containers.findUnique({
            where: { container_id: containerId },
            select: { patient_id: true }
        });

        if (!container) {
            throw new Error(`Контейнер з ID ${containerId} не знайдено`);
        }

        return container.patient_id;
    }

    // отримання наступного призначення
    async getNextIntake(containerId) {
        const now = new Date();
        const { start: startOfDayUTC, end: endOfDayUTC } = getUTCDayRange(now);
        const intakeTimeFilter = now;

        /*console.log(intakeTimeFilter);
        console.log(startOfDayUTC);
        console.log(endOfDayUTC);*/

        const compartments = await prisma.compartments.findMany({
            where: { container_id: containerId },
            include: {
                compartment_medications: {
                    where: {
                        open_time: {
                            gt: intakeTimeFilter
                        }
                    },
                    orderBy: { open_time: 'asc' },
                    take: 1,
                    include: {
                        prescription_medications: {
                            where: {
                                intake_status: null,
                                intake_date: {
                                    gte: startOfDayUTC,
                                    lt: endOfDayUTC
                                }
                            },
                            include: {
                                medications: true
                            }
                        }
                    }
                }
            },
            orderBy: { compartment_number: 'asc' }
        });

        let nearest = null;

        for (const comp of compartments) {
            const med = comp.compartment_medications?.[0];
            const presc = med?.prescription_medications;

            if (!med?.open_time || !presc || !presc.medications) continue;

            const openTime = new Date(med.open_time);
            //console.log(openTime)
            if (openTime > now) {
                if (!nearest || openTime < new Date(nearest.intake_time)) {
                    nearest = {
                        prescription_med_id: presc.prescription_med_id,
                        medication: presc.medications.name || '???',
                        intake_time: openTime.toISOString(),
                        compartment_number: comp.compartment_number,
                        compartment_id: comp.compartment_id
                    };
                }
            }
        }

        return nearest;
    }

    // оновлення статусу контейнера
    async updateContainerStatus(containerId, status) {
        try {
            const container = await prisma.containers.findUnique({
                where: { container_id: Number(containerId) }
            });

            if (!container) {
                return null;
            }

            const updated = await prisma.containers.update({
                where: { container_id: Number(containerId) },
                data: { status }
            });

            return updated;
        } catch (error) {
            console.error('Prisma помилка при оновленні статусу:', error);
            throw error;
        }
    }

    // оновлення статусу прийому
    async updateIntakeStatus(prescription_med_id, status) {
        const updated = await prisma.prescription_medications.update({
            where: { prescription_med_id },
            data: { intake_status: status },
        });

        return updated;
    }

    // відправлення сповіщення про пропуск
    async sendMissedNotification(container_id, prescription_med_id) {
        const container = await prisma.containers.findUnique({
            where: { container_id },
            include: {
                users: {
                    include: {
                        prescriptions_prescriptions_patient_idTousers: {
                            include: { wards: true }
                        }
                    }
                }
            }
        });

        if (!container) throw new Error('Container not found');
        const patient = container.users;
        const ward = patient.prescriptions_prescriptions_patient_idTousers?.[0]?.wards;
        const containerNumber = container.container_number || '—';

        const prescriptionMed = await prisma.prescription_medications.findUnique({
            where: { prescription_med_id },
            include: {
                medications: true,
                compartment_medications: {
                    where: { filled_by: { not: null } },
                    orderBy: { open_time: 'desc' },
                    take: 1
                }
            }
        });

        if (!prescriptionMed) throw new Error('Prescription medication not found');
        const medName = prescriptionMed.medications?.name || 'невідомо';
        const filledBy = prescriptionMed.compartment_medications[0]?.filled_by;

        if (!filledBy) throw new Error('No nurse filled this medication');

        const nurse = await prisma.users.findUnique({ where: { user_id: filledBy } });

        const message = `Пацієнт ${patient.last_name} ${patient.first_name} ${patient.patronymic || ''} (палата ${ward?.ward_number || '—'}, контейнер №${containerNumber}) пропустив прийом препарату: ${medName}.`;

        const now = new Date();
        const sent_time = new Date(now.getTime() + (3 * 60 * 60 * 1000));
        const { start: sent_date } = getUTCDayRange(now);

        const notification = await prisma.notifications.create({
            data: {
                notification_type: 'warning',
                message: message.trim(),
                sent_time,
                sent_date,
                container_id
            }
        });

        await prisma.notification_recipients.createMany({
            data: [
                { notification_id: notification.notification_id, user_id: patient.user_id },
                { notification_id: notification.notification_id, user_id: nurse.user_id }
            ],
            skipDuplicates: true
        });

        // ==== 🔔 Відправка FCM-повідомлень ====
        const tokens = [
            patient.firebase_token,
            nurse.firebase_token
        ].filter(Boolean); // залишити лише не-null

        const fcmSends = tokens.map(token =>
            admin.messaging().send({
                token,
                notification: {
                    title: 'Пропущений прийом ліків',
                    body: message
                }
            })
        );

        try {
            await Promise.all(fcmSends);
            console.log('Сповіщення через FCM відправлені');
        } catch (error) {
            console.error('FCM помилка:', error);
        }


        return notification;
    }

    // відправлення сповіщення про прийом
    async sendOpenNotification(container_id, prescription_med_id) {
        const container = await prisma.containers.findUnique({
            where: { container_id },
            include: {
                users: true,
                compartments: {
                    include: {
                        compartment_medications: {
                            where: { prescription_med_id },
                            take: 1,
                            orderBy: { open_time: 'desc' }
                        }
                    }
                }
            }
        });

        if (!container) throw new Error('Container not found');
        const patient = container.users;
        const containerNumber = container.container_number || '—';

        const prescriptionMed = await prisma.prescription_medications.findUnique({
            where: { prescription_med_id },
            include: { medications: true }
        });

        if (!prescriptionMed) throw new Error('Prescription medication not found');
        const medName = prescriptionMed.medications?.name || 'невідомо';

        const compartment = container.compartments.flatMap(c => c.compartment_medications.map(m => ({
            number: c.compartment_number,
            ...m
        }))).find(m => m.prescription_med_id === prescription_med_id);

        const compartmentNumber = compartment?.number ?? '—';

        const message = `Час прийняти препарат: ${medName}. Контейнер №${containerNumber}, відсік №${compartmentNumber}.`;

        const now = new Date();
        const sent_time = new Date(now.getTime() + (3 * 60 * 60 * 1000));
        const { start: sent_date } = getUTCDayRange(now);

        const notification = await prisma.notifications.create({
            data: {
                notification_type: 'info',
                message,
                sent_time,
                sent_date,
                container_id
            }
        });

        await prisma.notification_recipients.create({
            data: {
                notification_id: notification.notification_id,
                user_id: patient.user_id
            }
        });

        // ====  FCM ====
        if (patient.firebase_token) {
            try {
                await admin.messaging().send({
                    token: patient.firebase_token,
                    notification: {
                        title: 'Нагадування про прийом ліків',
                        body: message
                    }
                });
                console.log('FCM повідомлення надіслано пацієнту');
            } catch (error) {
                console.error('FCM помилка:', error);
            }
        }

        return notification;
    }

    // очищення відсіку
    async clearCompartmentMedication(compartment_id) {
        await prisma.compartment_medications.deleteMany({
            where: { compartment_id }
        });

        return { success: true };
    }

}

function getUTCDayRange(date = new Date()) {
    const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1));
    return { start, end };
}

function combineDateAndTime(date, time) {
    if (!date || !time) return null;
    const datePart = date.toISOString().split('T')[0];
    const timePart = time.toISOString().split('T')[1];
    return `${datePart}T${timePart}`;
}

function formatCompartment(comp, med, quantity, time) {
    if (med && quantity && time) {
        const hour = time.toISOString().substring(11, 16);
        return `Comp. ${comp} - ${med} - ${quantity} табл. - ${hour}`;
    } else {
        return `Comp. ${comp} - 0`;
    }
}
