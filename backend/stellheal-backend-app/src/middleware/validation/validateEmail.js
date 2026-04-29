import { ERROR_CODES } from "../../shared/constants/errorCodes.js";
import { AppError } from "../../shared/errors/AppError.js";

export const validateEmail = (req, res, next) => {
    const { email, login } = req.body;

    if (!email && !login) {
        return next(
            new AppError(
                ERROR_CODES.VALIDATION_ERROR,
                'Email is required',
                400
            )
        );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (
        (email && !emailRegex.test(email)) ||
        (login && !emailRegex.test(login))
    ) {
        return next(
            new AppError(
                ERROR_CODES.VALIDATION_ERROR,
                'Invalid email format',
                400
            )
        );
    }

    next();
};