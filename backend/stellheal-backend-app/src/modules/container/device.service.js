import prisma from "../../config/prisma.js";
import jwt from "jsonwebtoken";
import { AppError } from "../../shared/errors/AppError.js";
import { ERROR_CODES } from "../../shared/constants/errorCodes.js";
import { logAction } from "../../shared/logger/auditLogger.js";
import { ACTIONS } from "../../shared/constants/actions.js";

export class DeviceService {

    async authenticate(device_uid, secret) {
        const container = await prisma.containers.findFirst({
            where: { device_uid }
        });

        if (!container) {
            throw new AppError(ERROR_CODES.NOT_FOUND, "Device not found", 404);
        }

        if (container.device_secret !== secret) {
            await this.logDeviceEvent(container.container_id, "warning", "AUTH_FAILED", `Invalid secret for device ${device_uid}`);
            throw new AppError(ERROR_CODES.UNAUTHORIZED, "Invalid device credentials", 401);
        }

        const token = jwt.sign(
            { containerId: container.container_id, type: "device" },
            process.env.JWT_SECRET,
            { expiresIn: "30d" }
        );

        await prisma.containers.update({
            where: { container_id: container.container_id },
            data: {
                device_token: token,
                is_online:    true,
                last_seen:    new Date()
            }
        });

        await this.logDeviceEvent(container.container_id, "info", "AUTH_OK", `Device authenticated: ${device_uid}`);

        return { token, container_id: container.container_id };
    }

    async heartbeat(containerId) {
        const now = new Date();

        await prisma.containers.update({
            where: { container_id: containerId },
            data:  { last_seen: now, is_online: true }
        });

        return { message: "Heartbeat received", server_time: now.toISOString() };
    }

    async getPendingCommands(containerId) {
        return prisma.device_commands.findMany({
            where:   { container_id: containerId, status: "pending" },
            orderBy: { created_at: "asc" }
        });
    }

    async completeCommand(commandId) {
        const cmd = await prisma.device_commands.update({
            where: { id: Number(commandId) },
            data:  { status: "done", executed_at: new Date() }
        });

        await this.logDeviceEvent(cmd.container_id, "info", "COMMAND_DONE", `Command completed: ${cmd.command} (id=${commandId})`);

        return { message: "Command completed" };
    }

    async getNextIntake(containerId) {
        const container = await prisma.containers.findUnique({
            where: { container_id: containerId }
        });

        if (!container?.patient_id) {
            throw new AppError(ERROR_CODES.NOT_FOUND, "Container not assigned to patient", 404);
        }

        const now = new Date();

        // ← тільки майбутні прийоми
        const nextMed = await prisma.prescription_medications.findFirst({
            where: {
                prescriptions:           { patient_id: container.patient_id },
                intake_status:           null,
                compartment_medications: { some: {} },
                intake_at:               { gte: now }
            },
            orderBy: { intake_at: "asc" }
        });

        if (!nextMed) return null;

        const compartmentMed = await prisma.compartment_medications.findFirst({
            where:   { prescription_med_id: nextMed.prescription_med_id },
            include: { compartments: true }
        });

        if (!compartmentMed?.compartments) {
            throw new AppError(ERROR_CODES.NOT_FOUND, "Medication not loaded into container", 404);
        }

        return {
            prescription_med_id: nextMed.prescription_med_id,
            compartment_number:  compartmentMed.compartments.compartment_number,
            intake_at:           nextMed.intake_at?.toISOString() ?? null,
            medication_name:     nextMed.medication_name || "Unknown"
        };
    }

    async confirmIntake(containerId, prescriptionMedId) {
        const med = await prisma.prescription_medications.findUnique({
            where: { prescription_med_id: prescriptionMedId }
        });

        if (!med) {
            throw new AppError(ERROR_CODES.NOT_FOUND, "Prescription medication not found", 404);
        }

        if (med.intake_status === true) {
            return { message: "Already taken" };
        }

        const now = new Date();

        await prisma.prescription_medications.update({
            where: { prescription_med_id: prescriptionMedId },
            data:  { intake_status: true }
        });

        const compartmentMed = await prisma.compartment_medications.findFirst({
            where: { prescription_med_id: prescriptionMedId }
        });

        if (compartmentMed) {
            await prisma.compartment_medications.update({
                where: { compartment_med_id: compartmentMed.compartment_med_id },
                data:  { open_time: now }
            });

            await prisma.compartments.update({
                where: { compartment_id: compartmentMed.compartment_id },
                data:  { is_filled: false, last_filled_at: null }
            });

            await prisma.compartment_medications.delete({
                where: { compartment_med_id: compartmentMed.compartment_med_id }
            });
        }

        await this.logDeviceEvent(containerId, "info", "INTAKE_CONFIRMED", `Acceptance confirmed: prescription_med_id=${prescriptionMedId}`);

        await logAction({
            action:      ACTIONS.UPDATE,
            entity:      'PRESCRIPTION_MED',
            entityId:    prescriptionMedId,
            description: `Intake confirmed by device (container_id=${containerId})`,
        });

        return { message: "Intake confirmed", time: now.toISOString() };
    }

    async startFill(containerId) {
        const free = await this.getFreeCompartment(containerId);
        await this.createRotateCommand(containerId, free.compartment_number);
        await this.logDeviceEvent(containerId, "info", "FILL_START", `Fill started, rotating to compartment ${free.compartment_number}`);
        return { compartment: free.compartment_number };
    }

    async getFreeCompartment(containerId) {
        const free = await prisma.compartments.findFirst({
            where:   { container_id: containerId, is_filled: false },
            orderBy: { compartment_number: "asc" }
        });

        if (!free) {
            await this.logDeviceEvent(containerId, "warning", "NO_FREE_COMPARTMENTS", "All compartments are filled");
            throw new AppError(ERROR_CODES.NOT_FOUND, "No free compartments", 404);
        }

        return free;
    }

    async createRotateCommand(containerId, compartmentNumber) {
        return prisma.device_commands.create({
            data: {
                container_id: containerId,
                command:      "rotate_to",
                payload:      { compartment: compartmentNumber }
            }
        });
    }

    async fillCompartment(containerId, compartmentNumber, prescriptionMedId, userId) {
        const compartment = await prisma.compartments.findFirst({
            where: { container_id: containerId, compartment_number: compartmentNumber }
        });

        if (!compartment) {
            throw new AppError(ERROR_CODES.NOT_FOUND, "Compartment not found", 404);
        }

        if (compartment.is_filled) {
            await this.logDeviceEvent(containerId, "warning", "ALREADY_FILLED", `Compartment ${compartmentNumber} already filled`);
            throw new AppError(ERROR_CODES.VALIDATION_ERROR, "Compartment already filled", 400);
        }

        const activeSession = await prisma.fill_sessions.findFirst({
            where: { container_id: containerId, status: "active" }
        });

        const now = new Date();

        await prisma.compartment_medications.create({
            data: {
                compartment_id:      compartment.compartment_id,
                prescription_med_id: prescriptionMedId,
                filled_by:           userId,
                fill_time:           now,
                fill_session_id:     activeSession?.session_id ?? null,
            }
        });

        await prisma.compartments.update({
            where: { compartment_id: compartment.compartment_id },
            data:  { is_filled: true, last_filled_at: now }
        });

        await this.logDeviceEvent(containerId, "info", "COMPARTMENT_FILLED", `Compartment ${compartmentNumber} filled (med_id=${prescriptionMedId}, session=${activeSession?.session_id ?? 'none'})`);

        await logAction({
            userId:      userId,
            action:      ACTIONS.UPDATE,
            entity:      'COMPARTMENT',
            entityId:    compartment.compartment_id,
            description: `Compartment ${compartmentNumber} filled with prescription_med_id=${prescriptionMedId}`,
        });

        return { message: "Compartment filled" };
    }

    async getCompartments(containerId) {
        const compartments = await prisma.compartments.findMany({
            where:   { container_id: containerId },
            orderBy: { compartment_number: "asc" },
            include: {
                compartment_medications: {
                    orderBy: { fill_time: "desc" },
                    take:    1,
                    include: {
                        prescription_medications: {
                            include: { medications: true }
                        }
                    }
                }
            }
        });

        return compartments.map(c => {
            const med      = c.compartment_medications[0]?.prescription_medications;
            const med_info = med?.medications;

            return {
                compartment_id:     c.compartment_id,
                compartment_number: c.compartment_number,
                is_filled:          c.is_filled,
                last_filled_at:     c.last_filled_at?.toISOString() ?? null,
                medication: med_info ? {
                    name:      med_info.name,
                    dosage:    med_info.dosage,
                    intake_at: med?.intake_at?.toISOString() ?? null,
                } : null
            };
        });
    }

    async rotateToCompartment(containerId, compartmentNumber) {
        const compartment = await prisma.compartments.findFirst({
            where: { container_id: containerId, compartment_number: compartmentNumber }
        });

        if (!compartment) {
            await this.logDeviceEvent(containerId, "error", "COMPARTMENT_NOT_FOUND", `Compartment ${compartmentNumber} not found`);
            throw new AppError(ERROR_CODES.NOT_FOUND, "Compartment not found", 404);
        }

        await this.createRotateCommand(containerId, compartmentNumber);

        await prisma.device_commands.create({
            data: {
                container_id: containerId,
                command:      "open_lid",
                payload:      {}
            }
        });

        await this.logDeviceEvent(containerId, "info", "ROTATE_COMMAND_SENT", `Rotate to compartment ${compartmentNumber} command sent`);

        return { message: "Rotate command sent", compartment_number: compartmentNumber };
    }

    async clearCompartment(containerId, compartmentId, compartmentNumber) {
        const latest = await prisma.compartment_medications.findFirst({
            where:   { compartment_id: compartmentId },
            orderBy: { fill_time: "desc" }
        });

        if (!latest) {
            await this.logDeviceEvent(containerId, "warning", "ALREADY_EMPTY", `Compartment ${compartmentNumber} already empty`);
            throw new AppError(ERROR_CODES.NOT_FOUND, "Compartment already empty", 400);
        }

        await prisma.compartment_medications.delete({
            where: { compartment_med_id: latest.compartment_med_id }
        });

        await prisma.compartments.update({
            where: { compartment_id: compartmentId },
            data:  { is_filled: false, last_filled_at: null }
        });

        await this.logDeviceEvent(containerId, "info", "COMPARTMENT_CLEARED", `Compartment ${compartmentNumber} cleared`);

        return { message: "Compartment cleared" };
    }

    async updateRfidStatus(containerId, authenticated) {
        await prisma.containers.update({
            where: { container_id: containerId },
            data:  { rfid_authenticated: authenticated }
        });

        if (authenticated) {
            const staffUser = await prisma.users.findFirst({
                where: { role_id: 2 }
            });

            if (staffUser) {
                await this.startFillSession(containerId, staffUser.user_id);
            }

            await this.logDeviceEvent(containerId, "info", "RFID_AUTH", "Медсестра авторизувалась через RFID");
        } else {
            await this.logDeviceEvent(containerId, "info", "RFID_LOGOUT", "RFID сесія завершена");
        }

        return { message: "RFID status updated" };
    }

    async getRfidStatus(containerId) {
        const container = await prisma.containers.findUnique({
            where:  { container_id: containerId },
            select: { rfid_authenticated: true }
        });

        return { rfid_authenticated: container?.rfid_authenticated ?? false };
    }

    async resetRfid(containerId) {
        await prisma.containers.update({
            where: { container_id: containerId },
            data:  { rfid_authenticated: false }
        });

        await this.finishFillSession(containerId);

        await this.logDeviceEvent(containerId, "info", "FILL_SESSION_FINISHED", "Сесія заповнення завершена медсестрою");

        await prisma.device_commands.create({
            data: {
                container_id: containerId,
                command:      "close_lid",
                payload:      {}
            }
        });

        return { message: "RFID reset" };
    }

    async startFillSession(containerId, userId) {
        await prisma.fill_sessions.updateMany({
            where: { container_id: containerId, status: "active" },
            data:  { status: "finished", finished_at: new Date() }
        });

        const session = await prisma.fill_sessions.create({
            data: {
                container_id: containerId,
                started_by:   userId,
                status:       "active"
            }
        });

        await this.logDeviceEvent(containerId, "info", "FILL_SESSION_STARTED", `Fill session started by user_id=${userId} (session_id=${session.session_id})`);

        await logAction({
            userId:      userId,
            action:      ACTIONS.UPDATE,
            entity:      'FILL_SESSION',
            entityId:    session.session_id,
            description: `Fill session started for container_id=${containerId}`,
        });

        return session;
    }

    async finishFillSession(containerId) {
        const result = await prisma.fill_sessions.updateMany({
            where: { container_id: containerId, status: "active" },
            data:  { status: "finished", finished_at: new Date() }
        });

        return result;
    }

    async getActiveFillSession(containerId) {
        return prisma.fill_sessions.findFirst({
            where: { container_id: containerId, status: "active" }
        });
    }

    async logDeviceEvent(containerId, type, code, message) {
        return prisma.device_events.create({
            data: {
                container_id: containerId,
                type,
                code:    code    || null,
                message: message || null
            }
        });
    }
}