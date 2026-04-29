import { Router } from 'express';
import { ProfileService } from './profile.service.js';
import { authenticateToken } from '../../middleware/auth.middleware.js';
import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
import streamifier from 'streamifier';
import {validatePasswordStrength} from "../../middleware/validation/validatePasswordStrength.js";
import {validateEmail} from "../../middleware/validation/validateEmail.js";

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const router = Router();
const profileService = new ProfileService();
const upload = multer();

// отримання профілю
router.get('/', authenticateToken, async (req, res) => {
    try {
        const user = await profileService.getProfile(req.db, req.user.userId);
        res.json(user);
    } catch (err) {
        res.status(500).json({ message: 'Failed to get profile', error: err.message });
    }
});

// зміна аватара
router.put('/avatar', authenticateToken, upload.single('avatar'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const streamUpload = (reqFileBuffer) => {
            return new Promise((resolve, reject) => {
                const stream = cloudinary.uploader.upload_stream(
                    { folder: 'healthyhelper/avatars' },
                    (error, result) => {
                        if (result) resolve(result);
                        else reject(error);
                    }
                );
                streamifier.createReadStream(reqFileBuffer).pipe(stream);
            });
        };

        const uploadResult = await streamUpload(req.file.buffer);

        await req.db.users.update({
            where: { user_id: req.user.userId },
            data: { avatar: uploadResult.secure_url }
        });

        res.json({ avatar: uploadResult.secure_url });

    } catch (error) {
        console.error('Ошибка загрузки в Cloudinary:', error);
        res.status(500).json({ message: 'Upload failed', error: error.message });
    }
});

// зміна пароля
router.put('/change-password', authenticateToken, validatePasswordStrength, async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    try {
        await profileService.changePassword(req.db, req.user.userId, currentPassword, newPassword);
        res.json({ message: 'Пароль успішно змінено' });
    } catch (err) {
        const errorMessage = err.message || 'Внутрішня помилка сервера';
        const statusCode = err.statusCode || 500;
        res.status(statusCode).json({ message: errorMessage });
    }
});

// зміна профіля користувача
router.patch('/', authenticateToken, validateEmail, async (req, res) => {
    const userId = req.user.userId;
    const { first_name, last_name, patronymic, phone, login, contact_info } = req.body;

    try {
        const updatedUser = await profileService.updateProfile(
            req.db,
            userId,
            { first_name, last_name, patronymic, phone, login, contact_info }
        );
        res.json(updatedUser);
    } catch (err) {
        console.error('Помилка при оновленні профілю:', err);
        res.status(500).json({ message: 'Не вдалося оновити профіль', error: err.message });
    }
});

export const profileRouter = router;
