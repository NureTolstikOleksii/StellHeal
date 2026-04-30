import prisma from '../../config/prisma.js';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';

import { sendStaffCredentialsEmail } from '../../integrations/resend/emailService.js';

import { AppError } from '../../shared/errors/AppError.js';
import { ERROR_CODES } from '../../shared/constants/errorCodes.js';
import { logAction } from '../../shared/logger/auditLogger.js';
import { ACTIONS } from '../../shared/constants/actions.js';
import {generateStaffExcel} from "../../integrations/reports/staffExcel.service.js";

export class StaffService {

    // get list of medical workers ok
    async getAllMedicalStaff() {
        return await prisma.users.findMany({
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

    // number of employees ok
    async getStaffCount() {
        return await prisma.users.count({
            where: {
                role_id: {
                    in: [1, 2]
                }
            }
        });
    }

    // add employee ok
    async addStaff(data, req) {

        const existingUser = await prisma.users.findUnique({
            where: { login: data.login }
        });

        if (existingUser) {
            throw new AppError(
                ERROR_CODES.USER_EXISTS,
                'Користувач з такою поштою вже існує',
                400
            );
        }

        const plainPassword = nanoid(10);
        const hashedPassword = await bcrypt.hash(plainPassword, 10);

        const createdUser = await prisma.users.create({
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
        });

        // medical staff
        if (data.specialization) {
            await prisma.medical_staff.create({
                data: {
                    staff_id: createdUser.user_id,
                    specialization: data.specialization,
                    shift: data.shift || null,
                    admission_date: new Date()
                }
            });
        }

        // email
        await sendStaffCredentialsEmail(data.login, plainPassword);

        // notification
        const now = new Date();

        const notification = await prisma.notifications.create({
            data: {
                notification_type: 'success',
                message: `Вітаємо вас у системі, ${createdUser.last_name} ${createdUser.first_name}!`,
                sent_date: now,
                sent_time: new Date(now.getTime() + (3 * 60 * 60 * 1000)),
            }
        });

        await prisma.notification_recipients.create({
            data: {
                notification_id: notification.notification_id,
                user_id: createdUser.user_id,
                is_read: false
            }
        });

        // audit log
        await logAction({
            userId: req.user.userId,
            action: ACTIONS.CREATE_STAFF,
            entity: 'STAFF',
            entityId: createdUser.user_id,
            description: 'Staff created with credentials and notification',
            req
        });

        return createdUser;
    }

    // update employee ok
    async updateStaff(id, data, req) {

        const {
            role_id,
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

        // existence check
        const existing = await prisma.users.findUnique({
            where: { user_id: id }
        });

        if (!existing) {
            throw new AppError(
                ERROR_CODES.USER_NOT_FOUND,
                'Працівника не знайдено',
                404
            );
        }

        const [updatedUser] = await prisma.$transaction([

            prisma.users.update({
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

            prisma.medical_staff.upsert({
                where: { staff_id: id },
                update: {
                    specialization,
                    shift
                },
                create: {
                    staff_id: id,
                    specialization,
                    shift,
                    admission_date: new Date()
                }
            })

        ]);

        // audit log
        await logAction({
            userId: req.user.userId,
            action: ACTIONS.UPDATE_STAFF,
            entity: 'STAFF',
            entityId: id,
            description: 'Staff updated',
            req
        });

        return updatedUser;
    }

    // delete employee ok
    async deleteStaff(userId, req) {

        const existing = await prisma.users.findUnique({
            where: { user_id: userId }
        });

        if (!existing) {
            throw new AppError(
                ERROR_CODES.USER_NOT_FOUND,
                'Працівника не знайдено',
                404
            );
        }

        await prisma.users.delete({
            where: { user_id: userId }
        });

        // audit log
        await logAction({
            userId: req.user.userId,
            action: ACTIONS.DELETE_STAFF,
            entity: 'STAFF',
            entityId: userId,
            description: 'Staff deleted',
            req
        });
    }

    // get user roles ok
    async getRoles() {
        return await prisma.roles.findMany({
            orderBy: { role_id: 'asc' }
        });
    }

    // create role ok
    async createRole(role_name, req) {
        const name = role_name.trim();

        const existing = await prisma.roles.findFirst({
            where: {
                role_name: {
                    equals: name,
                    mode: 'insensitive'
                }
            }
        });

        if (existing) {
            throw new AppError(
                ERROR_CODES.CONFLICT,
                'Role already exists',
                409
            );
        }

        const newRole = await prisma.roles.create({
            data: { role_name: name }
        });

        await logAction({
            userId: req.user.userId,
            action: ACTIONS.CREATE_ROLE,
            entity: 'ROLE',
            entityId: newRole.role_id,
            description: `Role created: ${name}`,
            req
        });

        return newRole;
    }

    // delete role ok
    async deleteRole(roleId, req) {
        const role = await prisma.roles.findUnique({
            where: { role_id: roleId }
        });

        if (!role) {
            throw new AppError(
                ERROR_CODES.NOT_FOUND,
                'Role not found',
                404
            );
        }

        const SYSTEM_ROLES = ['admin', 'doctor', 'nurse', 'patient'];

        if (SYSTEM_ROLES.includes(role.role_name.toLowerCase())) {
            throw new AppError(
                ERROR_CODES.FORBIDDEN,
                'Cannot delete system role',
                403
            );
        }

        const usersWithRole = await prisma.users.count({
            where: { role_id: roleId }
        });

        if (usersWithRole > 0) {
            throw new AppError(
                ERROR_CODES.CONFLICT,
                'Role is assigned to users',
                409
            );
        }

        await prisma.roles.delete({
            where: { role_id: roleId }
        });

        await logAction({
            userId: req.user.userId,
            action: ACTIONS.DELETE_ROLE,
            entity: 'ROLE',
            entityId: roleId,
            description: `Role deleted: ${role.role_name}`,
            req
        });
    }

    // update role ok
    async updateRole(roleId, role_name, req) {

        const role = await prisma.roles.findUnique({
            where: { role_id: roleId }
        });

        if (!role) {
            throw new AppError(
                ERROR_CODES.NOT_FOUND,
                'Role not found',
                404
            );
        }

        const name = role_name.trim();
        const existing = await prisma.roles.findFirst({
            where: {
                role_name: {
                    equals: name,
                    mode: 'insensitive'
                },
                NOT: { role_id: roleId }
            }
        });

        if (existing) {
            throw new AppError(
                ERROR_CODES.CONFLICT,
                'Role already exists',
                409
            );
        }

        const updated = await prisma.roles.update({
            where: { role_id: roleId },
            data: { role_name: name }
        });

        await logAction({
            userId: req.user.userId,
            action: ACTIONS.UPDATE_ROLE,
            entity: 'ROLE',
            entityId: roleId,
            description: `Role updated to: ${name}`,
            req
        });

        return updated;
    }

    // get report ok
    async exportStaffToExcel(req) {
        const doctors = await prisma.users.findMany({
            where: { role_id: 1 },
            include: { medical_staff: true }
        });

        const nurses = await prisma.users.findMany({
            where: { role_id: 2 },
            include: { medical_staff: true }
        });

        const buffer = await generateStaffExcel(doctors, nurses);

        // audit log
        await logAction({
            userId: req.user.userId,
            action: ACTIONS.EXPORT_STAFF,
            entity: 'STAFF',
            description: 'Staff Excel exported',
            req
        });

        return buffer;
    }
}
