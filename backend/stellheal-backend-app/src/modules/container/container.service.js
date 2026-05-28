import prisma from '../../config/prisma.js';

import { logAction } from '../../shared/logger/auditLogger.js';
import { ACTIONS } from '../../shared/constants/actions.js';
import {ERROR_CODES} from "../../shared/constants/errorCodes.js";
import {AppError} from "../../shared/errors/AppError.js";
import {generateContainerExcel} from "../../integrations/reports/containerExcel.service.js";
import admin from "firebase-admin";

export class ContainerService {

    // container statistics ok
    async getContainerStats() {
        const activeCount = await prisma.containers.count({
            where: { status: 'active' }
        });

        const inactiveCount = await prisma.containers.count({
            where: { status: { not: 'active' } }
        });

        return { activeCount, inactiveCount };
    }

    // number of containers ok
    async getTotalContainers() {
        return await prisma.containers.count();
    }

    // last fills ok
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

    // report from containers ok
    async exportContainersToExcel(req) {

        const containers = await prisma.containers.findMany({
            orderBy: { container_number: 'asc' },
            include: {
                users: true,
                compartments: {
                    orderBy: { compartment_number: 'asc' },
                    include: {
                        compartment_medications: {
                            orderBy: { compartment_med_id: 'asc' },
                            include: {
                                prescription_medications: {
                                    include: { medications: true }
                                },
                                users: true
                            }
                        }
                    }
                }
            }
        });

        const buffer = await generateContainerExcel(containers);

        // audit log
        await logAction({
            userId: req.user.userId,
            action: ACTIONS.EXPORT_CONTAINERS,
            entity: 'CONTAINER',
            description: 'Container report exported',
            req
        });

        return buffer;
    }


    // --- mobile ---

    // вільні контейнери
    async getFreeContainers() {
        return prisma.containers.findMany({
            where: { patient_id: null },
            orderBy: { container_number: 'asc' }
        });
    }

    // закріплення
    async assignPatientToContainer(containerId, patientId, req) {

        const container = await prisma.containers.findUnique({
            where: { container_id: containerId }
        });

        if (!container) {
            throw new AppError(
                ERROR_CODES.NOT_FOUND,
                `Контейнер не знайдено`,
                404
            );
        }

        if (container.patient_id !== null) {
            throw new AppError(
                ERROR_CODES.VALIDATION_ERROR,
                'Контейнер вже зайнятий',
                400
            );
        }

        const updated = await prisma.containers.update({
            where: { container_id: containerId },
            data: { patient_id: patientId }
        });

        await logAction({
            userId: req.user.userId,
            action: ACTIONS.UPDATE,
            entity: 'CONTAINER',
            entityId: containerId,
            description: `Container assigned to patient ${patientId}`,
            req
        });

        return updated;
    }

    // відкріплення
    async unassignContainer(containerId, patientId, req) {

        const container = await prisma.containers.findUnique({
            where: { container_id: containerId }
        });

        if (!container) {
            throw new AppError(
                ERROR_CODES.NOT_FOUND,
                'Контейнер не знайдено',
                404
            );
        }

        if (container.patient_id !== patientId) {
            throw new AppError(
                ERROR_CODES.VALIDATION_ERROR,
                'Контейнер не належить цьому пацієнту',
                400
            );
        }

        const updated = await prisma.containers.update({
            where: { container_id: containerId },
            data: { patient_id: null }
        });

        await logAction({
            userId: req.user.userId,
            action: ACTIONS.UPDATE,
            entity: 'CONTAINER',
            entityId: containerId,
            description: `Container unassigned from patient ${patientId}`,
            req
        });

        return updated;
    }

    // всі контейнери
    // async getAllContainers() {
    //     return prisma.containers.findMany({
    //         select: {
    //             container_id: true,
    //             container_number: true,
    //             patient_id: true
    //         }
    //     });
    // }

    async getAllContainers() {
        return prisma.containers.findMany({
            include: {
                users: {
                    select: {
                        user_id:    true,
                        first_name: true,
                        last_name:  true,
                    }
                }
            },
            orderBy: { container_number: 'asc' }
        });
    }

    // деталі контейнера
    async getContainerDetails(containerId) {
        const container = await prisma.containers.findUnique({
            where: { container_id: containerId },
            include: {
                compartments: {
                    orderBy: { compartment_number: 'asc' }, // ← сортування
                    include: {
                        compartment_medications: {
                            orderBy: { fill_time: 'desc' },
                            take: 1,
                            include: {
                                prescription_medications: true // medications більше не потрібен
                            }
                        }
                    }
                }
            }
        });

        if (!container) {
            throw new AppError(ERROR_CODES.NOT_FOUND, 'Container not found', 404);
        }

        const compartmentsInfo = container.compartments.map(comp => {
            const med = comp.compartment_medications[0]?.prescription_medications;

            if (!comp.is_filled || !med) {
                return `Comp. ${comp.compartment_number} - Вільний`;
            }

            const medName = med.medication_name || '?'; // ← виправлено
            const quantity = med.quantity || '?';
            const intakeTime = med.intake_time
                ? new Date(med.intake_time).toISOString().substring(11, 16)
                : '??:??';

            return `Comp. ${comp.compartment_number} - ${medName} - ${quantity} табл. - ${intakeTime}`;
        });

        const now = new Date();
        const isOnline = container.last_seen
            ? (now - new Date(container.last_seen)) < 2 * 60 * 1000
            : false;

        return {
            container_number: container.container_number,
            status: container.status || 'inactive',
            is_online: isOnline,
            last_seen: container.last_seen,
            patient_id: container.patient_id || null,
            compartments: compartmentsInfo
        };
    }

    // очищення відсіку
    async clearCompartment(compartmentId, req) {

        const latestEntry = await prisma.compartment_medications.findFirst({
            where: { compartment_id: compartmentId },
            orderBy: { fill_time: 'desc' }
        });

        if (!latestEntry) {
            throw new AppError(
                ERROR_CODES.VALIDATION_ERROR,
                'Compartment is already empty',
                400
            );
        }

        await prisma.compartment_medications.delete({
            where: { compartment_med_id: latestEntry.compartment_med_id }
        });

        await logAction({
            userId: req.user.userId,
            action: ACTIONS.DELETE,
            entity: 'COMPARTMENT',
            entityId: compartmentId,
            description: 'Compartment cleared',
            req
        });

        return { message: 'Compartment cleared' };
    }

    async getTodayPrescriptions(patientId) {
        const start = new Date();
        start.setHours(0, 0, 0, 0);

        const end = new Date();
        end.setHours(23, 59, 59, 999);

        return prisma.prescription_medications.findMany({
            where: {
                prescriptions: {
                    patient_id: patientId,
                    date_issued: { lte: end },
                    end_date: { gte: start }
                },
                intake_date: {
                    gte: start,
                    lte: end
                },
                NOT: {
                    compartment_medications: {
                        some: {}
                    }
                }
            },
            orderBy: [
                { medication_name: 'asc' },
                { intake_time: 'asc' }
            ]
        });
    }

    async getIntakeStatistics(patientId, dateStr) {

        const start = new Date(dateStr);
        start.setHours(0,0,0,0);

        const end = new Date(dateStr);
        end.setHours(23,59,59,999);

        const prescriptions = await prisma.prescription_medications.findMany({
            where: {
                prescriptions: {
                    patient_id: patientId,
                    date_issued: { lte: end },
                    end_date: { gte: start },
                },
                intake_date: {
                    gte: start,
                    lte: end
                }
            },
            include: { medications: true },
            orderBy: { intake_time: 'asc' }
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
            where: { patient_id: patientId },
            _min: { date_issued: true },
            _max: { end_date: true }
        });

        if (!result._min.date_issued || !result._max.end_date) {
            throw new AppError(
                ERROR_CODES.NOT_FOUND,
                'No prescriptions found',
                404
            );
        }

        return {
            minDate: result._min.date_issued.toISOString().split('T')[0],
            maxDate: result._max.end_date.toISOString().split('T')[0],
        };
    }

    async getAllContainerDetails() {
        const containers = await prisma.containers.findMany({
            include: {
                compartments: {
                    orderBy: { compartment_number: 'asc' },
                    include: {
                        compartment_medications: {
                            orderBy: { fill_time: 'desc' },
                            take: 1,
                            include: {
                                prescription_medications: true
                            }
                        }
                    }
                }
            },
            orderBy: { container_number: 'asc' }
        });

        return containers.map(container => {
            // ← isOnline тут, не всередині compartments.map
            const now = new Date();
            const isOnline = container.last_seen
                ? (now - new Date(container.last_seen)) < 2 * 60 * 1000
                : false;

            const compartmentDescriptions = container.compartments.map(comp => {
                const medEntry = comp.compartment_medications[0];
                const pm = medEntry?.prescription_medications;

                return formatCompartment(
                    comp.compartment_number,
                    comp.is_filled ? pm?.medication_name : null,
                    pm?.quantity,
                    pm?.intake_time
                );
            });

            return {
                container_id: container.container_id,
                container_number: container.container_number,
                status: container.status || 'Unknown',
                is_online: isOnline,
                patient_id: container.patient_id,
                compartments: compartmentDescriptions
            };
        });
    }

    //--- ІоТ ---

    // отримання пацієнта закріпленого за контейнером
    async getPatientIdByContainer(containerId) {

        const container = await prisma.containers.findUnique({
            where: { container_id: containerId },
            select: { patient_id: true }
        });

        if (!container) {
            throw new AppError(
                ERROR_CODES.NOT_FOUND,
                'Контейнер не знайдено',
                404
            );
        }

        return container.patient_id;
    }

    // отримання наступного призначення
    async getNextIntake(containerId) {

        const now = new Date();
        const { start: startOfDayUTC, end: endOfDayUTC } = getUTCDayRange(now);

        const compartments = await prisma.compartments.findMany({
            where: { container_id: containerId },
            include: {
                compartment_medications: {
                    where: {
                        open_time: { gt: now }
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
            }
        });

        let nearest = null;

        for (const comp of compartments) {

            const med = comp.compartment_medications?.[0];
            const presc = med?.prescription_medications;

            if (!med || !presc || !presc.medications) continue;

            const openTime = new Date(med.open_time);

            if (openTime > now) {
                if (!nearest || openTime < new Date(nearest.intake_time)) {
                    nearest = {
                        prescription_med_id: presc.prescription_med_id,
                        medication: presc.medications.name,
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
    async updateContainerStatus(containerId, status, req) {

        const container = await prisma.containers.findUnique({
            where: { container_id: containerId }
        });

        if (!container) {
            throw new AppError(
                ERROR_CODES.NOT_FOUND,
                'Контейнер не знайдено',
                404
            );
        }

        const updated = await prisma.containers.update({
            where: { container_id: containerId },
            data: { status }
        });

        await logAction({
            userId: req.user.userId,
            action: ACTIONS.UPDATE,
            entity: 'CONTAINER',
            entityId: containerId,
            description: `Status updated to ${status}`,
            req
        });

        return updated;
    }

    // оновлення статусу прийому
    async updateIntakeStatus(prescription_med_id, status, req) {

        const existing = await prisma.prescription_medications.findUnique({
            where: { prescription_med_id }
        });

        if (!existing) {
            throw new AppError(
                ERROR_CODES.NOT_FOUND,
                'Prescription not found',
                404
            );
        }

        if (existing.intake_status === true && status === false) {
            throw new AppError(
                ERROR_CODES.VALIDATION_ERROR,
                'Cannot revert taken medication',
                400
            );
        }

        const updated = await prisma.prescription_medications.update({
            where: { prescription_med_id },
            data: { intake_status: status }
        });

        await logAction({
            userId: req.user.userId,
            action: ACTIONS.UPDATE,
            entity: 'INTAKE',
            entityId: prescription_med_id,
            description: `Intake status set to ${status}`,
            req
        });

        return updated;
    }

    // відправлення сповіщення про пропуск
    async sendMissedNotification(container_id, prescription_med_id, req) {

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

        if (!container) {
            throw new AppError(ERROR_CODES.NOT_FOUND, 'Container not found', 404);
        }

        const patient = container.users;

        const ward = patient?.prescriptions_prescriptions_patient_idTousers?.[0]?.wards;
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

        if (!prescriptionMed) {
            throw new AppError(ERROR_CODES.NOT_FOUND, 'Prescription medication not found', 404);
        }

        const medName = prescriptionMed.medications?.name || 'невідомо';
        const filledBy = prescriptionMed.compartment_medications[0]?.filled_by;

        if (!filledBy) {
            throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'No nurse filled this medication', 400);
        }

        const nurse = await prisma.users.findUnique({
            where: { user_id: filledBy }
        });

        const message = `Пацієнт ${patient.last_name} ${patient.first_name} ${patient.patronymic || ''} (палата ${ward?.ward_number || '—'}, контейнер №${containerNumber}) пропустив прийом препарату: ${medName}.`;

        const now = new Date();
        const sent_time = new Date(now.getTime() + 3 * 60 * 60 * 1000);
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

        // FCM
        const tokens = [
            patient.firebase_token,
            nurse.firebase_token
        ].filter(Boolean);

        try {
            await Promise.all(tokens.map(token =>
                admin.messaging().send({
                    token,
                    notification: {
                        title: 'Пропущений прийом ліків',
                        body: message
                    }
                })
            ));
        } catch (error) {
            console.error('FCM помилка:', error);
        }

        await logAction({
            userId: req.user.userId,
            action: ACTIONS.CREATE,
            entity: 'NOTIFICATION',
            entityId: notification.notification_id,
            description: 'Missed intake notification sent',
            req
        });

        return notification;
    }

    async sendOpenNotification(container_id, prescription_med_id, req) {

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

        if (!container) {
            throw new AppError(ERROR_CODES.NOT_FOUND, 'Container not found', 404);
        }

        const patient = container.users;
        const containerNumber = container.container_number || '—';

        const prescriptionMed = await prisma.prescription_medications.findUnique({
            where: { prescription_med_id },
            include: { medications: true }
        });

        if (!prescriptionMed) {
            throw new AppError(ERROR_CODES.NOT_FOUND, 'Prescription medication not found', 404);
        }

        const medName = prescriptionMed.medications?.name || 'невідомо';

        const compartment = container.compartments
            .flatMap(c => c.compartment_medications.map(m => ({
                number: c.compartment_number,
                ...m
            })))
            .find(m => m.prescription_med_id === prescription_med_id);

        const compartmentNumber = compartment?.number ?? '—';

        const message = `Час прийняти препарат: ${medName}. Контейнер №${containerNumber}, відсік №${compartmentNumber}.`;

        const now = new Date();
        const sent_time = new Date(now.getTime() + 3 * 60 * 60 * 1000);
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

        // FCM
        if (patient.firebase_token) {
            try {
                await admin.messaging().send({
                    token: patient.firebase_token,
                    notification: {
                        title: 'Нагадування про прийом ліків',
                        body: message
                    }
                });
            } catch (error) {
                console.error('FCM помилка:', error);
            }
        }

        await logAction({
            userId: req.user.userId,
            action: ACTIONS.CREATE,
            entity: 'NOTIFICATION',
            entityId: notification.notification_id,
            description: 'Open notification sent',
            req
        });

        return notification;
    }

    // очищення відсіку
    async clearCompartmentMedication(compartment_id, req) {

        const latest = await prisma.compartment_medications.findFirst({
            where: { compartment_id },
            orderBy: { fill_time: 'desc' }
        });

        if (!latest) {
            throw new AppError(
                ERROR_CODES.VALIDATION_ERROR,
                'Compartment already empty',
                400
            );
        }

        await prisma.compartment_medications.delete({
            where: { compartment_med_id: latest.compartment_med_id }
        });

        await prisma.compartments.update({
            where: { compartment_id: compartment_id },
            data: {
                is_filled: false,
                last_filled_at: null
            }
        });

        await logAction({
            userId: req.user.userId,
            action: ACTIONS.DELETE,
            entity: 'COMPARTMENT',
            entityId: compartment_id,
            description: 'Compartment cleared',
            req
        });

        return { message: 'Compartment cleared successfully' };
    }

    async addMedicationToCompartment(compartmentId, prescription_med_id, req) {

        const userId = req.user.userId;

        // перевірка відсіку
        const compartment = await prisma.compartments.findUnique({
            where: { compartment_id: compartmentId }
        });

        if (!compartment) {
            throw new AppError(
                ERROR_CODES.COMPARTMENT_NOT_FOUND,
                'Compartment not found',
                404
            );
        }

        // перевірка призначення
        const prescription = await prisma.prescription_medications.findUnique({
            where: { prescription_med_id },
            include: {
                prescriptions: true
            }
        });

        if (!prescription) {
            throw new AppError(
                ERROR_CODES.PRESCRIPTION_NOT_FOUND,
                'Prescription medication not found',
                404
            );
        }

        // не дозволяємо повторне заповнення (останній запис)
        const existing = await prisma.compartment_medications.findFirst({
            where: { compartment_id: compartmentId },
            orderBy: { fill_time: 'desc' }
        });

        if (existing) {
            throw new AppError(
                ERROR_CODES.COMPARTMENT_ALREADY_FILLED,
                'Compartment already filled',
                400
            );
        }

        // час
        const now = new Date();
        const ukraineOffset = 3 * 60;
        const fill_time = new Date(now.getTime() + ukraineOffset * 60 * 1000);

        const open_time = new Date(fill_time);

        if (prescription.intake_time) {
            open_time.setHours(prescription.intake_time.getHours());
            open_time.setMinutes(prescription.intake_time.getMinutes());
            open_time.setSeconds(0);
            open_time.setMilliseconds(0);
        }

        const created = await prisma.compartment_medications.create({
            data: {
                compartment_id: compartmentId,
                prescription_med_id,
                filled_by: userId,
                fill_time,
                open_time
            }
        });

        await prisma.compartments.update({
            where: { compartment_id: compartmentId },
            data: {
                is_filled: true,
                last_filled_at: now
            }
        });

        // audit log
        await logAction({
            userId,
            action: ACTIONS.FILL_COMPARTMENT,
            entity: 'COMPARTMENT',
            entityId: compartmentId,
            description: `Medication filled into compartment`,
            req
        });

        return created;
    }

    async getFilledCompartments(containerId) {

        const container = await prisma.containers.findUnique({
            where: { container_id: containerId }
        });

        if (!container) {
            throw new AppError(
                ERROR_CODES.CONTAINER_NOT_FOUND,
                'Container not found',
                404
            );
        }

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

            const med = comp.compartment_medications?.[0];

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

    async registerContainer(deviceUid, req) {
        // Перевірка чи вже існує
        const existing = await prisma.containers.findUnique({
            where: { device_uid: deviceUid }
        });

        if (existing) {
            throw new AppError(
                ERROR_CODES.CONFLICT,
                'Контейнер з таким UID вже зареєстровано',
                409
            );
        }

        // Генеруємо секрет для IoT автентифікації
        const { nanoid } = await import('nanoid');
        const deviceSecret = nanoid(32);

        // Визначаємо наступний порядковий номер
        const lastContainer = await prisma.containers.findFirst({
            orderBy: { container_number: 'desc' }
        });
        const nextNumber = (lastContainer?.container_number || 0) + 1;

        // Створюємо контейнер
        const container = await prisma.containers.create({
            data: {
                device_uid:      deviceUid,
                device_secret:   deviceSecret,
                container_number: nextNumber,
                status:          'inactive',
                is_online:       false,
            }
        });

        // Створюємо 7 відсіків (по дням тижня)
        await prisma.compartments.createMany({
            data: Array.from({ length: 7 }, (_, i) => ({
                container_id:       container.container_id,
                compartment_number: i + 1,
                is_filled:          false,
            }))
        });

        await logAction({
            userId:      req.user.userId,
            action:      ACTIONS.CREATE_STAFF, // або свій ACTIONS.REGISTER_CONTAINER
            entity:      'CONTAINER',
            entityId:    container.container_id,
            description: `Container registered: ${deviceUid}`,
            req
        });

        return container;
    }


    async deleteContainer(containerId, req) {
        const container = await prisma.containers.findUnique({
            where: { container_id: containerId },
            include: { users: { select: { first_name: true, last_name: true } } }
        });

        if (!container) {
            throw new AppError(
                ERROR_CODES.NOT_FOUND,
                'Контейнер не знайдено',
                404
            );
        }

        // Перевіряємо чи контейнер онлайн — видаляти онлайн-пристрій небезпечно
        if (container.is_online) {
            throw new AppError(
                ERROR_CODES.CONFLICT,
                'Не можна видалити онлайн-контейнер. Спочатку відключіть пристрій.',
                409
            );
        }

        // Каскадне видалення через Prisma (compartments → compartment_medications тощо)
        await prisma.containers.delete({
            where: { container_id: containerId }
        });

        await logAction({
            userId:      req.user.userId,
            action:      ACTIONS.SECURITY_EVENT,
            entity:      'CONTAINER',
            entityId:    containerId,
            description: `Container deleted: ${container.device_uid}${
                container.users ? ` (patient: ${container.users.last_name} ${container.users.first_name})` : ''
            }`,
            req
        });
    }



    async getAdminCompartments(containerId) {
        // Отримуємо всі відсіки з ліками для адмін-панелі
        const compartments = await prisma.compartments.findMany({
            where: { container_id: containerId },
            orderBy: { compartment_number: 'asc' },
            include: {
                compartment_medications: {
                    include: {
                        prescription_medications: {
                            select: {
                                medication_name: true,
                                quantity:        true,
                                intake_time:     true,
                            }
                        }
                    },
                    orderBy: { fill_time: 'desc' },
                    take: 1, // останнє заповнення
                }
            }
        });

        // Завжди повертаємо 8 елементів — для відсутніх null
        // (барабан має 8 відсіків незалежно від БД)
        return Array.from({ length: 8 }, (_, i) =>
            compartments.find(c => c.compartment_number === i + 1) || null
        );
    }

    async getContainerEvents(containerId) {
        return prisma.device_events.findMany({
            where:   { container_id: containerId },
            orderBy: { created_at: 'desc' },
            take:    50, // останні 50 подій
        });
    }

    async getContainerSessions(containerId) {
        return prisma.fill_sessions.findMany({
            where:   { container_id: containerId },
            orderBy: { started_at: 'desc' },
            take:    20,
            include: {
                users: {
                    select: {
                        first_name: true,
                        last_name:  true,
                    }
                }
            }
        });
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
        // time приходить як Date з Prisma — конвертуємо в рядок
        const hour = time instanceof Date
            ? time.toISOString().substring(11, 16)
            : String(time).substring(11, 16);
        return `Comp. ${comp} - ${med} - ${quantity} табл. - ${hour}`;
    } else {
        return `Comp. ${comp} - Вільний`;
    }
}

