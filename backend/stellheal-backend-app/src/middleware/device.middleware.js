import jwt from "jsonwebtoken";
import { AppError } from "../shared/errors/AppError.js";
import { ERROR_CODES } from "../shared/constants/errorCodes.js";

export function authenticateDevice(req, res, next) {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            throw new AppError(ERROR_CODES.UNAUTHORIZED, "Token required", 401);
        }

        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        if (decoded.type !== "device") {
            throw new AppError(ERROR_CODES.FORBIDDEN, "Invalid token type", 403);
        }

        req.device = decoded;
        next();

    } catch (err) {
        next(new AppError(ERROR_CODES.UNAUTHORIZED, "Invalid token", 401));
    }
}