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

// ─── Multer — зберігання файлів аналізів ─────────────────────────────────────
const uploadDir = path.resolve('uploads/prescriptions');
fs.mkdirSync(uploadDir, { recursive: true }); // створює папку якщо немає

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        const allowed = /pdf|jpe?g|png|docx?/i;
        cb(null, allowed.test(path.extname(file.originalname)));
    }
});

// ─── Існуючі маршрути (незмінні) ─────────────────────────────────────────────
router.get(
    '/:id/intake',
    authenticateToken,
    authorizeRoles(1, 4),
    async (req, res, next) => {
        try {
            const result = await patientsService.getIntakeStats(
                Number(req.params.id),
                req.query.prescriptionId, // ← новий параметр
                req.query.date
            );
            res.json(result);
        } catch (err) { next(err); }
    }
);





// display the list of patients ok
router.get(
    '/',
    authenticateToken,
    authorizeRoles(1, 4),
    async (req, res, next) => {
        try {
            const result = await patientsService.getAllPatients();
            res.json(result);
        } catch (err) {
            next(err);
        }
    }
);

// a list of patients (nurses)
router.get(
    '/staff',
    authenticateToken,
    authorizeRoles(2),
    async (req, res, next) => {
        try {
            const result = await patientsService.getAllPatientsForStaff();
            res.json(result);
        } catch (err) {
            next(err);
        }
    }
);

// get the number of patients ok
router.get(
    '/stats',
    authenticateToken,
    authorizeRoles(1, 4),
    async (req, res, next) => {
        try {
            const counts = await patientsService.getCounts();
            res.json(counts);
        } catch (err) {
            next(err);
        }
    }
);

// adding a patient ok
router.post(
    '/create',
    authenticateToken,
    authorizeRoles(1, 4),
    validateEmail,
    async (req, res, next) => {
        try {
            const result = await patientsService.createPatient(req.body, req);
            res.status(201).json(result);
        } catch (err) {
            next(err);
        }
    }
);

// Excel report ok
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
        } catch (err) {
            next(err);
        }
    }
);

// ─── Create prescription (ОНОВЛЕНО: multipart/form-data + нові поля) ──────────
// POST /api/patients/prescriptions/create
router.post(
    '/prescriptions/create',
    authenticateToken,
    authorizeRoles(1),
    upload.array('files', 10), // приймаємо до 10 файлів
    async (req, res, next) => {
        try {
            const doctorId = req.user.userId;
            const { patientId } = req.body;

            if (!patientId) {
                return next(new AppError(
                    ERROR_CODES.VALIDATION_ERROR,
                    'Не вказано ID пацієнта',
                    400
                ));
            }

            const result = await patientsService.createPrescription(
                doctorId,
                patientId,
                req.body,   // diagnosis, wardId, medications (JSON-рядок), complaints, anamnesis...
                req.files,  // масив файлів від multer
                req
            );

            res.status(201).json(result);

        } catch (err) {
            next(err);
        }
    }
);

// delete prescription ok
router.delete(
    '/prescriptions/:id',
    authenticateToken,
    authorizeRoles(1),
    async (req, res, next) => {
        try {
            const id = Number(req.params.id);

            if (!id) {
                return next(new AppError(
                    ERROR_CODES.VALIDATION_ERROR,
                    'Не вказано ID призначення',
                    400
                ));
            }

            await patientsService.deletePrescription(id, req);

            res.json({ message: 'Призначення видалено' });

        } catch (err) {
            next(err);
        }
    }
);

router.get(
    '/:patientId/prescriptions/:prescriptionId/files',
    authenticateToken,
    authorizeRoles(1, 4),
    async (req, res, next) => {
        try {
            const files = await patientsService.getPrescriptionFiles(
                req.params.prescriptionId
            );
            res.json(files);
        } catch (err) {
            next(err);
        }
    }
);

router.get(
    '/:patientId/files',
    authenticateToken,
    authorizeRoles(1, 4),
    async (req, res, next) => {
        try {
            const files = await patientsService.getAllPatientFiles(
                Number(req.params.patientId)
            );
            res.json(files);
        } catch (err) {
            next(err);
        }
    }
);

// patient information by id ok
router.get(
    '/:id',
    authenticateToken,
    authorizeRoles(1, 2, 4),
    async (req, res, next) => {
        try {
            const result = await patientsService.getById(Number(req.params.id));
            res.json(result);
        } catch (err) {
            next(err);
        }
    }
);

// get the patient's current treatment ok
router.get(
    '/:id/current',
    authenticateToken,
    authorizeRoles(1, 2, 4, 3),
    async (req, res, next) => {
        try {
            const result = await patientsService.getCurrentTreatment(Number(req.params.id));
            res.json(result);
        } catch (err) {
            next(err);
        }
    }
);

// get patient treatment history ok
router.get(
    '/:id/history',
    authenticateToken,
    authorizeRoles(1, 2, 4, 3),
    async (req, res, next) => {
        try {
            const result = await patientsService.getTreatmentHistory(Number(req.params.id));
            res.json(result);
        } catch (err) {
            next(err);
        }
    }
);

// delete patient ok
router.delete(
    '/:id',
    authenticateToken,
    authorizeRoles(1, 4),
    async (req, res, next) => {
        try {
            const id = Number(req.params.id);

            if (!id) {
                return next(new AppError(
                    ERROR_CODES.VALIDATION_ERROR,
                    'Не вказано ID пацієнта',
                    400
                ));
            }

            await patientsService.deletePatient(id, req);

            res.json({ message: 'Пацієнта видалено' });

        } catch (err) {
            next(err);
        }
    }
);

// update patient ok
router.put(
    '/:id',
    authenticateToken,
    authorizeRoles(1),
    validateEmail,
    async (req, res, next) => {
        try {
            const id = Number(req.params.id);

            if (!id) {
                return next(new AppError(
                    ERROR_CODES.VALIDATION_ERROR,
                    'Invalid user ID',
                    400
                ));
            }

            const updated = await patientsService.updatePatient(id, req.body, req);

            res.json(updated);

        } catch (err) {
            next(err);
        }
    }
);

// patient treatment report ok
router.get(
    '/:id/report',
    authenticateToken,
    authorizeRoles(1, 4),
    async (req, res, next) => {
        try {
            const patientId = Number(req.params.id);

            if (!patientId) {
                return next(new AppError(
                    ERROR_CODES.VALIDATION_ERROR,
                    'Не вказано ID пацієнта',
                    400
                ));
            }

            const buffer = await patientsService.generateTreatmentReport(patientId);

            res.setHeader('Content-Disposition', `attachment; filename="treatment-report-${patientId}.xlsx"`);
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.send(buffer);

        } catch (err) {
            next(err);
        }
    }
);

// --- mobile ---

// treatment history (patient) ok
router.post(
    '/prescription-history',
    authenticateToken,
    authorizeRoles(3),
    async (req, res, next) => {
        try {
            const { patientId } = req.body;

            if (!patientId) {
                return next(new AppError(
                    ERROR_CODES.VALIDATION_ERROR,
                    'patientId is required',
                    400
                ));
            }

            const result = await patientsService.getPrescriptionHistoryByPatient(patientId);
            res.json(result);

        } catch (err) {
            next(err);
        }
    }
);

// appointment details (patient) ok
router.post(
    '/prescription-details',
    authenticateToken,
    authorizeRoles(3),
    async (req, res, next) => {
        try {
            const { prescriptionId } = req.body;

            if (!prescriptionId) {
                return next(new AppError(
                    ERROR_CODES.VALIDATION_ERROR,
                    'Prescription ID is required',
                    400
                ));
            }

            const result = await patientsService.getPrescriptionDetails(prescriptionId);

            res.json(result);

        } catch (err) {
            next(err);
        }
    }
);

// PDF report ok
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

        } catch (err) {
            next(err);
        }
    }
);

































// Отримати призначення для редагування
router.get(
    '/prescriptions/:id',
    authenticateToken,
    authorizeRoles(1, 4),
    async (req, res, next) => {
        try {
            const result = await patientsService.getPrescriptionById(req.params.id);
            res.json(result);
        } catch (err) {
            next(err);
        }
    }
);

// Оновити призначення
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
        } catch (err) {
            next(err);
        }
    }
);

export const mainRouter = router;