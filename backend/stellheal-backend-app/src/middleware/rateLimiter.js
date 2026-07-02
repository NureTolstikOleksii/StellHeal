import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { ERROR_CODES } from '../shared/constants/errorCodes.js';

const keyGenerator = (req) => {
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
        || req.ip
        || req.connection.remoteAddress
        || 'unknown';
    return ipKeyGenerator(ip);
};

const createLimiter = (max, message) =>
    rateLimit({
        windowMs: 60 * 1000,
        max,
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator,
        handler: (req, res) => {
            res.status(429).json({
                code: ERROR_CODES.TOO_MANY_REQUESTS,
                message
            });
        }
    });

export const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10000000,
    keyGenerator,
    handler: (req, res) => {
        res.status(429).json({
            code: ERROR_CODES.TOO_MANY_REQUESTS,
            message: 'Too many requests. Try again later.'
        });
    }
});

export const loginLimiter = createLimiter(
    5,
    'Too many login attempts. Try again later.'
);

export const registerLimiter = createLimiter(
    3,
    'Too many registrations. Try again later.'
);