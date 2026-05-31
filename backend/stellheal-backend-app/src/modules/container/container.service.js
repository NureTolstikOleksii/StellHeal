import prisma from '../../config/prisma.js';
import { logAction } from '../../shared/logger/auditLogger.js';
import { ACTIONS } from '../../shared/constants/actions.js';
import {ERROR_CODES} from "../../shared/constants/errorCodes.js";
import {AppError} from "../../shared/errors/AppError.js";
import {generateContainerExcel} from "../../integrations/reports/containerExcel.service.js";


export class ContainerService {


    // ====== Common (WEB and MOBILE) =============================================
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


    // ====== Admin (WEB) =============================================


    // container statistics
    async getContainerStats() {
        const activeCount = await prisma.containers.count({
            where: { status: 'active' }
        });

        const inactiveCount = await prisma.containers.count({
            where: { status: { not: 'active' } }
        });

        return { activeCount, inactiveCount };
    }

    // last fills
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

    // count of containers
    async getTotalContainers() {
        return prisma.containers.count();
    }

    // report from containers
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

        await logAction({
            userId: req.user.userId,
            action: ACTIONS.EXPORT_CONTAINERS,
            entity: 'CONTAINER',
            description: 'Container report exported',
            req
        });

        return buffer;
    }

    // container registration
    async registerContainer(deviceUid, req) {

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

        const container = await prisma.containers.create({
            data: {
                device_uid:      deviceUid,
                device_secret:   deviceSecret,
                container_number: nextNumber,
                status:          'inactive',
                is_online:       false,
            }
        });

        await logAction({
            userId:      req.user.userId,
            action:      ACTIONS.CREATE_STAFF,
            entity:      'CONTAINER',
            entityId:    container.container_id,
            description: `Container registered: ${deviceUid}`,
            req
        });

        return container;
    }

    // delete container
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

        if (container.is_online) {
            throw new AppError(
                ERROR_CODES.CONFLICT,
                'Не можна видалити онлайн-контейнер. Спочатку відключіть пристрій.',
                409
            );
        }

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

    // device log information
    async getContainerEvents(containerId) {
        return prisma.device_events.findMany({
            where:   { container_id: containerId },
            orderBy: { created_at: 'desc' },
            take:    50,
        });
    }

    // information about filling sessions
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

    // information by compartments
    async getAdminCompartments(containerId) {
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
                    take: 1,
                }
            }
        });

        return Array.from({ length: 8 }, (_, i) =>
            compartments.find(c => c.compartment_number === i + 1) || null
        );
    }


    // ====== MOBILE =============================================

    // free containers
    async getFreeContainers() {
        return prisma.containers.findMany({
            where: { patient_id: null },
            orderBy: { container_number: 'asc' }
        });
    }

    // assign
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

    // unassign
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

    // all containers
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

    // container details
    async getContainerDetails(containerId) {
        const container = await prisma.containers.findUnique({
            where: { container_id: containerId },
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

    // today's appointment
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

    // treatment date range
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

    // admission statistics by date
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
}

function combineDateAndTime(date, time) {
    if (!date || !time) return null;
    const datePart = date.toISOString().split('T')[0];
    const timePart = time.toISOString().split('T')[1];
    return `${datePart}T${timePart}`;
}

function formatCompartment(comp, med, quantity, time) {
    if (med && quantity && time) {
        const hour = time instanceof Date
            ? time.toISOString().substring(11, 16)
            : String(time).substring(11, 16);
        return `Comp. ${comp} - ${med} - ${quantity} табл. - ${hour}`;
    } else {
        return `Comp. ${comp} - Вільний`;
    }
}