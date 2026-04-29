import { Router } from 'express';
import { PatientsService } from './patients.service.js';
import { authenticateToken } from '../../middleware/auth.middleware.js';
import { authorizeRoles } from '../../middleware/role.middleware.js';
import { validateEmail } from '../../middleware/validation/validateEmail.js';

const router = Router();
const patientsService = new PatientsService();

// отримання списку пацієнтів
router.get('/', async (req, res) => {
    try {
        const result = await patientsService.getAllPatients(req.db);
        res.json(result);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch patients', error: err.message });
    }
});

// отримання списку пацієнтів для медсестер
router.get('/staff', async (req, res) => {
    try {
        const result = await patientsService.getAllPatientsForStaff(req.db);
        res.json(result);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch patients', error: err.message });
    }
});

// отримання кількості пацієнтів
router.get('/stats', async (req, res) => {
    try {
        const counts = await patientsService.getCounts(req.db);
        res.json(counts);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch stats', error: err.message });
    }
});

// додавання пацієнта
router.post('/create', validateEmail, async (req, res) => {
    try {
        const result = await patientsService.createPatient(req.db, req.body);
        res.status(201).json(result);
    } catch (err) {
        res.status(500).json({ message: 'Failed to create patient', error: err.message });
    }
});

// звіт Excel
router.get('/export', async (req, res) => {
    try {
        const buffer = await patientsService.exportPatientsToExcel(req.db);
        res.setHeader('Content-Disposition', 'attachment; filename=patients.xlsx');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);
    } catch (err) {
        console.error('Помилка при експорті:', err);
        res.status(500).json({ error: 'Не вдалося отримати пацієнтів' });
    }
});

// інформація про пацієнта по ід
router.get('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await patientsService.getById(req.db, Number(id));
        res.json(result);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch patient', error: err.message });
    }
});

// отримання поточного лікування пацієнта
router.get('/:id/current', async (req, res) => {
    try {
        const result = await patientsService.getCurrentTreatment(req.db, Number(req.params.id));
        res.json(result);
    } catch (err) {
        console.error('Помилка отримання поточного лікування:', err);
        res.status(500).json({ error: 'Не вдалося отримати поточне лікування' });
    }
});

// отримання історії лікування пацієнта
router.get('/:id/history', async (req, res) => {
    try {
        const result = await patientsService.getTreatmentHistory(req.db, Number(req.params.id));
        res.json(result);
    } catch (err) {
        console.error('Помилка отримання історії лікування:', err);
        res.status(500).json({ error: 'Не вдалося отримати історію лікування' });
    }
});

// cтворення призначення
router.post('/prescriptions/create', authenticateToken, authorizeRoles(1), async (req, res) => {
    try {
        const doctorId = req.user.userId;
        const { patientId } = req.body;

        if (!patientId) {
            return res.status(400).json({ message: 'Не вказано ID пацієнта' });
        }

        const result = await patientsService.createPrescription(req.db, doctorId, patientId, req.body);
        res.status(201).json(result);
    } catch (err) {
        console.error('Помилка при створенні призначення:', err);
        res.status(500).json({ message: err.message || 'Не вдалося створити призначення' });
    }
});

// видалення призначення
router.delete('/prescriptions/:id', authenticateToken, authorizeRoles(1), async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) return res.status(400).json({ message: 'Не вказано ID призначення' });

        await patientsService.deletePrescription(req.db, id);

        res.status(200).json({ message: 'Призначення видалено' });
    } catch (err) {
        console.error('Помилка при видаленні призначення:', err);
        res.status(500).json({ message: err.message || 'Помилка сервера' });
    }
});

// звіт з лікування пацієнта
router.get('/:id/report', authenticateToken, authorizeRoles(1, 4), async (req, res) => {
    try {
        const patientId = parseInt(req.params.id, 10);
        const buffer = await patientsService.generateTreatmentReport(req.db, patientId);

        res.setHeader('Content-Disposition', `attachment; filename="treatment-report-${patientId}.xlsx"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);
    } catch (err) {
        console.error('Помилка створення звіту:', err);
        res.status(500).json({ message: 'Помилка створення звіту' });
    }
});

// видалення пацієнта
router.delete('/:id', authenticateToken, authorizeRoles(1), async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) return res.status(400).json({ message: 'Не вказано ID пацієнта' });

        await patientsService.deletePatient(req.db, parseInt(id));

        res.status(200).json({ message: 'Пацієнта видалено' });
    } catch (err) {
        console.error('Помилка при видаленні пацієнта:', err);
        res.status(500).json({ message: 'Помилка сервера' });
    }
});

// оновлення пацієнта
router.put('/:id', authenticateToken, authorizeRoles(1), validateEmail, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: 'Invalid user ID' });

    try {
        const updated = await patientsService.updatePatient(req.db, id, req.body);
        res.json(updated);
    } catch (err) {
        console.error('Помилка оновлення:', err);
        res.status(500).json({ message: 'Update failed' });
    }
});


// --- mobile ---


// отримання історії лікувань для пацієнта (patient)
router.post('/prescription-history', async (req, res) => {
    const {patientId} = req.body;

    if (!patientId) {
        return res.status(400).json({message: 'patientId is required'});
    }

    try {
        const result = await patientsService.getPrescriptionHistoryByPatient(req.db, patientId);
        res.json(result);
    } catch (err) {
        console.error('Error fetching prescription history:', err);
        res.status(500).json({message: 'Failed to fetch history', error: err.message});
    }
});

// деталі призначення для пацієнта (patient)
router.post('/prescription-details', async (req, res) => {
    const { prescriptionId } = req.body;
    if (!prescriptionId) {
        return res.status(400).json({ message: 'Prescription ID is required' });
    }

    try {
        const result = await patientsService.getPrescriptionDetails(req.db, prescriptionId);
        res.json(result);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch prescription info', error: err.message });
    }
});

// звіт PDF (patient)
router.post('/prescription-report', patientsService.generatePrescriptionReport);

export const mainRouter = router;
