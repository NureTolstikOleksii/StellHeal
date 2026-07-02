import { Router } from "express";
import { AppError } from "../../shared/errors/AppError.js";
import { ERROR_CODES } from "../../shared/constants/errorCodes.js";
import { DeviceService } from "./device.service.js";
import { authenticateToken } from "../../middleware/auth.middleware.js";
import { authenticateDevice } from "../../middleware/device.middleware.js";

const deviceService = new DeviceService();
const router = Router();

// device registration
router.post("/auth", async (req, res, next) => {
    try {
        const { device_uid, secret } = req.body;

        if (!device_uid || !secret) {
            throw new AppError(ERROR_CODES.VALIDATION_ERROR, "device_uid and secret required", 400);
        }

        const result = await deviceService.authenticate(device_uid, secret);
        res.json(result);

    } catch (err) {
        next(err);
    }
});

// device life status
router.post("/heartbeat", authenticateDevice, async (req, res, next) => {
    try {
        const { containerId } = req.device;
        const result = await deviceService.heartbeat(containerId);
        res.json(result);
    } catch (err) {
        next(err);
    }
});

// device commands
router.get("/commands", authenticateDevice, async (req, res, next) => {
    try {
        const { containerId } = req.device;
        const commands = await deviceService.getPendingCommands(containerId);
        res.json(commands);
    } catch (err) {
        next(err);
    }
});

// commands done
router.post("/commands/:id/done", authenticateDevice, async (req, res, next) => {
    try {
        const result = await deviceService.completeCommand(req.params.id);
        res.json(result);
    } catch (err) {
        next(err);
    }
});

// find next-intake for device
router.get("/next-intake", authenticateDevice, async (req, res, next) => {
    try {
        const { containerId } = req.device;
        const result = await deviceService.getNextIntake(containerId);

        if (!result) {
            return res.json({ message: "No pending intakes" });
        }

        res.json(result);
    } catch (err) {
        next(err);
    }
});

// device intakes
router.post("/intake", authenticateDevice, async (req, res, next) => {
    try {
        const { containerId } = req.device;
        const { prescription_med_id } = req.body;

        if (!prescription_med_id) {
            throw new AppError(ERROR_CODES.VALIDATION_ERROR, "prescription_med_id required", 400);
        }

        const result = await deviceService.confirmIntake(containerId, prescription_med_id);
        res.json(result);
    } catch (err) {
        next(err);
    }
});

// start filling
router.post("/fill/start", authenticateToken, async (req, res, next) => {
    try {
        const { containerId } = req.body;
        const result = await deviceService.startFill(containerId);
        res.json(result);
    } catch (err) {
        next(err);
    }
});

// confirm filling
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

// get compartment
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

// rotate to compartment
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

// clear compartment
router.post("/fill/clear", authenticateToken, async (req, res, next) => {
    try {
        const { containerId, compartmentId, compartmentNumber } = req.body;

        if (!containerId || !compartmentId || !compartmentNumber) {
            throw new AppError(ERROR_CODES.VALIDATION_ERROR, "containerId, compartmentId and compartmentNumber required", 400);
        }

        const result = await deviceService.clearCompartment(containerId, compartmentId, compartmentNumber);
        res.json(result);
    } catch (err) {
        next(err);
    }
});

// employee auth
router.post("/rfid-status", authenticateDevice, async (req, res, next) => {
    try {
        const { containerId } = req.device;
        const { authenticated } = req.body;
        const result = await deviceService.updateRfidStatus(containerId, authenticated);
        res.json(result);
    } catch (err) {
        next(err);
    }
});

// get rfid status
router.get("/rfid-status/:containerId", authenticateToken, async (req, res, next) => {
    try {
        const containerId = Number(req.params.containerId);
        const result = await deviceService.getRfidStatus(containerId);
        res.json(result);
    } catch (err) {
        next(err);
    }
});

// reset rfid
router.post("/rfid-reset/:containerId", authenticateToken, async (req, res, next) => {
    try {
        const containerId = Number(req.params.containerId);
        const result = await deviceService.resetRfid(containerId);
        res.json(result);
    } catch (err) {
        next(err);
    }
});

// log device event
router.post("/event", authenticateDevice, async (req, res, next) => {
    try {
        const { containerId } = req.device;
        const { type, code, message } = req.body;

        if (!type) {
            throw new AppError(ERROR_CODES.VALIDATION_ERROR, "type required", 400);
        }

        await deviceService.logDeviceEvent(containerId, type, code, message);
        res.json({ message: "Event logged" });
    } catch (err) {
        next(err);
    }
});

// get active fill session
router.get("/fill-session", authenticateToken, async (req, res, next) => {
    try {
        const { containerId } = req.query;

        if (!containerId) {
            throw new AppError(ERROR_CODES.VALIDATION_ERROR, "containerId required", 400);
        }

        const session = await deviceService.getActiveFillSession(Number(containerId));
        res.json(session || { message: "No active session" });
    } catch (err) {
        next(err);
    }
});

export const deviceRouter = router;