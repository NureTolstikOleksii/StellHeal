import { Router } from 'express';
import { WardsService } from './wards.service.js';

import { authenticateToken } from '../../middleware/auth.middleware.js';
import { authorizeRoles } from '../../middleware/role.middleware.js';
import { AppError } from '../../shared/errors/AppError.js';
import { ERROR_CODES } from '../../shared/constants/errorCodes.js';

const router = Router();
const wardsService = new WardsService();

// all wards (admin)
router.get('/all', authenticateToken, authorizeRoles(4), async (req, res, next) => {
    try {
        res.json(await wardsService.getAllWards());
    } catch (err) { next(err); }
});

// free wards without blocked ones (doctor/nurse)
router.get('/', authenticateToken, authorizeRoles(1, 2), async (req, res, next) => {
    try {
        res.json(await wardsService.getAvailableWards());
    } catch (err) { next(err); }
});

// card patients
router.get('/:id/patients', authenticateToken, authorizeRoles(4), async (req, res, next) => {
    try {
        const wardId = Number(req.params.id);
        if (!wardId) return next(new AppError(ERROR_CODES.VALIDATION_ERROR, 'wardId required', 400));
        res.json(await wardsService.getWardPatients(wardId));
    } catch (err) { next(err); }
});

// create a ward
router.post('/', authenticateToken, authorizeRoles(4), async (req, res, next) => {
    try {
        if (!req.body.ward_number?.trim()) {
            return next(new AppError(ERROR_CODES.VALIDATION_ERROR, 'ward_number is required', 400));
        }
        res.status(201).json(await wardsService.createWard(req.body, req));
    } catch (err) { next(err); }
});

// update the chamber
router.put('/:id', authenticateToken, authorizeRoles(4), async (req, res, next) => {
    try {
        const wardId = Number(req.params.id);
        if (!wardId) return next(new AppError(ERROR_CODES.VALIDATION_ERROR, 'wardId required', 400));
        res.json(await wardsService.updateWard(wardId, req.body, req));
    } catch (err) { next(err); }
});

// lock the chamber
router.patch('/:id/block', authenticateToken, authorizeRoles(4), async (req, res, next) => {
    try {
        const wardId = Number(req.params.id);
        if (!wardId) return next(new AppError(ERROR_CODES.VALIDATION_ERROR, 'wardId required', 400));
        res.json(await wardsService.blockWard(wardId, req));
    } catch (err) { next(err); }
});

// unlock the chamber
router.patch('/:id/unblock', authenticateToken, authorizeRoles(4), async (req, res, next) => {
    try {
        const wardId = Number(req.params.id);
        if (!wardId) return next(new AppError(ERROR_CODES.VALIDATION_ERROR, 'wardId required', 400));
        res.json(await wardsService.unblockWard(wardId, req));
    } catch (err) { next(err); }
});

// delete the ward
router.delete('/:id', authenticateToken, authorizeRoles(4), async (req, res, next) => {
    try {
        const wardId = Number(req.params.id);
        if (!wardId) return next(new AppError(ERROR_CODES.VALIDATION_ERROR, 'wardId required', 400));
        await wardsService.deleteWard(wardId, req);
        res.status(204).end();
    } catch (err) { next(err); }
});

export default router;