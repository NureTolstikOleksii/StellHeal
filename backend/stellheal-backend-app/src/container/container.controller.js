import { Router } from 'express';
import { ContainerService } from './container.service.js';

const router = Router();
const containerService = new ContainerService();

// отримання кількості контейнерів
router.get('/count', async (req, res) => {
    try {
        const count = await containerService.getTotalContainers();
        res.json({ count });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Не вдалося отримати кількість контейнерів' });
    }
});

// отримання статистики контейнерів
router.get('/stats', async (req, res) => {
    try {
        const stats = await containerService.getContainerStats();
        res.json(stats);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Не вдалося отримати статистику контейнерів' });
    }
});

// отримання заповнень контейнерів
router.get('/fillings', async (req, res) => {
    try {
        const data = await containerService.getLatestFillings();
        res.json(data);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Не вдалося отримати дані про заповнення' });
    }
});

// отримання вільних контейнерів
router.get('/free', async (req, res) => {
    try {
        const free = await containerService.getFreeContainers();
        res.json(free);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Не вдалося отримати вільні контейнери' });
    }
});

// закріплення контейнера за пацієнтом
router.post('/assign', async (req, res) => {
    const { containerId, patientId } = req.body;

    if (!containerId || !patientId) {
        return res.status(400).json({ error: 'Потрібні containerId та patientId' });
    }

    try {
        const updated = await containerService.assignPatientToContainer(containerId, patientId);
        res.json(updated);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Не вдалося закріпити пацієнта' });
    }
});

// відкріплення пацієнта від контейнера
router.post('/unassign', async (req, res) => {
    const { containerId, patientId } = req.body;

    if (!containerId || !patientId) {
        return res.status(400).json({ error: 'Потрібні containerId та patientId' });
    }

    try {
        const result = await containerService.unassignContainer(containerId, patientId);
        res.json(result);
    } catch (err) {
        console.error('Помилка відкріплення:', err);
        res.status(500).json({ error: err.message || 'Не вдалося відкріпити контейнер' });
    }
});

// отримання всіх контейнерів
router.get('/', async (req, res) => {
    try {
        const containers = await containerService.getAllContainers();
        res.json(containers);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Не вдалося отримати контейнери' });
    }
});

// отримання деталей контейнерів
router.post('/details', async (req, res) => {
    const { containerId } = req.body;

    if (!containerId) {
        return res.status(400).json({ error: 'Потрібно передати containerId у body' });
    }

    try {
        const data = await containerService.getContainerDetails(Number(containerId));
        res.json(data);
    } catch (err) {
        console.error('Помилка при отриманні деталей контейнера:', err);
        res.status(500).json({ error: 'Не вдалося отримати інформацію про контейнер' });
    }
});

// очищення відсіку
router.post('/compartments/clear', async (req, res) => {
    const { compartmentId } = req.body;

    if (!compartmentId) {
        return res.status(400).json({ error: 'Необхідно вказати compartmentId' });
    }

    try {
        const result = await containerService.clearCompartment(compartmentId);
        res.json(result);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message || 'Помилка при очищенні відсіку' });
    }
});

// отримання заповнених відсіків
router.post('/compartments/filled', async (req, res) => {
    const { containerId } = req.body;

    if (!containerId) {
        return res.status(400).json({ error: 'Потрібно вказати containerId' });
    }

    try {
        const result = await containerService.getFilledCompartments(containerId);
        res.json(result);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Помилка при отриманні статусу відсіків' });
    }
});

// отримання призначень на сьогодні
router.post('/today-prescriptions', async (req, res) => {
    const { patientId } = req.body;

    if (!patientId) {
        return res.status(400).json({ error: 'Missing patientId' });
    }

    try {
        const prescriptions = await containerService.getTodayPrescriptions(patientId);
        res.json(prescriptions.map(p => ({
            prescription_med_id: p.prescription_med_id,
            medication: p.medications?.name || 'Unknown',
            quantity: p.quantity,
            intake_time: p.intake_time
        })));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch today prescriptions' });
    }
});

// заповнення відсіку
router.post('/fill-compartment', async (req, res) => {
    const { compartmentId, prescription_med_id, filled_by } = req.body;

    if (!compartmentId || !prescription_med_id || !filled_by) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const result = await containerService.addMedicationToCompartment(
            compartmentId,
            prescription_med_id,
            filled_by
        );
        res.status(201).json(result);
    } catch (err) {
        console.error('Error adding medication to compartment:', err);
        res.status(500).json({ error: 'Failed to add medication' });
    }
});

// отримання статистики приймання ліків
router.post('/intake-statistics', async (req, res) => {
    const { patientId, date } = req.body;

    if (!patientId || !date) {
        return res.status(400).json({ error: 'patientId and date are required' });
    }

    try {
        const result = await containerService.getIntakeStatistics(patientId, date);
        res.json(result);
    } catch (err) {
        console.error('Error getting intake statistics:', err);
        res.status(500).json({ error: 'Failed to get intake statistics' });
    }
});

// отримання дат для календаря
router.post('/prescription-date-range', async (req, res) => {
    const { patientId } = req.body;

    if (!patientId) {
        return res.status(400).json({ error: 'patientId is required' });
    }

    try {
        const result = await containerService.getPrescriptionDateRange(patientId);
        res.json(result);
    } catch (err) {
        console.error('Error getting prescription date range:', err);
        res.status(500).json({ error: 'Failed to get date range' });
    }
});

// отримання інформації про всі контейнери
router.get('/all-container-details', async (req, res) => {
    try {
        const result = await containerService.getAllContainerDetails();
        res.json(result);
    } catch (err) {
        console.error('Error getting all container details:', err);
        res.status(500).json({ error: 'Failed to get containers' });
    }
});

// звіт по контейнерам
router.get('/export', async (req, res) => {
    try {
        const buffer = await containerService.exportContainersToExcel();
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=containers-report.xlsx');
        res.send(buffer);
    } catch (error) {
        console.error('Помилка при формуванні звіту:', error);
        res.status(500).json({ error: 'Помилка при формуванні звіту' });
    }
});

// --- ІоТ ---

// отримання пацієнта за контейнером
router.get('/:id/getPatientId', async (req, res) => {
    try {
        const { id } = req.params;
        const patientId = await containerService.getPatientIdByContainer(Number(id));

        if (!patientId) {
            return res.status(404).json({ message: 'No patient found for this container' });
        }

        res.json({ id_patient: patientId });
    } catch (error) {
        console.error('Error fetching patient ID:', error);
        res.status(500).json({ message: 'Помилка при отриманні ID пацієнта' });
    }
});

// отримання наступного препарату
router.post('/next-intake', async (req, res) => {
    const { containerId } = req.body;

    if (!containerId) {
        return res.status(400).json({ error: 'Потрібно вказати containerId' });
    }

    try {
        const nextIntake = await containerService.getNextIntake(containerId);
        if (nextIntake) {
            res.json(nextIntake);
        } else {
            res.json({ message: 'Немає запланованих прийомів' });
        }
    } catch (err) {
        console.error('Помилка при отриманні наступного прийому:', err);
        res.status(500).json({ error: 'Не вдалося отримати наступний прийом' });
    }
});

// оновлення статусу контейнера
router.post('/update-status', async (req, res) => {
    const { containerId, status } = req.body;

    if (!containerId || !status) {
        return res.status(400).json({ message: 'containerId і status обов’язкові' });
    }

    try {
        const updated = await containerService.updateContainerStatus(containerId, status);

        if (!updated) {
            return res.status(404).json({ message: 'Контейнер не знайдено' });
        }

        res.status(200).json({ message: 'Статус оновлено', data: updated });
    } catch (error) {
        console.error('Помилка при оновленні статусу контейнера:', error);
        res.status(500).json({ message: 'Внутрішня помилка сервера' });
    }
});

// оновлення статусу прийому
router.patch('/update-intake', async (req, res) => {
    const { prescription_med_id, status } = req.body;

    if (typeof prescription_med_id !== 'number' || typeof status !== 'boolean') {
        return res.status(400).json({ message: 'prescription_med_id (number) and status (boolean) are required' });
    }

    try {
        const updated = await containerService.updateIntakeStatus(prescription_med_id, status);
        res.json(updated);
    } catch (error) {
        console.error('Update failed:', error);
        res.status(500).json({ message: 'Failed to update intake status' });
    }
});

// сповіщення про пропуск прийому
router.post('/send-missed-notification', async (req, res) => {
    const { container_id, prescription_med_id } = req.body;

    if (!container_id || !prescription_med_id) {
        return res.status(400).json({ message: 'Container ID and PrescriptionMed ID are required' });
    }

    try {
        await containerService.sendMissedNotification(container_id, prescription_med_id);
        res.status(200).json({ message: 'Notification created' });
    } catch (error) {
        console.error('Notification error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// сповіщення про відкриття контейнера
router.post('/send-open-notification', async (req, res) => {
    const { container_id, prescription_med_id } = req.body;

    if (!container_id || !prescription_med_id) {
        return res.status(400).json({ message: 'Container ID and PrescriptionMed ID are required' });
    }

    try {
        await containerService.sendOpenNotification(container_id, prescription_med_id);
        res.status(200).json({ message: 'Open notification sent' });
    } catch (error) {
        console.error('Open notification error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// очищення відсіку
router.post('/clear-compartment', async (req, res) => {
    const { compartment_id } = req.body;

    if (!compartment_id) {
        return res.status(400).json({ message: 'compartment_id is required' });
    }

    try {
        await containerService.clearCompartmentMedication(compartment_id);
        res.status(200).json({ message: 'Compartment cleared successfully' });
    } catch (error) {
        console.error('Clear error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

export const containerRouter = router;
