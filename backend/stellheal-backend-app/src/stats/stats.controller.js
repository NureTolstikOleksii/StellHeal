import { Router } from 'express';
import { StatsService } from './stats.service.js';

const router = Router();
const statsService = new StatsService();

// отримання статистики лікарні
router.get('/clinic', async (req, res) => {
    try {
        const data = await statsService.getClinicStats();
        res.json(data);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Помилка при отриманні статистики закладу' });
    }
});

// отримання статистики лікарів
router.get('/doctors', async (req, res) => {
    try {
        const data = await statsService.getDoctorStats();
        res.json(data);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Помилка при отриманні статистики по лікарях' });
    }
});

export const statsRouter = router;
