import { Router } from 'express';
import { BackupService } from './backup.service.js';

const router = Router();
const backupService = new BackupService();

// отримати дату останнього бекапу
router.get('/last', async (req, res) => {
    try {
        const last = await backupService.getLastBackup();
        if (!last) return res.json({ lastBackup: null });
        return res.json({ lastBackup: last });
    } catch (err) {
        console.error('Помилка при отриманні останнього бекапу:', err);
        res.status(500).json({ error: 'Серверна помилка' });
    }
});

// створити ручний бекап
router.post('/manual', async (req, res) => {
    try {
        const backup = await backupService.createBackup('manual');
        res.json({
            message: 'Резервна копія створена успішно',
            timestamp: backup.timestamp
        });
    } catch (err) {
        console.error('Помилка при створенні бекапу:', err);
        res.status(500).json({ error: 'Не вдалося створити копію' });
    }
});

export const backupRouter = router;
