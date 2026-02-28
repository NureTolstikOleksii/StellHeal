import { Router } from 'express';
import { LoginService } from './login.service.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { sendResetPasswordEmail} from '../utils/emailService.js';
import {validatePasswordStrength} from "../middleware/validatePasswordStrength.js";

export const loginRouter = Router();
const loginService = new LoginService();
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';

async function handleLogin(req, res, allowedRoles) {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({
            status: 'error',
            code: 400,
            message: 'Email and password are required'
        });
    }

    try {
        const user = await loginService.findUserByLogin(req.db, email);

        if (!user) {
            return res.status(401).json({
                status: 'error',
                code: 401,
                message: 'No such user found'
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({
                status: 'error',
                code: 401,
                message: 'Invalid password'
            });
        }

        // Перевірка ролі користувача
        if (!allowedRoles.includes(user.role_id)) {
            return res.status(403).json({
                status: 'error',
                code: 403,
                message: 'Access denied: insufficient rights'
            });
        }

        const token = jwt.sign(
            {
                userId: user.user_id,
                roleId: user.role_id
            },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        return res.status(200).json({
            status: 'success',
            message: 'Login successful',
            token,
            user: {
                id: user.user_id,
                firstName: user.first_name,
                lastName: user.last_name,
                avatar: user.avatar,
                role: user.roles?.role_name || "unknown"
            }
        });

    } catch (err) {
        return res.status(500).json({
            status: 'error',
            code: 500,
            message: 'Internal server error',
            details: err.message
        });
    }
}

loginRouter.post('/web', async (req, res) => {
    await handleLogin(req, res, [1, 4]);
});

loginRouter.post('/mobile', async (req, res) => {
    await handleLogin(req, res, [2, 3]);
});

loginRouter.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ type: 'error', message: 'Email is required' });
    }

    try {
        const user = await loginService.findUserByLogin(req.db, email);
        if (!user) {
            return res.status(404).json({ type: 'error', message: 'Such user doesn\'t exist' });
        }

        const token = await loginService.createResetToken(req.db, user.user_id);
        await sendResetPasswordEmail(email, token);

        return res.json({ type: 'success', message: 'Reset instructions sent to email' });
    } catch (err) {
        console.error('Forgot password error:', err);
        return res.status(500).json({ type: 'error', message: 'Server error' });
    }
});

loginRouter.post('/reset-password', validatePasswordStrength, async (req, res) => {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
        return res.status(400).json({ message: 'Session timed out' });
    }

    try {
        const user = await loginService.findUserByResetToken(req.db, token);
        if (!user) return res.status(400).json({ message: 'Session timed out' });

        const hashed = await bcrypt.hash(newPassword, 10);
        await loginService.updatePassword(req.db, user.user_id, hashed);
        await loginService.deleteResetToken(req.db, token);

        res.json({ message: 'Password updated successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});
