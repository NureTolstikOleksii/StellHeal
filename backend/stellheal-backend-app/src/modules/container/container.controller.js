import { Router } from 'express';
import { ContainerService } from './container.service.js';

import { authenticateToken } from '../../middleware/auth.middleware.js';
import { authorizeRoles } from '../../middleware/role.middleware.js';
import {ERROR_CODES} from "../../shared/constants/errorCodes.js";
import {AppError} from "../../shared/errors/AppError.js";

const router = Router();
const containerService = new ContainerService();

// number of containers ok
router.get(
    '/count',
    authenticateToken,
    authorizeRoles(1, 2, 4), // admin, doctor, staff
    async (req, res, next) => {
        try {
            const count = await containerService.getTotalContainers();
            res.json({ count });
        } catch (err) {
            next(err);
        }
    }
);

// container statistics ok
router.get(
    '/stats',
    authenticateToken,
    authorizeRoles(1, 2, 4),
    async (req, res, next) => {
        try {
            const stats = await containerService.getContainerStats();
            res.json(stats);
        } catch (err) {
            next(err);
        }
    }
);

// last fills ok
router.get(
    '/fillings',
    authenticateToken,
    authorizeRoles(1, 2, 4),
    async (req, res, next) => {
        try {
            const data = await containerService.getLatestFillings();
            res.json(data);
        } catch (err) {
            next(err);
        }
    }
);

// report from containers ok
router.get(
    '/export',
    authenticateToken,
    authorizeRoles(1, 4),
    async (req, res, next) => {
        try {
            const buffer = await containerService.exportContainersToExcel(req);

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename=containers-report.xlsx');

            res.send(buffer);

        } catch (err) {
            next(err);
        }
    }
);

// --- mobile ---

// вільні контейнери
router.get(
    '/free',
    authenticateToken,
    authorizeRoles(1, 2, 4), // admin, doctor, staff
    async (req, res, next) => {
        try {
            const free = await containerService.getFreeContainers();
            res.json(free);
        } catch (err) {
            next(err);
        }
    }
);

// закріплення
router.post(
    '/assign',
    authenticateToken,
    authorizeRoles(1, 2), // admin + doctor
    async (req, res, next) => {
        try {
            const { containerId, patientId } = req.body;

            if (!containerId || !patientId) {
                return next(new AppError(
                    ERROR_CODES.VALIDATION_ERROR,
                    'Потрібні containerId та patientId',
                    400
                ));
            }

            const updated = await containerService.assignPatientToContainer(
                containerId,
                patientId,
                req
            );

            res.json(updated);

        } catch (err) {
            next(err);
        }
    }
);

// відкріплення
router.post(
    '/unassign',
    authenticateToken,
    authorizeRoles(1, 2),
    async (req, res, next) => {
        try {
            const { containerId, patientId } = req.body;

            if (!containerId || !patientId) {
                return next(new AppError(
                    ERROR_CODES.VALIDATION_ERROR,
                    'Потрібні containerId та patientId',
                    400
                ));
            }

            const result = await containerService.unassignContainer(
                containerId,
                patientId,
                req
            );

            res.json(result);

        } catch (err) {
            next(err);
        }
    }
);

// всі контейнери
router.get(
    '/',
    authenticateToken,
    authorizeRoles(1, 2, 4),
    async (req, res, next) => {
        try {
            const containers = await containerService.getAllContainers();
            res.json(containers);
        } catch (err) {
            next(err);
        }
    }
);

// деталі контейнера
router.get(
    '/:id',
    authenticateToken,
    authorizeRoles(1, 2, 4),
    async (req, res, next) => {
        try {
            const containerId = Number(req.params.id);

            if (!containerId) {
                return next(new AppError(
                    ERROR_CODES.VALIDATION_ERROR,
                    'containerId required',
                    400
                ));
            }

            const data = await containerService.getContainerDetails(containerId);
            res.json(data);

        } catch (err) {
            next(err);
        }
    }
);

// очищення відсіку
router.post(
    '/compartments/clear',
    authenticateToken,
    authorizeRoles(2, 1), // staff + doctor
    async (req, res, next) => {
        try {
            const { compartmentId } = req.body;

            if (!compartmentId) {
                return next(new AppError(
                    ERROR_CODES.VALIDATION_ERROR,
                    'compartmentId required',
                    400
                ));
            }

            const result = await containerService.clearCompartment(
                compartmentId,
                req
            );

            res.json(result);

        } catch (err) {
            next(err);
        }
    }
);

// заповнені відсіки
router.get(
    '/:id/compartments',
    authenticateToken,
    authorizeRoles(1, 2, 4),
    async (req, res, next) => {
        try {
            const containerId = Number(req.params.id);

            const result = await containerService.getFilledCompartments(containerId);
            res.json(result);

        } catch (err) {
            next(err);
        }
    }
);

// призначення на сьогодні
router.get(
    '/patient/:id/today',
    authenticateToken,
    authorizeRoles(2, 3), // staff + patient
    async (req, res, next) => {
        try {
            const patientId = Number(req.params.id);

            const prescriptions = await containerService.getTodayPrescriptions(patientId);

            res.json(prescriptions.map(p => ({
                prescription_med_id: p.prescription_med_id,
                medication: p.medications?.name || 'Unknown',
                quantity: p.quantity,
                intake_time: p.intake_time
            })));

        } catch (err) {
            next(err);
        }
    }
);

// заповнення
router.post(
    '/compartments/fill',
    authenticateToken,
    authorizeRoles(2), // тільки медсестра
    async (req, res, next) => {
        try {
            const { compartmentId, prescription_med_id } = req.body;

            if (!compartmentId || !prescription_med_id) {
                return next(new AppError(
                    ERROR_CODES.VALIDATION_ERROR,
                    'Missing required fields',
                    400
                ));
            }

            const result = await containerService.addMedicationToCompartment(
                compartmentId,
                prescription_med_id,
                req
            );

            res.status(201).json(result);

        } catch (err) {
            next(err);
        }
    }
);

// статистика прийому за дату
router.get(
    '/patients/:id/intake',
    authenticateToken,
    authorizeRoles(2, 3, 1, 4), // staff, patient, doctor, admin
    async (req, res, next) => {
        try {
            const patientId = Number(req.params.id);
            const { date } = req.query; // YYYY-MM-DD

            if (!patientId || !date) {
                return next(new AppError(
                    ERROR_CODES.VALIDATION_ERROR,
                    'patientId and date are required',
                    400
                ));
            }

            const result = await containerService.getIntakeStatistics(patientId, date);
            res.json(result);

        } catch (err) {
            next(err);
        }
    }
);

// діапазон дат лікування
router.get(
    '/patients/:id/date-range',
    authenticateToken,
    authorizeRoles(2, 3, 1, 4),
    async (req, res, next) => {
        try {
            const patientId = Number(req.params.id);

            if (!patientId) {
                return next(new AppError(
                    ERROR_CODES.VALIDATION_ERROR,
                    'patientId is required',
                    400
                ));
            }

            const result = await containerService.getPrescriptionDateRange(patientId);
            res.json(result);

        } catch (err) {
            next(err);
        }
    }
);

// всі контейнери (для адміна/панелі)
router.get(
    '/all-container-details',
    authenticateToken,
    authorizeRoles(1, 4), // doctor, admin
    async (req, res, next) => {
        try {
            const result = await containerService.getAllContainerDetails();
            res.json(result);
        } catch (err) {
            next(err);
        }
    }
);


// --- ІоТ ---

// отримання пацієнта за контейнером
// отримати patientId
router.get(
    '/:id/patient',
    authenticateToken,
    authorizeRoles(1, 2, 4),
    async (req, res, next) => {
        try {
            const containerId = Number(req.params.id);

            const patientId = await containerService.getPatientIdByContainer(containerId);

            res.json({ patient_id: patientId });

        } catch (err) {
            next(err);
        }
    }
);

// наступний прийом
router.get(
    '/:id/next-intake',
    authenticateToken,
    async (req, res, next) => {
        try {
            const containerId = Number(req.params.id);

            const nextIntake = await containerService.getNextIntake(containerId);

            res.json(nextIntake || { message: 'Немає запланованих прийомів' });

        } catch (err) {
            next(err);
        }
    }
);

// оновлення статусу (IoT або admin)
router.patch(
    '/:id/status',
    authenticateToken,
    authorizeRoles(1, 2), // admin + staff (або IoT токен)
    async (req, res, next) => {
        try {
            const containerId = Number(req.params.id);
            const { status } = req.body;

            if (!status) {
                return next(new AppError(
                    ERROR_CODES.VALIDATION_ERROR,
                    'status required',
                    400
                ));
            }

            const updated = await containerService.updateContainerStatus(
                containerId,
                status,
                req
            );

            res.json({
                message: 'Статус оновлено',
                data: updated
            });

        } catch (err) {
            next(err);
        }
    }
);

// оновлення статусу прийому
router.patch(
    '/intake',
    authenticateToken,
    authorizeRoles(2, 3), // nurse + patient
    async (req, res, next) => {
        try {
            const { prescription_med_id, status } = req.body;

            if (typeof prescription_med_id !== 'number' || typeof status !== 'boolean') {
                return next(new AppError(
                    ERROR_CODES.VALIDATION_ERROR,
                    'prescription_med_id (number) and status (boolean) are required',
                    400
                ));
            }

            const updated = await containerService.updateIntakeStatus(
                prescription_med_id,
                status,
                req
            );

            res.json(updated);

        } catch (err) {
            next(err);
        }
    }
);

// пропущений прийом
router.post(
    '/missed',
    authenticateToken,
    authorizeRoles(2), // тільки медсестра або IoT
    async (req, res, next) => {
        try {
            const { container_id, prescription_med_id } = req.body;

            if (!container_id || !prescription_med_id) {
                return next(new AppError(
                    ERROR_CODES.VALIDATION_ERROR,
                    'Container ID and PrescriptionMed ID are required',
                    400
                ));
            }

            await containerService.sendMissedNotification(
                container_id,
                prescription_med_id,
                req
            );

            res.json({ message: 'Notification created' });

        } catch (err) {
            next(err);
        }
    }
);

// відкриття контейнера (нагадування)
router.post(
    '/open',
    authenticateToken,
    authorizeRoles(2), // nurse або IoT токен
    async (req, res, next) => {
        try {
            const { container_id, prescription_med_id } = req.body;

            if (!container_id || !prescription_med_id) {
                return next(new AppError(
                    ERROR_CODES.VALIDATION_ERROR,
                    'Container ID and PrescriptionMed ID are required',
                    400
                ));
            }

            await containerService.sendOpenNotification(
                container_id,
                prescription_med_id,
                req
            );

            res.json({ message: 'Open notification sent' });

        } catch (err) {
            next(err);
        }
    }
);

// очищення відсіку
router.post(
    '/compartments/clear',
    authenticateToken,
    authorizeRoles(2), // тільки медсестра
    async (req, res, next) => {
        try {
            const { compartment_id } = req.body;

            if (!compartment_id) {
                return next(new AppError(
                    ERROR_CODES.VALIDATION_ERROR,
                    'compartment_id is required',
                    400
                ));
            }

            const result = await containerService.clearCompartmentMedication(
                compartment_id,
                req
            );

            res.json(result);

        } catch (err) {
            next(err);
        }
    }
);

export const containerRouter = router;
