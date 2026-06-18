import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

import { PatientsService } from './patients.service.js';
import { authenticateToken } from '../../middleware/auth.middleware.js';
import { authorizeRoles } from '../../middleware/role.middleware.js';
import { validateEmail } from "../../middleware/validation/validateEmail.js";
import { AppError } from "../../shared/errors/AppError.js";
import { ERROR_CODES } from "../../shared/constants/errorCodes.js";

const router = Router();
const patientsService = new PatientsService();


const uploadDir = path.resolve('uploads/prescriptions');
fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        const allowed = /pdf|jpe?g|png|docx?/i;
        cb(null, allowed.test(path.extname(file.originalname)));
    }
});

// list of patients for nurses
router.get(
    '/staff',
    authenticateToken,
    authorizeRoles(2),
    async (req, res, next) => {
        try {
            const result = await patientsService.getAllPatientsForStaff();
            res.json(result);
        } catch (err) { next(err); }
    }
);

// === Admin/Web ============================================================

// intake stats by patient
router.get(
    '/:id/intake',
    authenticateToken,
    authorizeRoles(1, 4),
    async (req, res, next) => {
        try {
            const result = await patientsService.getIntakeStats(
                Number(req.params.id),
                req.query.prescriptionId,
                req.query.date
            );
            res.json(result);
        } catch (err) { next(err); }
    }
);

// list of patients
router.get(
    '/',
    authenticateToken,
    authorizeRoles(1, 4),
    async (req, res, next) => {
        try {
            const result = await patientsService.getAllPatients();
            res.json(result);
        } catch (err) { next(err); }
    }
);

// patient count stats
router.get(
    '/stats',
    authenticateToken,
    authorizeRoles(1, 4),
    async (req, res, next) => {
        try {
            const counts = await patientsService.getCounts();
            res.json(counts);
        } catch (err) { next(err); }
    }
);

// Excel export
router.get(
    '/export',
    authenticateToken,
    authorizeRoles(1, 4),
    async (req, res, next) => {
        try {
            const buffer = await patientsService.exportPatientsToExcel();
            res.setHeader('Content-Disposition', 'attachment; filename=patients.xlsx');
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.send(buffer);
        } catch (err) { next(err); }
    }
);

// create patient
router.post(
    '/create',
    authenticateToken,
    authorizeRoles(1, 4),
    validateEmail,
    async (req, res, next) => {
        try {
            const result = await patientsService.createPatient(req.body, req);
            res.status(201).json(result);
        } catch (err) { next(err); }
    }
);

// create prescription
router.post(
    '/prescriptions/create',
    authenticateToken,
    authorizeRoles(1),
    upload.array('files', 10),
    async (req, res, next) => {
        try {
            const doctorId = req.user.userId;
            const { patientId } = req.body;

            if (!patientId) {
                return next(new AppError(ERROR_CODES.VALIDATION_ERROR, 'Patient ID not specified', 400));
            }

            const result = await patientsService.createPrescription(
                doctorId,
                patientId,
                req.body,
                req.files,
                req
            );

            res.status(201).json(result);
        } catch (err) { next(err); }
    }
);

// delete prescription
router.delete(
    '/prescriptions/:id',
    authenticateToken,
    authorizeRoles(1),
    async (req, res, next) => {
        try {
            const id = Number(req.params.id);

            if (!id) {
                return next(new AppError(ERROR_CODES.VALIDATION_ERROR, 'prescription ID not specified', 400));
            }

            await patientsService.deletePrescription(id, req);
            res.json({ message: 'prescription deleted' });
        } catch (err) { next(err); }
    }
);

// get prescription for edit
router.get(
    '/prescriptions/:id',
    authenticateToken,
    authorizeRoles(1, 4),
    async (req, res, next) => {
        try {
            const result = await patientsService.getPrescriptionById(req.params.id);
            res.json(result);
        } catch (err) { next(err); }
    }
);

// update prescription
router.put(
    '/prescriptions/:id',
    authenticateToken,
    authorizeRoles(1),
    upload.array('files', 10),
    async (req, res, next) => {
        try {
            const result = await patientsService.updatePrescription(
                req.params.id,
                req.body,
                req.files,
                req
            );
            res.json(result);
        } catch (err) { next(err); }
    }
);

// prescription files by patient+prescription
router.get(
    '/:patientId/prescriptions/:prescriptionId/files',
    authenticateToken,
    authorizeRoles(1, 4),
    async (req, res, next) => {
        try {
            const files = await patientsService.getPrescriptionFiles(req.params.prescriptionId);
            res.json(files);
        } catch (err) { next(err); }
    }
);

// all files by patient
router.get(
    '/:patientId/files',
    authenticateToken,
    authorizeRoles(1, 4),
    async (req, res, next) => {
        try {
            const files = await patientsService.getAllPatientFiles(Number(req.params.patientId));
            res.json(files);
        } catch (err) { next(err); }
    }
);

// patient treatment Excel report
router.get(
    '/:id/report',
    authenticateToken,
    authorizeRoles(1, 4),
    async (req, res, next) => {
        try {
            const patientId = Number(req.params.id);

            if (!patientId) {
                return next(new AppError(ERROR_CODES.VALIDATION_ERROR, 'Patient ID not specified', 400));
            }

            const buffer = await patientsService.generateTreatmentReport(patientId);
            res.setHeader('Content-Disposition', `attachment; filename="treatment-report-${patientId}.xlsx"`);
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.send(buffer);
        } catch (err) { next(err); }
    }
);

// current treatment
router.get(
    '/:id/current',
    authenticateToken,
    authorizeRoles(1, 2, 4, 3),
    async (req, res, next) => {
        try {
            const result = await patientsService.getCurrentTreatment(Number(req.params.id));
            res.json(result);
        } catch (err) { next(err); }
    }
);

// treatment history
router.get(
    '/:id/history',
    authenticateToken,
    authorizeRoles(1, 2, 4, 3),
    async (req, res, next) => {
        try {
            const result = await patientsService.getTreatmentHistory(Number(req.params.id));
            res.json(result);
        } catch (err) { next(err); }
    }
);

// patient by id
router.get(
    '/:id',
    authenticateToken,
    authorizeRoles(1, 2, 4),
    async (req, res, next) => {
        try {
            const result = await patientsService.getById(Number(req.params.id));
            res.json(result);
        } catch (err) { next(err); }
    }
);

// update patient
router.put(
    '/:id',
    authenticateToken,
    authorizeRoles(1),
    validateEmail,
    async (req, res, next) => {
        try {
            const id = Number(req.params.id);

            if (!id) {
                return next(new AppError(ERROR_CODES.VALIDATION_ERROR, 'Invalid user ID', 400));
            }

            const updated = await patientsService.updatePatient(id, req.body, req);
            res.json(updated);
        } catch (err) { next(err); }
    }
);

// delete patient
router.delete(
    '/:id',
    authenticateToken,
    authorizeRoles(1, 4),
    async (req, res, next) => {
        try {
            const id = Number(req.params.id);

            if (!id) {
                return next(new AppError(ERROR_CODES.VALIDATION_ERROR, 'Patient ID not specified', 400));
            }

            await patientsService.deletePatient(id, req);
            res.json({ message: 'Patient deleted' });
        } catch (err) { next(err); }
    }
);


// ====== Mobile ===============================================================


// prescription history (patient)
router.post(
    '/prescription-history',
    authenticateToken,
    authorizeRoles(3),
    async (req, res, next) => {
        try {
            const { patientId } = req.body;

            if (!patientId) {
                return next(new AppError(ERROR_CODES.VALIDATION_ERROR, 'patientId is required', 400));
            }

            const result = await patientsService.getPrescriptionHistoryByPatient(patientId);
            res.json(result);
        } catch (err) { next(err); }
    }
);

// prescription details (patient)
router.post(
    '/prescription-details',
    authenticateToken,
    authorizeRoles(3),
    async (req, res, next) => {
        try {
            const { prescriptionId } = req.body;

            if (!prescriptionId) {
                return next(new AppError(ERROR_CODES.VALIDATION_ERROR, 'Prescription ID is required', 400));
            }

            const result = await patientsService.getPrescriptionDetails(prescriptionId);
            res.json(result);
        } catch (err) { next(err); }
    }
);

// PDF prescription report (patient)
router.post(
    '/prescription-report',
    authenticateToken,
    authorizeRoles(3),
    async (req, res, next) => {
        try {
            const buffer = await patientsService.generatePrescriptionReport(req.body.prescriptionId);
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Length', buffer.length);
            res.setHeader('Content-Disposition', 'attachment; filename=prescription-report.pdf');
            res.send(buffer);
        } catch (err) { next(err); }
    }
);

router.get("/:id/mobile-treatment", authenticateToken, async (req, res, next) => {
    try {
        const result = await patientsService.getMobileTreatment(Number(req.params.id));
        res.json(result);
    } catch (err) { next(err); }
});

export const mainRouter = router;