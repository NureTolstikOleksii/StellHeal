import { Router } from 'express';
import { StaffService } from './staff.service.js';
import { authenticateToken } from '../../middleware/auth.middleware.js';
import {validateEmail} from "../../middleware/validation/validateEmail.js";

const router = Router();
const staffService = new StaffService();

// отримати список працівників
router.get('/', authenticateToken, async (req, res) => {
    try {
        const staffList = await staffService.getAllMedicalStaff(req.db);
        res.json(staffList);
    } catch (err) {
        console.error('Error fetching staff:', err);
        res.status(500).json({ message: 'Помилка при отриманні персоналу' });
    }
});

// додати мед. працівника
router.post('/', authenticateToken, validateEmail, async (req, res) => {
    try {
        const newStaff = await staffService.addStaff(req.db, req.body);
        res.status(201).json(newStaff);
    } catch (error) {
        console.error('Помилка при додаванні працівника:', error);
        res.status(error.statusCode || 500).json({
            message: error.message || 'Не вдалося створити працівника',
        });
    }
});

// отримати кількість працівників
router.get('/count', authenticateToken, async (req, res) => {
    try {
        const count = await staffService.getStaffCount(req.db);
        res.json({ count });
    } catch (error) {
        console.error('Помилка при підрахунку працівників:', error);
        res.status(500).json({ message: 'Помилка при отриманні кількості працівників' });
    }
});

// отримати всі ролі користувачів
router.get('/roles', authenticateToken, async (req, res) => {
    const roles = await req.db.roles.findMany();
    res.json(roles);
});

// додати роль користувача
router.post('/roles', authenticateToken, async (req, res) => {
    const { role_name } = req.body;
    const newRole = await req.db.roles.create({ data: { role_name } });
    res.status(201).json(newRole);
});

// видалити роль користувача
router.delete('/roles/:id', authenticateToken, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    await req.db.roles.delete({ where: { role_id: id } });
    res.status(204).end();
});

// редагувати роль користувача
router.put('/roles/:id', authenticateToken, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { role_name } = req.body;

    try {
        const updated = await req.db.roles.update({
            where: { role_id: id },
            data: { role_name }
        });
        res.json(updated);
    } catch (err) {
        console.error('Помилка при редагуванні ролі:', err);
        res.status(500).json({ message: 'Не вдалося оновити роль' });
    }
});

// редагувати працівника
router.put('/:id', authenticateToken, validateEmail, async (req, res) => {
    try {
        const updated = await staffService.updateStaff(req.db, parseInt(req.params.id), req.body);
        res.json(updated);
    } catch (err) {
        res.status(500).json({ message: 'Не вдалося оновити працівника', error: err.message });
    }
});

// видалити працівника
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        await staffService.deleteStaff(req.db, id);
        res.status(204).send();
    } catch (err) {
        console.error('Помилка при видаленні працівника:', err);
        res.status(500).json({ message: 'Помилка при видаленні працівника' });
    }
});

// експортувати в Excel
router.get('/export', authenticateToken, async (req, res) => {
    try {
        const workbookBuffer = await staffService.exportStaffToExcel(req.db);

        res.setHeader('Content-Disposition', 'attachment; filename="staff_export.xlsx"');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(workbookBuffer);
    } catch (err) {
        console.error('Помилка при експорті працівників:', err);
        res.status(500).json({ message: 'Помилка при експорті працівників' });
    }
});

export const staffRouter = router;
