import jwt from 'jsonwebtoken';
import { AuthService } from './auth.service.js';
import { sendResetPasswordEmail } from '../../integrations/resend/emailService.js';

if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not defined');
}

const JWT_SECRET = process.env.JWT_SECRET;
const authService = new AuthService();

export const register = async (req, res, next) => {
    try {
        const user = await authService.registerUser(req.body, req);

        res.status(201).json({
            message: 'Registered successfully',
            user: {
                id: user.user_id,
                email: user.login
            }
        });

    } catch (err) {
        next(err);
    }
};

export const login = async (req, res, next) => {
    try {
        const { email, password, platform } = req.body;

        const user = await authService.loginUser(email, password, platform, req);

        const accessToken = jwt.sign(
            { userId: user.user_id, roleId: user.role_id, platform },
            JWT_SECRET,
            { expiresIn: '15m' }
        );

        const refreshToken = await authService.createRefreshToken(user.user_id, req);

        res.json({
            accessToken,
            refreshToken,
            user: {
                id: user.user_id,
                first_name: user.first_name,
                last_name: user.last_name,
                role: user.roles?.role_name,
                avatar: user.avatar
            }
        });

    } catch (err) {
        next(err);
    }
};

export const refresh = async (req, res, next) => {
    try {
        const result = await authService.refreshSession(req.body.refreshToken, req);
        res.json(result);
    } catch (err) {
        next(err);
    }
};

export const logout = async (req, res, next) => {
    try {
        await authService.logoutByToken(req.body.refreshToken, req);
        res.json({ message: 'Logged out' });
    } catch (err) {
        next(err);
    }
};

export const logoutAll = async (req, res, next) => {
    try {
        await authService.revokeAllUserTokens(req.user.userId, req);
        res.json({ message: 'Logged out from all devices' });
    } catch (err) {
        next(err);
    }
};

export const forgotPassword = async (req, res, next) => {
    try {
        const token = await authService.createPasswordResetToken(req.body.email, req);

        if (token) {
            await sendResetPasswordEmail(req.body.email, token);
        }

        res.json({ message: 'If email exists, reset instructions sent' });

    } catch (err) {
        next(err);
    }
};

export const resetPassword = async (req, res, next) => {
    try {
        await authService.resetPassword(req.body.token, req.body.newPassword, req);
        res.json({ message: 'Password updated successfully' });

    } catch (err) {
        next(err);
    }
};