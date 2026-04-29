import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
import streamifier from 'streamifier';
import { AppError } from '../../shared/errors/AppError.js';
import { ERROR_CODES } from '../../shared/constants/errorCodes.js';

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const upload = multer();

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

    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { folder: 'stellheal/avatars' },
            (error, result) => {
                if (result) resolve(result.secure_url);
                else reject(error);
            }
        );

        streamifier.createReadStream(req.file.buffer).pipe(stream);
    });
};