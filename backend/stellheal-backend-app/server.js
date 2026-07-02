import 'dotenv/config';
import dotenv from 'dotenv';
import prisma from './src/config/prisma.js';
import { createApp } from './src/app.js';
import { BackupService } from './src/modules/backup/backup.service.js';

dotenv.config();

if (!process.env.DATABASE_URL) {
    console.error('Критична помилка: DATABASE_URL не визначено');
    process.exit(1);
}

const PORT = process.env.PORT || 4200;

async function main() {
    const app = createApp();
    try {
        await prisma.$connect();
        console.log('Database connected');
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`Server running on port ${PORT}`);
        });
        const backupService = new BackupService();
        backupService.startScheduler();
    } catch (err) {
        console.error('Failed to connect to DB:', err);
        await prisma.$disconnect();

        process.exit(1);
    }
}

main();

process.on('SIGINT', async () => { await prisma.$disconnect(); process.exit(0); });
process.on('SIGTERM', async () => { await prisma.$disconnect(); process.exit(0); });