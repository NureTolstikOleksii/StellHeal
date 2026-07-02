import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { join } from 'path';

let serviceAccount;

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} else {
    const serviceAccountPath = join(process.cwd(), 'secrets/firebase-service-account.json');
    serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
}

try {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
} catch (error) {
    console.error('Error loading Firebase Service Account: ', error.message);
}

export default admin;