import { ERROR_CODES } from "../../shared/constants/errorCodes.js";
import { AppError } from "../../shared/errors/AppError.js";

export const validateEmail = (req, res, next) => {
    const { email, login } = req.body;
    const emailToValidate = email || login;

    // Якщо поле не передане — просто йдемо далі (для PATCH це ок)
    if (!emailToValidate) {
        return next();
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailToValidate)) {
        return next(
            new AppError(ERROR_CODES.VALIDATION_ERROR, 'Invalid email format', 400)
        );
    }

    next();
};