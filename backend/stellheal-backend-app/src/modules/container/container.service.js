import prisma from '../../config/prisma.js';

import { logAction } from '../../shared/logger/auditLogger.js';
import { ACTIONS } from '../../shared/constants/actions.js';
import {ERROR_CODES} from "../../shared/constants/errorCodes.js";
import {AppError} from "../../shared/errors/AppError.js";
import {generateContainerExcel} from "../../integrations/reports/containerExcel.service.js";

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

        // 🔥 важлива перевірка
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
    async getAllContainers() {
        return prisma.containers.findMany({
            select: {
                container_id: true,
                container_number: true,
                patient_id: true
            }
        });
    }

    // деталі контейнера
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
            throw new AppError(
                ERROR_CODES.NOT_FOUND,
                'Container not found',
                404
            );
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
        start.setHours(0,0,0,0);

        const end = new Date();
        end.setHours(23,59,59,999);

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
            include: { medications: true },
            orderBy: { intake_time: 'asc' }
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
                    }
                }
            },
            orderBy: { container_number: 'asc' }
        });

        return containers.map(container => {

            const compartmentDescriptions = container.compartments.map(comp => {

                const medEntry = comp.compartment_medications[0];

                const medName = medEntry?.prescription_medications?.medications?.name;
                const quantity = medEntry?.prescription_medications?.quantity;
                const time = medEntry?.prescription_medications?.intake_time;

                return formatCompartment(
                    comp.compartment_number,
                    medName,
                    quantity,
                    time
                );
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

        // 🔥 важливо: не даємо змінювати вже прийнятий назад
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

        // 🔔 FCM
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

        // 🔔 FCM
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
