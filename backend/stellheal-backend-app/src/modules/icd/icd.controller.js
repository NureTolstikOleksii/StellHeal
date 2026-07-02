import { Router } from 'express';
import { searchICD } from './icd.service.js';
import { authenticateToken } from '../../middleware/auth.middleware.js';

const router = Router();

router.get('/search', authenticateToken, async (req, res, next) => {
    try {
        const { q } = req.query;
        if (!q || q.length < 2) return res.json([]);
        const results = await searchICD(q);
        res.json(results);
    } catch (err) {
        next(err);
    }
});

export const icdRouter = router;