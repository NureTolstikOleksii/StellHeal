import { AppError } from "../shared/errors/AppError.js";
import { ERROR_CODES } from "../shared/constants/errorCodes.js";

export const authorizeRoles = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return next(
                new AppError(
                    ERROR_CODES.UNAUTHORIZED,
                    'Unauthorized',
                    401
                )
            );
        }

        if (!roles.includes(req.user.roleId)) {
            return next(
                new AppError(
                    ERROR_CODES.FORBIDDEN,
                    'Access denied',
                    403
                )
            );
        }

        next();
    };
};