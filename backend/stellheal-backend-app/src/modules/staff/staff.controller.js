import { Router } from 'express';
import { StaffService } from './staff.service.js';

import { authenticateToken } from '../../middleware/auth.middleware.js';
import { authorizeRoles } from '../../middleware/role.middleware.js';
import { validateEmail } from '../../middleware/validation/validateEmail.js';
import { AppError } from '../../shared/errors/AppError.js';
import { ERROR_CODES } from '../../shared/constants/errorCodes.js';

const router = Router();
const staffService = new StaffService();

// get list of employees
router.get(
    '/',
    authenticateToken,
    authorizeRoles(4),
    async (req, res, next) => {
        try {
            res.json(await staffService.getAllMedicalStaff());
        } catch (err) {
            next(err);
        }
    }
);

// number of employees
router.get(
    '/count',
    authenticateToken,
    authorizeRoles(4),
    async (req, res, next) => {
        try {
            const count = await staffService.getStaffCount();
            res.json({ count });
        } catch (err) {
            next(err);
        }
    }
);

// add employee
router.post(
    '/',
    authenticateToken,
    authorizeRoles(4),
    validateEmail,
    async (req, res, next) => {
        try {
            const newStaff = await staffService.addStaff(req.body, req);
            res.status(201).json(newStaff);
        } catch (err) {
            next(err);
        }
    }
);

// update employee
router.put(
    '/:id',
    authenticateToken,
    authorizeRoles(4),
    validateEmail,
    async (req, res, next) => {
        try {
            res.json(await staffService.updateStaff(Number(req.params.id), req.body, req));
        } catch (err) {
            next(err);
        }
    }
);

// delete employee
router.delete(
    '/:id',
    authenticateToken,
    authorizeRoles(4),
    async (req, res, next) => {
        try {
            await staffService.deleteStaff(Number(req.params.id), req);
            res.status(204).end();
        } catch (err) {
            next(err);
        }
    }
);

// block account
router.patch(
    '/:id/block',
    authenticateToken,
    authorizeRoles(4),
    async (req, res, next) => {
        try {
            await staffService.blockStaff(Number(req.params.id), req);
            res.json({ message: 'Account blocked' });
        } catch (err) {
            next(err);
        }
    }
);

// unblock account
router.patch(
    '/:id/unblock',
    authenticateToken,
    authorizeRoles(4),
    async (req, res, next) => {
        try {
            await staffService.unblockStaff(Number(req.params.id), req);
            res.json({ message: 'Account unlocked' });
        } catch (err) {
            next(err);
        }
    }
);

// get user roles
router.get(
    '/roles',
    authenticateToken,
    authorizeRoles(4),
    async (req, res, next) => {
        try {
            res.json(await staffService.getRoles());
        } catch (err) {
            next(err);
        }
    }
);

// create role
router.post(
    '/roles',
    authenticateToken,
    authorizeRoles(4),
    async (req, res, next) => {
        try {
            const { role_name } = req.body;
            if (!role_name) {
                return next(new AppError(ERROR_CODES.VALIDATION_ERROR, 'role_name required', 400));
            }
            res.status(201).json(await staffService.createRole(role_name, req));
        } catch (err) {
            next(err);
        }
    }
);

// delete role
router.delete(
    '/roles/:id',
    authenticateToken,
    authorizeRoles(4),
    async (req, res, next) => {
        try {
            await staffService.deleteRole(Number(req.params.id), req);
            res.status(204).end();
        } catch (err) {
            next(err);
        }
    }
);

// update role
router.put(
    '/roles/:id',
    authenticateToken,
    authorizeRoles(4),
    async (req, res, next) => {
        try {
            const { role_name } = req.body;
            res.json(await staffService.updateRole(Number(req.params.id), role_name, req));
        } catch (err) {
            next(err);
        }
    }
);

// get report
router.get(
    '/export',
    authenticateToken,
    authorizeRoles(4),
    async (req, res, next) => {
        try {
            const buffer = await staffService.exportStaffToExcel(req);
            res.setHeader('Content-Disposition', 'attachment; filename="staff_export.xlsx"');
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.send(buffer);
        } catch (err) {
            next(err);
        }
    }
);

export const staffRouter = router;