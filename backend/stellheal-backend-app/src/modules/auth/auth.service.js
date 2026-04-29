import prisma from '../../config/prisma.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { logAction } from '../../shared/logger/auditLogger.js';
import { ACTIONS } from '../../shared/constants/actions.js';
import { AppError } from '../../shared/errors/AppError.js';
import { ERROR_CODES } from '../../shared/constants/errorCodes.js';

if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not defined');
}

const JWT_SECRET = process.env.JWT_SECRET;

const MAX_ATTEMPTS = 5;
const LOCK_TIME = 5 * 60 * 1000;

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;

// 🔥 ДОЗВОЛЕНІ РОЛІ (під себе налаштуй)
const ALLOWED_ROLES = [1, 2, 3]; // наприклад: Patient, Doctor, Nurse

export class AuthService {

    async createRefreshToken(userId, req) {
        const token = crypto.randomBytes(40).toString('hex');

        await prisma.refresh_tokens.create({
            data: {
                user_id: userId,
                token,
                device: req.headers['user-agent'],
                ip_address: req.ip,
                expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                is_revoked: false
            }
        });

        return token;
    }

    async revokeAllUserTokens(userId, req) {
        await prisma.refresh_tokens.updateMany({
            where: { user_id: userId },
            data: { is_revoked: true }
        });

        await logAction({
            userId,
            action: ACTIONS.SECURITY_EVENT,
            entity: 'AUTH',
            entityId: userId,
            description: 'All sessions revoked',
            req
        });
    }

    async logoutByToken(refreshToken, req) {
        const result = await prisma.refresh_tokens.updateMany({
            where: { token: refreshToken },
            data: { is_revoked: true }
        });

        if (result.count === 0) {
            throw new AppError(ERROR_CODES.INVALID_TOKEN, 'Token not found', 400);
        }
    }

    async registerUser(data, req) {

        const { role_id } = data;

        if (!role_id) {
            throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Role is required', 400);
        }

        if (!ALLOWED_ROLES.includes(role_id)) {
            throw new AppError(ERROR_CODES.FORBIDDEN, 'Invalid role', 403);
        }

        const existingUser = await prisma.users.findUnique({
            where: { login: data.email }
        });

        if (existingUser) {
            throw new AppError(ERROR_CODES.USER_EXISTS, 'User already exists', 400);
        }

        if (!PASSWORD_REGEX.test(data.password)) {
            throw new AppError(ERROR_CODES.WEAK_PASSWORD, 'Weak password', 400);
        }

        const hashedPassword = await bcrypt.hash(data.password, 10);

        const newUser = await prisma.users.create({
            data: {
                login: data.email,
                password: hashedPassword,
                first_name: data.first_name,
                last_name: data.last_name,
                patronymic: data.patronymic,
                date_of_birth: data.birth_date ? new Date(data.birth_date) : null,
                contact_info: data.address,
                phone: data.phone,
                role_id: role_id
            }
        });

        await logAction({
            userId: newUser.user_id,
            action: ACTIONS.REGISTER,
            entity: 'USER',
            entityId: newUser.user_id,
            description: `User registered with role ${role_id}`,
            req
        });

        return newUser;
    }

    async loginUser(email, password, req) {

        const user = await prisma.users.findUnique({
            where: { login: email },
            include: { roles: true }
        });

        if (!user) {
            await logAction({
                action: ACTIONS.LOGIN_FAILED,
                entity: 'USER',
                description: 'User not found',
                req
            });

            throw new AppError(ERROR_CODES.USER_NOT_FOUND, 'User not found', 401);
        }

        if (user.lock_until && new Date(user.lock_until) > new Date()) {
            throw new AppError(ERROR_CODES.ACCOUNT_LOCKED, 'Too many attempts', 403);
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            const attempts = user.failed_login_attempts + 1;

            await prisma.users.update({
                where: { user_id: user.user_id },
                data: {
                    failed_login_attempts: attempts,
                    lock_until: attempts >= MAX_ATTEMPTS
                        ? new Date(Date.now() + LOCK_TIME)
                        : null
                }
            });

            await logAction({
                userId: user.user_id,
                action: ACTIONS.LOGIN_FAILED,
                entity: 'USER',
                entityId: user.user_id,
                description: `Invalid password (${attempts})`,
                req
            });

            throw new AppError(ERROR_CODES.INVALID_PASSWORD, 'Invalid password', 401);
        }

        await prisma.users.update({
            where: { user_id: user.user_id },
            data: {
                failed_login_attempts: 0,
                lock_until: null
            }
        });

        await logAction({
            userId: user.user_id,
            action: ACTIONS.LOGIN,
            entity: 'USER',
            entityId: user.user_id,
            description: 'User logged in',
            req
        });

        return user;
    }

    async createPasswordResetToken(email, req) {
        const user = await prisma.users.findUnique({
            where: { login: email }
        });

        if (!user) {
            await logAction({
                action: ACTIONS.SECURITY_EVENT,
                entity: 'USER',
                description: 'Reset requested for non-existing email',
                req
            });

            return null;
        }

        const token = crypto.randomBytes(32).toString('hex');

        await prisma.password_reset_tokens.create({
            data: {
                user_id: user.user_id,
                token,
                expires_at: new Date(Date.now() + 60 * 60 * 1000)
            }
        });

        return token;
    }

    async resetPassword(token, newPassword, req) {

        const record = await prisma.password_reset_tokens.findUnique({
            where: { token }
        });

        if (!record || new Date(record.expires_at) < new Date()) {
            throw new AppError(ERROR_CODES.INVALID_TOKEN, 'Invalid token', 400);
        }

        if (!PASSWORD_REGEX.test(newPassword)) {
            throw new AppError(ERROR_CODES.WEAK_PASSWORD, 'Weak password', 400);
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await prisma.users.update({
            where: { user_id: record.user_id },
            data: { password: hashedPassword }
        });

        await prisma.password_reset_tokens.delete({
            where: { token }
        });

        await logAction({
            userId: record.user_id,
            action: ACTIONS.SECURITY_EVENT,
            entity: 'USER',
            entityId: record.user_id,
            description: 'Password reset successful',
            req
        });
    }

    async refreshSession(refreshToken, req) {

        const record = await prisma.refresh_tokens.findUnique({
            where: { token: refreshToken }
        });

        if (!record) {
            throw new AppError(ERROR_CODES.INVALID_TOKEN, 'Invalid token', 403);
        }

        if (record.is_revoked) {
            await this.revokeAllUserTokens(record.user_id, req);
            throw new AppError(ERROR_CODES.SESSION_COMPROMISED, 'Session compromised', 403);
        }

        if (new Date(record.expires_at) < new Date()) {
            throw new AppError(ERROR_CODES.TOKEN_EXPIRED, 'Token expired', 403);
        }

        await prisma.refresh_tokens.update({
            where: { token: refreshToken },
            data: { is_revoked: true }
        });

        const newRefreshToken = await this.createRefreshToken(record.user_id, req);

        const user = await prisma.users.findUnique({
            where: { user_id: record.user_id }
        });

        const accessToken = jwt.sign(
            { userId: user.user_id, roleId: user.role_id },
            JWT_SECRET,
            { expiresIn: '15m' }
        );

        return {
            accessToken,
            refreshToken: newRefreshToken
        };
    }
}