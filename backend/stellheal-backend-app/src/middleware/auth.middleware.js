import jwt from "jsonwebtoken";
import { AppError } from "../shared/errors/AppError.js";
import { ERROR_CODES } from "../shared/constants/errorCodes.js";

export const authenticateToken = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return next(
            new AppError(
                ERROR_CODES.UNAUTHORIZED,
                'Token required',
                401
            )
        );
    }

    const token = authHeader.split(' ')[1];

    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch (err) {
        return next(
            new AppError(
                ERROR_CODES.FORBIDDEN,
                'Invalid token',
                403
            )
        );
    }
};