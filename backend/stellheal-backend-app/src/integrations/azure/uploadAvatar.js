import multer from 'multer';
import { uploadAvatarToAzure } from './azure.storage.js';
import { AppError } from '../../shared/errors/AppError.js';
import { ERROR_CODES } from '../../shared/constants/errorCodes.js';

const upload = multer({ storage: multer.memoryStorage() });

export const uploadAvatar = async (req) => {
    await new Promise((resolve, reject) => {
        upload.single('avatar')(req, {}, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });

    if (!req.file) {
        throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'No file uploaded', 400);
    }

    return uploadAvatarToAzure(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
        req.user?.userId
    );
};