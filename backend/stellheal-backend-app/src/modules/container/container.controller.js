import { Router } from 'express';
import { ContainerService } from './container.service.js';

import { authenticateToken } from '../../middleware/auth.middleware.js';
import { authorizeRoles } from '../../middleware/role.middleware.js';
import { ERROR_CODES } from '../../shared/constants/errorCodes.js';
import { AppError } from '../../shared/errors/AppError.js';

const router = Router();
const containerService = new ContainerService();


// ====== Common (WEB and MOBILE) =============================================

// all containers
router.get(
    '/',
    authenticateToken,
    authorizeRoles(1, 2, 4),
    async (req, res, next) => {
        try {
            res.json(await containerService.getAllContainers());
        } catch (err) { next(err); }
    }
);

// ====== Admin (WEB) =============================================

// container statistics
router.get(
    '/stats',
    authenticateToken,
    authorizeRoles(4),
    async (req, res, next) => {
        try {
            res.json(await containerService.getContainerStats());
        } catch (err) { next(err); }
    }
);

// last fills
router.get(
    '/fillings',
    authenticateToken,
    authorizeRoles(4),
    async (req, res, next) => {
        try {
            res.json(await containerService.getLatestFillings());
        } catch (err) { next(err); }
    }
);

// count of containers
router.get(
    '/count',
    authenticateToken,
    authorizeRoles(4),
    async (req, res, next) => {
        try {
            const count = await containerService.getTotalContainers();
            res.json({ count });
        } catch (err) { next(err); }
    }
);

// report from containers
router.get(
    '/export',
    authenticateToken,
    authorizeRoles(4),
    async (req, res, next) => {
        try {
            const buffer = await containerService.exportContainersToExcel(req);
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename=containers-report.xlsx');
            res.send(buffer);
        } catch (err) { next(err); }
    }
);

// container registration
router.post(
    '/',
    authenticateToken,
    authorizeRoles(4),
    async (req, res, next) => {
        try {
            const { device_uid } = req.body;
            if (!device_uid?.trim()) {
                return next(new AppError(ERROR_CODES.VALIDATION_ERROR, 'device_uid is required', 400));
            }
            const container = await containerService.registerContainer(device_uid.trim(), req);
            res.status(201).json(container);
        } catch (err) { next(err); }
    }
);

// delete container
router.delete(
    '/:id',
    authenticateToken,
    authorizeRoles(4),
    async (req, res, next) => {
        try {
            const containerId = Number(req.params.id);
            if (!containerId) {
                return next(new AppError(ERROR_CODES.VALIDATION_ERROR, 'containerId required', 400));
            }
            await containerService.deleteContainer(containerId, req);
            res.status(204).end();
        } catch (err) { next(err); }
    }
);

// device log
router.get(
    '/:id/events',
    authenticateToken,
    authorizeRoles(4),
    async (req, res, next) => {
        try {
            const containerId = Number(req.params.id);
            if (!containerId) {
                return next(new AppError(ERROR_CODES.VALIDATION_ERROR, 'containerId required', 400));
            }
            res.json(await containerService.getContainerEvents(containerId));
        } catch (err) { next(err); }
    }
);

// filling sessions
router.get(
    '/:id/sessions',
    authenticateToken,
    authorizeRoles(4),
    async (req, res, next) => {
        try {
            const containerId = Number(req.params.id);
            if (!containerId) {
                return next(new AppError(ERROR_CODES.VALIDATION_ERROR, 'containerId required', 400));
            }
            res.json(await containerService.getContainerSessions(containerId));
        } catch (err) { next(err); }
    }
);

// compartments info (admin)
router.get(
    '/:id/compartments/admin',
    authenticateToken,
    authorizeRoles(4),
    async (req, res, next) => {
        try {
            const containerId = Number(req.params.id);
            if (!containerId) {
                return next(new AppError(ERROR_CODES.VALIDATION_ERROR, 'containerId required', 400));
            }
            res.json(await containerService.getAdminCompartments(containerId));
        } catch (err) { next(err); }
    }
);

// ====== MOBILE =============================================

// free containers
router.get(
    '/free',
    authenticateToken,
    authorizeRoles(2),
    async (req, res, next) => {
        try {
            res.json(await containerService.getFreeContainers());
        } catch (err) { next(err); }
    }
);

// assign patient to container
router.post(
    '/assign',
    authenticateToken,
    authorizeRoles(2),
    async (req, res, next) => {
        try {
            const { containerId, patientId } = req.body;
            if (!containerId || !patientId) {
                return next(new AppError(ERROR_CODES.VALIDATION_ERROR, 'containerId and patientId are required', 400));
            }
            res.json(await containerService.assignPatientToContainer(containerId, patientId, req));
        } catch (err) { next(err); }
    }
);

// unassign patient from container
router.post(
    '/unassign',
    authenticateToken,
    authorizeRoles(2),
    async (req, res, next) => {
        try {
            const { containerId, patientId } = req.body;
            if (!containerId || !patientId) {
                return next(new AppError(ERROR_CODES.VALIDATION_ERROR, 'containerId and patientId are required', 400));
            }
            res.json(await containerService.unassignContainer(containerId, patientId, req));
        } catch (err) { next(err); }
    }
);

// all container details
router.get(
    '/all-container-details',
    authenticateToken,
    authorizeRoles(2),
    async (req, res, next) => {
        try {
            res.json(await containerService.getAllContainerDetails());
        } catch (err) { next(err); }
    }
);

// today's prescriptions
router.get(
    '/patient/:id/today',
    authenticateToken,
    authorizeRoles(2, 3),
    async (req, res, next) => {
        try {
            const patientId = Number(req.params.id);
            if (!patientId) {
                return next(new AppError(ERROR_CODES.VALIDATION_ERROR, 'patientId required', 400));
            }

            const timeZone = req.headers['x-timezone'] || 'Europe/Kyiv';
            const formatter = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
            const localDateStr = formatter.format(new Date());

            const prescriptions = await containerService.getTodayPrescriptions(patientId, localDateStr);

            res.json(prescriptions.map(p => ({
                prescription_med_id: p.prescription_med_id,
                medication:          p.medication_name || 'Unknown',
                quantity:            p.quantity,
                intake_at:           p.intake_at?.toISOString() ?? null,
            })));
        } catch (err) { next(err); }
    }
);

// treatment date range
router.get(
    '/patients/:id/date-range',
    authenticateToken,
    authorizeRoles(2, 3),
    async (req, res, next) => {
        try {
            const patientId = Number(req.params.id);
            if (!patientId) {
                return next(new AppError(ERROR_CODES.VALIDATION_ERROR, 'patientId is required', 400));
            }
            res.json(await containerService.getPrescriptionDateRange(patientId));
        } catch (err) { next(err); }
    }
);

// admission statistics by date
router.get(
    '/patients/:id/intake',
    authenticateToken,
    authorizeRoles(2, 3),
    async (req, res, next) => {
        try {
            const patientId = Number(req.params.id);
            const { date }  = req.query;

            if (!patientId || !date) {
                return next(new AppError(ERROR_CODES.VALIDATION_ERROR, 'patientId and date are required', 400));
            }

            res.json(await containerService.getIntakeStatistics(patientId, date));
        } catch (err) { next(err); }
    }
);

// container details
router.get(
    '/:id',
    authenticateToken,
    authorizeRoles(2),
    async (req, res, next) => {
        try {
            const containerId = Number(req.params.id);
            if (!containerId) {
                return next(new AppError(ERROR_CODES.VALIDATION_ERROR, 'containerId required', 400));
            }
            res.json(await containerService.getContainerDetails(containerId));
        } catch (err) { next(err); }
    }
);

export const containerRouter = router;