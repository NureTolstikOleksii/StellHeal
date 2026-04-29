import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { join } from 'path';

// Шлях до файлу (на Render він буде в корені проєкту)
const serviceAccountPath = join(process.cwd(), 'firebase-service-account.json');

try {
    const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
} catch (error) {
    console.error('Помилка завантаження Firebase Service Account:', error.message);
}

export default admin;