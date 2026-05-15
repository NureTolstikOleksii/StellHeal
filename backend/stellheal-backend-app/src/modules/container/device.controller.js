import { Router } from "express";
import jwt from "jsonwebtoken";
import { AppError } from "../../shared/errors/AppError.js";
import { ERROR_CODES } from "../../shared/constants/errorCodes.js";
import { DeviceService } from "./device.service.js";
import {authenticateToken} from "../../middleware/auth.middleware.js";

const deviceService = new DeviceService();
const router = Router();

/**
 * 🔐 Middleware для авторизації device
 */
function authenticateDevice(req, res, next) {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            throw new AppError(
                ERROR_CODES.UNAUTHORIZED,
                "Token required",
                401
            );
        }

        const token = authHeader.split(" ")[1];

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        if (decoded.type !== "device") {
            throw new AppError(
                ERROR_CODES.FORBIDDEN,
                "Invalid token type",
                403
            );
        }

        req.device = decoded; // { containerId }

        next();

    } catch (err) {
        next(
            new AppError(
                ERROR_CODES.UNAUTHORIZED,
                "Invalid token",
                401
            )
        );
    }
}

/**
 * 🔐 POST /device/auth
 */
router.post("/auth", async (req, res, next) => {
    try {
        const { device_uid, secret } = req.body;

        if (!device_uid || !secret) {
            throw new AppError(
                ERROR_CODES.VALIDATION_ERROR,
                "device_uid and secret required",
                400
            );
        }

        const result = await deviceService.authenticate(device_uid, secret);

        res.json(result);

    } catch (err) {
        next(err);
    }
});

/**
 * ❤️ POST /device/heartbeat
 */
router.post("/heartbeat", authenticateDevice, async (req, res, next) => {
    try {
        const { containerId } = req.device;

        const result = await deviceService.heartbeat(containerId);

        res.json(result);

    } catch (err) {
        next(err);
    }
});

/**
 * 📡 GET /device/commands
 */
router.get("/commands", authenticateDevice, async (req, res, next) => {
    try {
        const { containerId } = req.device;

        const commands = await deviceService.getPendingCommands(containerId);

        res.json(commands);

    } catch (err) {
        next(err);
    }
});

/**
 * ✅ POST /device/commands/:id/done
 */
router.post("/commands/:id/done", authenticateDevice, async (req, res, next) => {
    try {
        const result = await deviceService.completeCommand(req.params.id);

        res.json(result);

    } catch (err) {
        next(err);
    }
});

/**
 * 💊 GET /device/next-intake
 */
router.get("/next-intake", authenticateDevice, async (req, res, next) => {
    try {
        const { containerId } = req.device;

        const result = await deviceService.getNextIntake(containerId);

        if (!result) {
            return res.json({
                message: "No pending intakes"
            });
        }

        res.json(result);

    } catch (err) {
        next(err);
    }
});

/**
 * 💊 POST /device/intake
 */
router.post("/intake", authenticateDevice, async (req, res, next) => {
    try {
        const { containerId } = req.device;
        const { prescription_med_id } = req.body;

        if (!prescription_med_id) {
            throw new AppError(
                ERROR_CODES.VALIDATION_ERROR,
                "prescription_med_id required",
                400
            );
        }

        const result = await deviceService.confirmIntake(
            containerId,
            prescription_med_id
        );

        res.json(result);

    } catch (err) {
        next(err);
    }
});

router.post("/fill/start", authenticateToken, async (req, res, next) => {
    try {
        const { containerId } = req.body;

        const free = await deviceService.getFreeCompartment(containerId);

        await deviceService.createRotateCommand(
            containerId,
            free.compartment_number
        );

        res.json({
            compartment: free.compartment_number
        });

    } catch (err) {
        next(err);
    }
});

router.post("/fill/confirm", authenticateToken, async (req, res, next) => {
    try {
        const { containerId, compartmentNumber, prescription_med_id } = req.body;

        const result = await deviceService.fillCompartment(
            containerId,
            compartmentNumber,
            prescription_med_id,
            req.user.userId
        );

        res.json(result);

    } catch (err) {
        next(err);
    }
});


// GET /device/compartments/:containerId
router.get("/compartments/:containerId", authenticateToken, async (req, res, next) => {
    try {
        const containerId = Number(req.params.containerId);

        if (!containerId) {
            throw new AppError(ERROR_CODES.VALIDATION_ERROR, "containerId required", 400);
        }

        const result = await deviceService.getCompartments(containerId);

        res.json(result);

    } catch (err) {
        next(err);
    }
});

// POST /device/fill/rotate
router.post("/fill/rotate", authenticateToken, async (req, res, next) => {
    try {
        const { containerId, compartmentNumber } = req.body;

        if (!containerId || !compartmentNumber) {
            throw new AppError(ERROR_CODES.VALIDATION_ERROR, "containerId and compartmentNumber required", 400);
        }

        const result = await deviceService.rotateToCompartment(containerId, compartmentNumber);

        res.json(result);

    } catch (err) {
        next(err);
    }
});



// POST /device/fill/clear
router.post("/fill/clear", authenticateToken, async (req, res, next) => {
    try {
        const { containerId, compartmentId, compartmentNumber } = req.body;

        if (!containerId || !compartmentId || !compartmentNumber) {
            throw new AppError(
                ERROR_CODES.VALIDATION_ERROR,
                "containerId, compartmentId and compartmentNumber required",
                400
            );
        }

        const result = await deviceService.clearCompartment(containerId, compartmentId, compartmentNumber);

        res.json(result);

    } catch (err) {
        next(err);
    }
});

// POST /device/rfid-status
router.post("/rfid-status", authenticateDevice, async (req, res, next) => {
    try {
        const { containerId } = req.device;
        const { authenticated } = req.body;

        await prisma.containers.update({
            where: { container_id: containerId },
            data: { rfid_authenticated: authenticated }
        });

        res.json({ message: "RFID status updated" });
    } catch (err) {
        next(err);
    }
});

// GET /device/rfid-status/:containerId
router.get("/rfid-status/:containerId", authenticateToken, async (req, res, next) => {
    try {
        const containerId = Number(req.params.containerId);
        const container = await prisma.containers.findUnique({
            where: { container_id: containerId },
            select: { rfid_authenticated: true }
        });

        res.json({ rfid_authenticated: container?.rfid_authenticated ?? false });
    } catch (err) {
        next(err);
    }
});

// POST /device/rfid-reset/:containerId
router.post("/rfid-reset/:containerId", authenticateToken, async (req, res, next) => {
    try {
        const containerId = Number(req.params.containerId);

        await prisma.containers.update({
            where: { container_id: containerId },
            data: { rfid_authenticated: false }
        });

        // Закриваємо люк при завершенні заповнення
        await prisma.device_commands.create({
            data: {
                container_id: containerId,
                command: "close_lid",
                payload: {}
            }
        });

        res.json({ message: "RFID reset" });
    } catch (err) {
        next(err);
    }
});

router.post("/weight-alert", authenticateDevice, async (req, res, next) => {
    try {
        const { containerId } = req.device;
        const { prescription_med_id } = req.body;

        const result = await deviceService.sendWeightAlert(
            containerId,
            prescription_med_id
        );

        res.json(result);

    } catch (err) {
        next(err);
    }
});

export const deviceRouter = router;