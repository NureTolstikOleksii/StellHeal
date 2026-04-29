import { ERROR_CODES } from "../../shared/constants/errorCodes.js";
import { AppError } from "../../shared/errors/AppError.js";

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;

export function validatePasswordStrength(req, res, next) {
    const { newPassword } = req.body;

    if (!newPassword) {
        return next(
            new AppError(
                ERROR_CODES.VALIDATION_ERROR,
                'Password is required',
                400
            )
        );
    }

    if (!PASSWORD_REGEX.test(newPassword)) {
        return next(
            new AppError(
                ERROR_CODES.WEAK_PASSWORD,
                'Password does not meet requirements',
                400
            )
        );
    }

    next();
}