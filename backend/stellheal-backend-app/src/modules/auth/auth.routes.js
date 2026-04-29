import { Router } from 'express';
import {login, logout, logoutAll, refresh, register} from './auth.controller.js';
import { validateEmail } from '../../middleware/validation/validateEmail.js';
import { loginLimiter, registerLimiter } from '../../middleware/rateLimiter.js';
import {authenticateToken} from "../../middleware/auth.middleware.js";
import { forgotPassword, resetPassword } from './auth.controller.js';
import { authorizeRoles } from "../../middleware/role.middleware.js";

// приклад ролей
const ADMIN = 3;
const DOCTOR = 2;

const router = Router();

router.post(
    '/register',
    authenticateToken,
    authorizeRoles(ADMIN, DOCTOR),
    registerLimiter,
    validateEmail,
    register
);
router.post('/login', loginLimiter, validateEmail, login);
router.post('/refresh', refresh);
router.post('/logout', authenticateToken, logout);
router.post('/logout-all', authenticateToken, logoutAll);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

export default router;