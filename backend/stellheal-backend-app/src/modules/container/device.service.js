import prisma from "../../config/prisma.js";
import jwt from "jsonwebtoken";
import { AppError } from "../../shared/errors/AppError.js";
import { ERROR_CODES } from "../../shared/constants/errorCodes.js";

export class DeviceService {

    /**
     * Авторизація пристрою
     */
    async authenticate(device_uid, secret) {
        const container = await prisma.containers.findFirst({
            where: { device_uid }
        });

        if (!container) {
            console.log("Device not found")
            throw new AppError(
                ERROR_CODES.NOT_FOUND,
                "Device not found",
                404
            );
        }

        if (container.device_secret !== secret) {
            throw new AppError(
                ERROR_CODES.UNAUTHORIZED,
                "Invalid device credentials",
                401
            );
        }

        const token = jwt.sign(
            {
                containerId: container.container_id,
                type: "device"
            },
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

    /**
     * Heartbeat
     */
    async heartbeat(containerId) {
        const now = new Date();

        await prisma.containers.update({
            where: { container_id: containerId },
            data: {
                last_seen: now,
                is_online: true
            }
        });

        return {
            message: "Heartbeat received",
            server_time: now
        };
    }

    /**
     * Отримати команди
     */
    async getPendingCommands(containerId) {
        return prisma.device_commands.findMany({
            where: {
                container_id: containerId,
                status: "pending"
            },
            orderBy: {
                created_at: "asc"
            }
        });
    }

    /**
     * авершити команду
     */
    async completeCommand(commandId) {
        await prisma.device_commands.update({
            where: { id: Number(commandId) },
            data: {
                status: "done",
                executed_at: new Date()
            }
        });

        return {
            message: "Command completed"
        };
    }

    async getNextIntake(containerId) {
        const container = await prisma.containers.findUnique({
            where: { container_id: containerId }
        });

        if (!container || !container.patient_id) {
            throw new AppError(ERROR_CODES.NOT_FOUND, "Container not assigned to patient", 404);
        }

        const now = new Date();

        // ← Використовуємо UTC дату
        const todayUTC = new Date(Date.UTC(
            now.getUTCFullYear(),
            now.getUTCMonth(),
            now.getUTCDate()
        ));

        const tomorrowUTC = new Date(todayUTC);
        tomorrowUTC.setUTCDate(tomorrowUTC.getUTCDate() + 1);

        const nextMed = await prisma.prescription_medications.findFirst({
            where: {
                prescriptions: {
                    patient_id: container.patient_id
                },
                intake_status: null,
                compartment_medications: { some: {} },
                OR: [
                    { intake_date: { lt: todayUTC } }, // прострочені
                    {
                        intake_date: {
                            gte: todayUTC,
                            lt: tomorrowUTC
                        }
                        // intake_time не перевіряємо — ESP32 сам порівнює час
                    }
                ]
            },
            include: {
                medications: true
            },
            orderBy: [
                { intake_date: "asc" },
                { intake_time: "asc" }
            ]
        });

        if (!nextMed) {
            return null;
        }

        const compartmentMed = await prisma.compartment_medications.findFirst({
            where: { prescription_med_id: nextMed.prescription_med_id },
            include: { compartments: true }
        });

        if (!compartmentMed || !compartmentMed.compartments) {
            throw new AppError(ERROR_CODES.NOT_FOUND, "Medication not loaded into container", 404);
        }

        return {
            prescription_med_id: nextMed.prescription_med_id,
            compartment_number: compartmentMed.compartments.compartment_number,
            intake_time: nextMed.intake_time,
            intake_date: nextMed.intake_date,
            medication_name: nextMed.medications?.name || "" // ← додайте
        };
    }

    async confirmIntake(containerId, prescriptionMedId) {

        // 🔍 перевірка існування
        const med = await prisma.prescription_medications.findUnique({
            where: { prescription_med_id: prescriptionMedId }
        });

        if (!med) {
            throw new AppError(
                ERROR_CODES.NOT_FOUND,
                "Prescription medication not found",
                404
            );
        }

        // ❗ якщо вже прийнято
        if (med.intake_status === true) {
            return {
                message: "Already taken"
            };
        }

        const now = new Date();

        // ✅ оновлюємо статус прийому
        await prisma.prescription_medications.update({
            where: { prescription_med_id: prescriptionMedId },
            data: {
                intake_status: true
            }
        });

        // 🔍 знайти відсік
        const compartmentMed = await prisma.compartment_medications.findFirst({
            where: {
                prescription_med_id: prescriptionMedId
            }
        });

        if (compartmentMed) {
            await prisma.compartment_medications.update({
                where: { compartment_med_id: compartmentMed.compartment_med_id },
                data: { open_time: now }
            });

            // ← Додайте це
            await prisma.compartments.update({
                where: { compartment_id: compartmentMed.compartment_id },
                data: {
                    is_filled: false,
                    last_filled_at: null
                }
            });

            await prisma.compartment_medications.delete({
                where: { compartment_med_id: compartmentMed.compartment_med_id }
            });
        }

        return {
            message: "Intake confirmed",
            time: now
        };
    }

    async getFreeCompartment(containerId) {
        const free = await prisma.compartments.findFirst({
            where: {
                container_id: containerId,
                is_filled: false
            },
            orderBy: {
                compartment_number: "asc"
            }
        });

        if (!free) {
            throw new AppError(
                ERROR_CODES.NOT_FOUND,
                "No free compartments",
                404
            );
        }

        return free;
    }

    async createRotateCommand(containerId, compartmentNumber) {
        return prisma.device_commands.create({
            data: {
                container_id: containerId,
                command: "rotate_to",
                payload: {
                    compartment: compartmentNumber
                }
            }
        });
    }

    async fillCompartment(containerId, compartmentNumber, prescriptionMedId, userId) {

        const compartment = await prisma.compartments.findFirst({
            where: {
                container_id: containerId,
                compartment_number: compartmentNumber
            }
        });

        if (!compartment) {
            throw new AppError(
                ERROR_CODES.NOT_FOUND,
                "Compartment not found",
                404
            );
        }

        if (compartment.is_filled) {
            throw new AppError(
                ERROR_CODES.VALIDATION_ERROR,
                "Compartment already filled",
                400
            );
        }

        const now = new Date();

        // створюємо запис
        await prisma.compartment_medications.create({
            data: {
                compartment_id: compartment.compartment_id,
                prescription_med_id: prescriptionMedId,
                filled_by: userId,
                fill_time: now
            }
        });

        // оновлюємо відсік
        await prisma.compartments.update({
            where: { compartment_id: compartment.compartment_id },
            data: {
                is_filled: true,
                last_filled_at: now
            }
        });

        // await prisma.device_commands.create({
        //     data: {
        //         container_id: containerId,
        //         command: "close_lid",
        //         payload: {}
        //     }
        // });

        return { message: "Compartment filled" };
    }


    async getCompartments(containerId) {
        const compartments = await prisma.compartments.findMany({
            where: { container_id: containerId },
            orderBy: { compartment_number: 'asc' },
            include: {
                compartment_medications: {
                    orderBy: { fill_time: 'desc' },
                    take: 1,
                    include: {
                        prescription_medications: true  // medications більше не потрібен
                    }
                }
            }
        });

        return compartments.map(c => {
            const med = c.compartment_medications[0]?.prescription_medications;

            return {
                compartment_id: c.compartment_id,
                compartment_number: c.compartment_number,
                is_filled: c.is_filled,
                last_filled_at: c.last_filled_at,
                medication: med
                    ? {
                        name: med.medication_name || 'Unknown', // ← тепер з текстового поля
                        dosage: `${med.quantity} од.`,
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
            where: {
                container_id: containerId,
                compartment_number: compartmentNumber
            }
        });

        if (!compartment) {
            throw new AppError(ERROR_CODES.NOT_FOUND, "Compartment not found", 404);
        }

        // 1. Команда прокрутки
        await this.createRotateCommand(containerId, compartmentNumber);

        // 2. Команда відкриття люку
        await this.createOpenLidCommand(containerId);

        return { message: "Rotate command sent", compartment_number: compartmentNumber };
    }


    async clearCompartment(containerId, compartmentId, compartmentNumber) {
        // 1. Крутимо барабан
        //await this.createRotateCommand(containerId, compartmentNumber);
        await this.createOpenLidCommand(containerId);

        // 2. Видаляємо останній запис compartment_medications
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

        // 3. Оновлюємо статус відсіку
        await prisma.compartments.update({
            where: { compartment_id: compartmentId },
            data: {
                is_filled: false,
                last_filled_at: null
            }
        });

        // await prisma.device_commands.create({
        //     data: {
        //         container_id: containerId,
        //         command: "close_lid",
        //         payload: {}
        //     }
        // });

        return { message: "Compartment cleared" };
    }



    // device.service.js — новий метод
    async createOpenLidCommand(containerId) {
        return prisma.device_commands.create({
            data: {
                container_id: containerId,
                command: "open_lid",
                payload: {}
            }
        });
    }


    async getRfidStatus(containerId) {
        // Перевіряємо чи є незавершені open_lid команди
        // Якщо є pending rotate_to але немає done open_lid — картка не прикладена
        const pendingCommands = await prisma.device_commands.findMany({
            where: {
                container_id: containerId,
                status: "pending"
            }
        });

        // Простіший підхід — зберігаємо rfid статус в containers
        const container = await prisma.containers.findUnique({
            where: { container_id: containerId }
        });

        return { rfid_authenticated: container.rfid_authenticated ?? false };
    }


    async sendWeightAlert(containerId, prescriptionMedId) {
        const now = new Date();

        // Знаходимо пацієнта через контейнер
        const container = await prisma.containers.findUnique({
            where: { container_id: containerId },
            select: { patient_id: true }
        });

        if (!container?.patient_id) {
            throw new AppError(ERROR_CODES.NOT_FOUND, "Patient not found", 404);
        }

        // Знаходимо медсестер (role_id = 2)
        const nurses = await prisma.users.findMany({
            where: { role_id: 2 },
            select: { user_id: true, firebase_token: true }
        });

        // Пацієнт
        const patient = await prisma.users.findUnique({
            where: { user_id: container.patient_id },
            select: { user_id: true, firebase_token: true }
        });

        const recipients = [
            ...(patient ? [patient] : []),
            ...nurses
        ];

        // Записуємо сповіщення в БД
        const notification = await prisma.notifications.create({
            data: {
                notification_type: "PILL_NOT_TAKEN",
                message: "Пацієнт не забрав таблетки протягом 5 хвилин",
                sent_date: now,
                sent_time: now,
                container_id: containerId,
                notification_recipients: {
                    create: recipients.map(r => ({
                        user_id: r.user_id,
                        is_read: false
                    }))
                }
            }
        });

        // Відправляємо push кожному хто має FCM токен
        const pushPromises = recipients
            .filter(r => r.firebase_token)
            .map(r => {
                console.log(`Sending push to user ${r.user_id}, token: ${r.firebase_token?.substring(0, 20)}...`);
                return this.sendNotification(
                    r.firebase_token,
                    "⚠️ Таблетки не прийняті",
                    "Пацієнт не забрав таблетки протягом 5 хвилин"
                ).catch(err => {
                    console.error(`Failed to send push to user ${r.user_id}:`, err.message);
                });
            });

        await Promise.all(pushPromises);

        return { message: "Alert sent", notification_id: notification.notification_id };
    }
}