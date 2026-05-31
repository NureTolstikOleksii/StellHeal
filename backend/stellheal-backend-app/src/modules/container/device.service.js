import prisma from "../../config/prisma.js";
import jwt from "jsonwebtoken";
import { AppError } from "../../shared/errors/AppError.js";
import { ERROR_CODES } from "../../shared/constants/errorCodes.js";

export class DeviceService {

    async authenticate(device_uid, secret) {
        const container = await prisma.containers.findFirst({
            where: { device_uid }
        });

        if (!container) {
            throw new AppError(ERROR_CODES.NOT_FOUND, "Device not found", 404);
        }

        if (container.device_secret !== secret) {
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
                is_online: true,
                last_seen: new Date()
            }
        });

        return {
            token,
            container_id: container.container_id
        };
    }

    async heartbeat(containerId) {
        const now = new Date();

        await prisma.containers.update({
            where: { container_id: containerId },
            data: { last_seen: now, is_online: true }
        });

        return { message: "Heartbeat received", server_time: now };
    }

    async getPendingCommands(containerId) {
        return prisma.device_commands.findMany({
            where: { container_id: containerId, status: "pending" },
            orderBy: { created_at: "asc" }
        });
    }

    async completeCommand(commandId) {
        await prisma.device_commands.update({
            where: { id: Number(commandId) },
            data: { status: "done", executed_at: new Date() }
        });

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
        const todayUTC = new Date(Date.UTC(
            now.getUTCFullYear(),
            now.getUTCMonth(),
            now.getUTCDate()
        ));
        const tomorrowUTC = new Date(todayUTC);
        tomorrowUTC.setUTCDate(tomorrowUTC.getUTCDate() + 1);

        const nextMed = await prisma.prescription_medications.findFirst({
            where: {
                prescriptions: { patient_id: container.patient_id },
                intake_status: null,
                compartment_medications: { some: {} },
                OR: [
                    { intake_date: { lt: todayUTC } },
                    { intake_date: { gte: todayUTC, lt: tomorrowUTC } }
                ]
            },
            include: { medications: true },
            orderBy: [{ intake_date: "asc" }, { intake_time: "asc" }]
        });

        if (!nextMed) return null;

        const compartmentMed = await prisma.compartment_medications.findFirst({
            where: { prescription_med_id: nextMed.prescription_med_id },
            include: { compartments: true }
        });

        if (!compartmentMed?.compartments) {
            throw new AppError(ERROR_CODES.NOT_FOUND, "Medication not loaded into container", 404);
        }

        return {
            prescription_med_id: nextMed.prescription_med_id,
            compartment_number: compartmentMed.compartments.compartment_number,
            intake_time: nextMed.intake_time,
            intake_date: nextMed.intake_date,
            medication_name: nextMed.medications?.name || "Unknown"
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
            data: { intake_status: true }
        });

        const compartmentMed = await prisma.compartment_medications.findFirst({
            where: { prescription_med_id: prescriptionMedId }
        });

        if (compartmentMed) {
            await prisma.compartment_medications.update({
                where: { compartment_med_id: compartmentMed.compartment_med_id },
                data: { open_time: now }
            });

            await prisma.compartments.update({
                where: { compartment_id: compartmentMed.compartment_id },
                data: { is_filled: false, last_filled_at: null }
            });

            await prisma.compartment_medications.delete({
                where: { compartment_med_id: compartmentMed.compartment_med_id }
            });
        }

        await this.logDeviceEvent(
            containerId,
            "info",
            "INTAKE_CONFIRMED",
            `Прийом підтверджено: prescription_med_id=${prescriptionMedId}`
        );

        return { message: "Intake confirmed", time: now };
    }

    async startFill(containerId) {
        const free = await this.getFreeCompartment(containerId);
        await this.createRotateCommand(containerId, free.compartment_number);
        return { compartment: free.compartment_number };
    }

    async getFreeCompartment(containerId) {
        const free = await prisma.compartments.findFirst({
            where: { container_id: containerId, is_filled: false },
            orderBy: { compartment_number: "asc" }
        });

        if (!free) {
            throw new AppError(ERROR_CODES.NOT_FOUND, "No free compartments", 404);
        }

        return free;
    }

    async createRotateCommand(containerId, compartmentNumber) {
        return prisma.device_commands.create({
            data: {
                container_id: containerId,
                command: "rotate_to",
                payload: { compartment: compartmentNumber }
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
            throw new AppError(ERROR_CODES.VALIDATION_ERROR, "Compartment already filled", 400);
        }

        const now = new Date();

        await prisma.compartment_medications.create({
            data: {
                compartment_id: compartment.compartment_id,
                prescription_med_id: prescriptionMedId,
                filled_by: userId,
                fill_time: now
            }
        });

        await prisma.compartments.update({
            where: { compartment_id: compartment.compartment_id },
            data: { is_filled: true, last_filled_at: now }
        });

        return { message: "Compartment filled" };
    }

    async getCompartments(containerId) {
        const compartments = await prisma.compartments.findMany({
            where: { container_id: containerId },
            orderBy: { compartment_number: "asc" },
            include: {
                compartment_medications: {
                    orderBy: { fill_time: "desc" },
                    take: 1,
                    include: {
                        prescription_medications: {
                            include: { medications: true }
                        }
                    }
                }
            }
        });

        return compartments.map(c => {
            const med = c.compartment_medications[0]?.prescription_medications;
            const medication_info = med?.medications;

            return {
                compartment_id: c.compartment_id,
                compartment_number: c.compartment_number,
                is_filled: c.is_filled,
                last_filled_at: c.last_filled_at,
                medication: medication_info
                    ? {
                        name: medication_info.name,
                        dosage: medication_info.dosage,
                        intake_time: med.intake_time
                            ? new Date(med.intake_time).toISOString().substring(11, 16)
                            : null,
                        intake_date: med.intake_date
                            ? new Date(med.intake_date).toISOString().substring(0, 10)
                            : null,
                    }
                    : null
            };
        });
    }

    async rotateToCompartment(containerId, compartmentNumber) {
        const compartment = await prisma.compartments.findFirst({
            where: { container_id: containerId, compartment_number: compartmentNumber }
        });

        if (!compartment) {
            throw new AppError(ERROR_CODES.NOT_FOUND, "Compartment not found", 404);
        }

        await this.createRotateCommand(containerId, compartmentNumber);

        await prisma.device_commands.create({
            data: {
                container_id: containerId,
                command: "open_lid",
                payload: {}
            }
        });

        return { message: "Rotate command sent", compartment_number: compartmentNumber };
    }

    async clearCompartment(containerId, compartmentId, compartmentNumber) {
        const latest = await prisma.compartment_medications.findFirst({
            where: { compartment_id: compartmentId },
            orderBy: { fill_time: "desc" }
        });

        if (!latest) {
            throw new AppError(ERROR_CODES.NOT_FOUND, "Compartment already empty", 400);
        }

        await prisma.compartment_medications.delete({
            where: { compartment_med_id: latest.compartment_med_id }
        });

        await prisma.compartments.update({
            where: { compartment_id: compartmentId },
            data: { is_filled: false, last_filled_at: null }
        });

        return { message: "Compartment cleared" };
    }

    async updateRfidStatus(containerId, authenticated) {
        await prisma.containers.update({
            where: { container_id: containerId },
            data: { rfid_authenticated: authenticated }
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
            where: { container_id: containerId },
            select: { rfid_authenticated: true }
        });

        return { rfid_authenticated: container?.rfid_authenticated ?? false };
    }

    async resetRfid(containerId) {
        await prisma.containers.update({
            where: { container_id: containerId },
            data: { rfid_authenticated: false }
        });

        await this.finishFillSession(containerId);

        await this.logDeviceEvent(
            containerId,
            "info",
            "FILL_SESSION_FINISHED",
            "Сесія заповнення завершена медсестрою"
        );

        await prisma.device_commands.create({
            data: {
                container_id: containerId,
                command: "close_lid",
                payload: {}
            }
        });

        return { message: "RFID reset" };
    }

    async startFillSession(containerId, userId) {
        await prisma.fill_sessions.updateMany({
            where: { container_id: containerId, status: "active" },
            data: { status: "finished", finished_at: new Date() }
        });

        return prisma.fill_sessions.create({
            data: {
                container_id: containerId,
                started_by: userId,
                status: "active"
            }
        });
    }

    async finishFillSession(containerId) {
        return prisma.fill_sessions.updateMany({
            where: { container_id: containerId, status: "active" },
            data: { status: "finished", finished_at: new Date() }
        });
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
                code: code || null,
                message: message || null
            }
        });
    }
}