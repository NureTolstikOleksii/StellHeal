import prisma from '../../config/prisma.js';
import { logAction } from '../../shared/logger/auditLogger.js';
import { ACTIONS } from '../../shared/constants/actions.js';
import { ERROR_CODES } from '../../shared/constants/errorCodes.js';
import { AppError } from '../../shared/errors/AppError.js';
import { generateContainerExcel } from '../../integrations/reports/containerExcel.service.js';

export class ContainerService {

    // ====== Common (WEB and MOBILE) =============================================

    async getAllContainers() {
        return prisma.containers.findMany({
            include: {
                users: {
                    select: { user_id: true, first_name: true, last_name: true }
                }
            },
            orderBy: { container_number: 'asc' }
        });
    }

    // ====== Admin (WEB) =============================================

    async getContainerStats() {
        const activeCount = await prisma.containers.count({
            where: { status: 'active' }
        });
        const inactiveCount = await prisma.containers.count({
            where: { status: { not: 'active' } }
        });
        return { activeCount, inactiveCount };
    }

    async getLatestFillings() {
        const fillings = await prisma.compartment_medications.findMany({
            where:   { fill_time: { not: null } },
            orderBy: { fill_time: 'desc' },
            take:    50,
            include: {
                users: true,
                compartments: { include: { containers: true } }
            }
        });

        return fillings.map(f => ({
            device_code:        f.compartments?.containers?.container_number || '???',
            compartment_number: f.compartments?.compartment_number || '-',
            filled_by: f.users
                ? `${f.users.last_name} ${f.users.first_name} ${f.users.patronymic || ''}`.trim()
                : 'Unknown',
            fill_time: f.fill_time?.toISOString() ?? null,
        }));
    }

    async getTotalContainers() {
        return prisma.containers.count();
    }

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
            userId:      req.user.userId,
            action:      ACTIONS.EXPORT_CONTAINERS,
            entity:      'CONTAINER',
            description: 'Container report exported',
            req
        });

        return buffer;
    }

    async registerContainer(deviceUid, req) {
        const existing = await prisma.containers.findUnique({
            where: { device_uid: deviceUid }
        });

        if (existing) {
            throw new AppError(ERROR_CODES.CONFLICT, 'A container with this UID is already registered.', 409);
        }

        const { nanoid } = await import('nanoid');
        const deviceSecret = nanoid(32);

        const lastContainer = await prisma.containers.findFirst({
            orderBy: { container_number: 'desc' }
        });
        const nextNumber = (lastContainer?.container_number || 0) + 1;

        const container = await prisma.containers.create({
            data: {
                device_uid:       deviceUid,
                device_secret:    deviceSecret,
                container_number: nextNumber,
                status:           'inactive',
                is_online:        false,
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

    async deleteContainer(containerId, req) {
        const container = await prisma.containers.findUnique({
            where:   { container_id: containerId },
            include: { users: { select: { first_name: true, last_name: true } } }
        });

        if (!container) {
            throw new AppError(ERROR_CODES.NOT_FOUND, 'Container not found', 404);
        }

        if (container.is_online) {
            throw new AppError(
                ERROR_CODES.CONFLICT,
                'Unable to delete online container. Disconnect the device first.',
                409
            );
        }

        await prisma.containers.delete({ where: { container_id: containerId } });

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

    async getContainerEvents(containerId) {
        const events = await prisma.device_events.findMany({
            where:   { container_id: containerId },
            orderBy: { created_at: 'desc' },
            take:    50,
        });

        return events.map(e => ({
            ...e,
            created_at: e.created_at?.toISOString() ?? null,
        }));
    }

    async getContainerSessions(containerId) {
        const sessions = await prisma.fill_sessions.findMany({
            where:   { container_id: containerId },
            orderBy: { started_at: 'desc' },
            take:    20,
            include: {
                users: { select: { first_name: true, last_name: true } }
            }
        });

        return sessions.map(s => ({
            ...s,
            started_at:  s.started_at?.toISOString()  ?? null,
            finished_at: s.finished_at?.toISOString() ?? null,
        }));
    }

    async getAdminCompartments(containerId) {
        const compartments = await prisma.compartments.findMany({
            where:   { container_id: containerId },
            orderBy: { compartment_number: 'asc' },
            include: {
                compartment_medications: {
                    include: {
                        prescription_medications: {
                            select: {
                                medication_name: true,
                                quantity:        true,
                                intake_at:       true,
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

    async getFreeContainers() {
        return prisma.containers.findMany({
            where:   { patient_id: null },
            orderBy: { container_number: 'asc' }
        });
    }

    async assignPatientToContainer(containerId, patientId, req) {
        const container = await prisma.containers.findUnique({
            where: { container_id: containerId }
        });

        if (!container) {
            throw new AppError(ERROR_CODES.NOT_FOUND, 'Container not found', 404);
        }

        if (container.patient_id !== null) {
            throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Container already occupied', 400);
        }

        const updated = await prisma.containers.update({
            where: { container_id: containerId },
            data:  { patient_id: patientId }
        });

        await logAction({
            userId:      req.user.userId,
            action:      ACTIONS.UPDATE,
            entity:      'CONTAINER',
            entityId:    containerId,
            description: `Container assigned to patient ${patientId}`,
            req
        });

        return updated;
    }

    async unassignContainer(containerId, patientId, req) {
        const container = await prisma.containers.findUnique({
            where: { container_id: containerId }
        });

        if (!container) {
            throw new AppError(ERROR_CODES.NOT_FOUND, 'Контейнер не знайдено', 404);
        }

        if (container.patient_id !== patientId) {
            throw new AppError(
                ERROR_CODES.VALIDATION_ERROR,
                'he container does not belong to this patient.',
                400
            );
        }

        const updated = await prisma.containers.update({
            where: { container_id: containerId },
            data:  { patient_id: null }
        });

        await logAction({
            userId:      req.user.userId,
            action:      ACTIONS.UPDATE,
            entity:      'CONTAINER',
            entityId:    containerId,
            description: `Container unassigned from patient ${patientId}`,
            req
        });

        return updated;
    }

    async getAllContainerDetails() {
        const containers = await prisma.containers.findMany({
            include: {
                compartments: {
                    orderBy: { compartment_number: 'asc' },
                    include: {
                        compartment_medications: {
                            orderBy: { fill_time: 'desc' },
                            take:    1,
                            include: { prescription_medications: true }
                        }
                    }
                }
            },
            orderBy: { container_number: 'asc' }
        });

        return containers.map(container => {
            const now      = new Date();
            const isOnline = container.last_seen
                ? (now - new Date(container.last_seen)) < 2 * 60 * 1000
                : false;

            const compartmentsData = container.compartments.map(comp => {
                const medEntry = comp.compartment_medications[0];
                const pm       = medEntry?.prescription_medications;

                return {
                    compartment_number: comp.compartment_number,
                    is_filled:          comp.is_filled,
                    medication_name:    comp.is_filled ? (pm?.medication_name || null) : null,
                    quantity:           comp.is_filled ? (pm?.quantity || null) : null,
                    intake_at:          comp.is_filled ? (pm?.intake_at?.toISOString() || null) : null
                };
            });

            return {
                container_id:     container.container_id,
                container_number: container.container_number,
                status:           container.status || 'Unknown',
                is_online:        isOnline,
                patient_id:       container.patient_id,
                compartments:     compartmentsData
            };
        });
    }

    async getContainerDetails(containerId) {
        const container = await prisma.containers.findUnique({
            where:   { container_id: containerId },
            include: {
                compartments: {
                    orderBy: { compartment_number: 'asc' },
                    include: {
                        compartment_medications: {
                            orderBy: { fill_time: 'desc' },
                            take:    1,
                            include: { prescription_medications: true }
                        }
                    }
                }
            }
        });

        if (!container) {
            throw new AppError(ERROR_CODES.NOT_FOUND, 'Container not found', 404);
        }

        const compartmentsData = container.compartments.map(comp => {
            const medEntry = comp.compartment_medications[0];
            const pm       = medEntry?.prescription_medications;

            return {
                compartment_number: comp.compartment_number,
                is_filled:          comp.is_filled,
                medication_name:    comp.is_filled ? (pm?.medication_name || null) : null,
                quantity:           comp.is_filled ? (pm?.quantity || null) : null,
                intake_at:          comp.is_filled ? (pm?.intake_at?.toISOString() || null) : null
            };
        });

        const now      = new Date();
        const isOnline = container.last_seen
            ? (now - new Date(container.last_seen)) < 2 * 60 * 1000
            : false;

        return {
            container_id:     container.container_id,
            container_number: container.container_number,
            status:           container.status || 'inactive',
            is_online:        isOnline,
            last_seen:        container.last_seen?.toISOString() ?? null,
            patient_id:       container.patient_id || null,
            compartments:     compartmentsData
        };
    }

    async getTodayPrescriptions(patientId, dateStr) {
        const todayStart = new Date(`${dateStr}T00:00:00.000Z`);
        const todayEnd   = new Date(`${dateStr}T23:59:59.999Z`);
        const now        = new Date();

        return prisma.prescription_medications.findMany({
            where: {
                prescriptions: {
                    patient_id:  patientId,
                    date_issued: { lte: todayEnd },
                    end_date:    { gte: todayStart }
                },
                intake_status: null,
                intake_at: {
                    gte: now,
                    lte: todayEnd
                },
                NOT: {
                    compartment_medications: { some: {} }
                }
            },
            orderBy: [
                { medication_name: 'asc' },
                { intake_at:       'asc' }
            ]
        });
    }

    async getPrescriptionDateRange(patientId) {
        const result = await prisma.prescriptions.aggregate({
            where: {
                patient_id: patientId,
                end_date:   { gte: new Date() }
            },
            _min: { date_issued: true },
            _max: { end_date:    true }
        });

        if (!result._min.date_issued || !result._max.end_date) {
            throw new AppError(ERROR_CODES.NOT_FOUND, 'No prescriptions found', 404);
        }

        return {
            minDate: result._min.date_issued.toISOString().split('T')[0],
            maxDate: result._max.end_date.toISOString().split('T')[0],
        };
    }

    async getIntakeStatistics(patientId, dateStr) {
        const dayStart = new Date(`${dateStr}T00:00:00.000Z`);
        const dayEnd   = new Date(`${dateStr}T23:59:59.999Z`);

        const medications = await prisma.prescription_medications.findMany({
            where: {
                prescriptions: {
                    patient_id:  patientId,
                    date_issued: { lte: dayEnd },
                    end_date:    { gte: dayStart },
                },
                intake_at: { gte: dayStart, lte: dayEnd }
            },
            include:  { medications: true },
            orderBy:  { intake_at: 'asc' }
        });

        return medications.map(p => ({
            prescription_med_id: p.prescription_med_id,
            medication:          p.medications?.name || p.medication_name || 'Unknown',
            quantity:            p.quantity,
            intake_at:           p.intake_at?.toISOString() ?? null,
            isTaken:             p.intake_status
        }));
    }
}