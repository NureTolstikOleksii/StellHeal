import { Router } from 'express';
import { ProfileService } from './profile.service.js';
import { authenticateToken } from '../../middleware/auth.middleware.js';
import { validatePasswordStrength } from '../../middleware/validation/validatePasswordStrength.js';
import { validateEmail } from '../../middleware/validation/validateEmail.js';
import { uploadAvatar } from '../../integrations/cloudinary/uploadAvatar.js';

const router = Router();
const profileService = new ProfileService();

// GET PROFILE (ok)
router.get('/', authenticateToken, async (req, res, next) => {
    try {
        const user = await profileService.getProfile(req.user.userId, req);
        res.json(user);
    } catch (err) {
        next(err);
    }
});

// UPDATE AVATAR ok
router.put('/avatar', authenticateToken, async (req, res, next) => {
    try {
        const avatarUrl = await uploadAvatar(req);
        const user = await profileService.updateAvatar(req.user.userId, avatarUrl, req);

        res.json({ avatar: user.avatar });

    } catch (err) {
        next(err);
    }
});

// CHANGE PASSWORD ok
router.put(
    '/change-password',
    authenticateToken,
    validatePasswordStrength,
    async (req, res, next) => {
        try {
            const { currentPassword, newPassword } = req.body;

            await profileService.changePassword(
                req.user.userId,
                currentPassword,
                newPassword,
                req
            );

            res.json({ message: 'Password updated successfully' });

        } catch (err) {
            next(err);
        }
    }
);

// UPDATE PROFILE
router.patch('/', authenticateToken, validateEmail, async (req, res, next) => {
    try {
        const updatedUser = await profileService.updateProfile(
            req.user.userId,
            req.body,
            req
        );

        res.json(updatedUser);

    } catch (err) {
        next(err);
    }
});

export default router;