import prisma from '../../config/prisma.js';
import bcrypt from 'bcryptjs';
import { AppError } from '../../shared/errors/AppError.js';
import { ERROR_CODES } from '../../shared/constants/errorCodes.js';
import { logAction } from '../../shared/logger/auditLogger.js';
import { ACTIONS } from '../../shared/constants/actions.js';

export class ProfileService {

    async getProfile(userId, req) {
        const user = await prisma.users.findUnique({
            where: { user_id: userId },
            include: {
                roles: true,
                medical_staff: true
            }
        });

        if (!user) {
            throw new AppError(ERROR_CODES.USER_NOT_FOUND, 'User not found', 404);
        }

        return user;
    }

    async updateAvatar(userId, avatarUrl, req) {
        const user = await prisma.users.update({
            where: { user_id: userId },
            data: { avatar: avatarUrl }
        });

        await logAction({
            userId,
            action: ACTIONS.UPLOAD_AVATAR,
            entity: 'USER',
            entityId: userId,
            description: 'Avatar updated',
            req
        });

        return user;
    }

    async changePassword(userId, currentPassword, newPassword, req) {
        const user = await prisma.users.findUnique({
            where: { user_id: userId }
        });

        if (!user) {
            throw new AppError(ERROR_CODES.USER_NOT_FOUND, 'User not found', 404);
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password);

        if (!isMatch) {
            throw new AppError(ERROR_CODES.INVALID_PASSWORD, 'Invalid current password', 400);
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await prisma.users.update({
            where: { user_id: userId },
            data: { password: hashedPassword }
        });

        await logAction({
            userId,
            action: ACTIONS.CHANGE_PASSWORD,
            entity: 'USER',
            entityId: userId,
            description: 'Password changed',
            req
        });
    }

    // ok
    async updateProfile(userId, data, req) {
        const updatedUser = await prisma.users.update({
            where: { user_id: userId },
            data
        });

        await logAction({
            userId,
            action: ACTIONS.UPDATE_PROFILE,
            entity: 'USER',
            entityId: userId,
            description: 'Profile updated',
            req
        });

        return updatedUser;
    }
}