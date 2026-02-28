import { Router } from 'express';

const router = Router();

router.get('/', async (req, res) => {
    try {
        const wards = await req.db.wards.findMany({
            select: {
                ward_id: true,
                ward_number: true,
                capacity: true,
                prescriptions: {
                    where: {
                        end_date: {
                            gte: new Date()
                        }
                    },
                    select: {
                        prescription_id: true
                    }
                }
            }
        });

        const freeWards = wards.filter(w => w.prescriptions.length < (w.capacity || 0));

        res.json(freeWards.map(w => ({
            id: w.ward_id,
            number: w.ward_number
        })));
    } catch (err) {
        console.error('Помилка при отриманні палат:', err);
        res.status(500).json({ message: 'Не вдалося завантажити палати' });
    }
});

export default router;
