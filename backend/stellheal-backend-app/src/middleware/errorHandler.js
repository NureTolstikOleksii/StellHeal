import { ERROR_CODES } from "../shared/constants/errorCodes.js";
import { AppError } from "../shared/errors/AppError.js";

export const errorHandler = (err, req, res, next) => {
    // ← логуємо тільки серверні помилки (5xx), 4xx — очікувані клієнтські
    if (!err.status || err.status >= 500) {
        console.error(err);
    }

    // Prisma errors
    if (err.code && err.code.startsWith('P') && err.meta) {
        return res.status(400).json({
            code: ERROR_CODES.VALIDATION_ERROR,
            message: 'Database error'
        });
    }

    if (err instanceof AppError) {
        return res.status(err.status).json({
            code:    err.code,
            message: err.message,
            details: err.details || undefined
        });
    }

    return res.status(500).json({
        code:    ERROR_CODES.INTERNAL_ERROR,
        message: 'Something went wrong'
    });
};