import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import { globalLimiter } from './src/middleware/rateLimiter.js';
import { errorHandler } from './src/middleware/errorHandler.js';
import prisma from './src/config/prisma.js';
import mainRouter from './src/routes/index.js';

dotenv.config();

if (!process.env.DATABASE_URL) {
    console.error('Критична помилка: DATABASE_URL не визначено');
    process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 4200;

async function main() {
    app.set('trust proxy', 1);
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(cookieParser());
    app.use(globalLimiter);

    app.use(cors({
        origin: '*',
        credentials: true,
    }));

    app.get('/', (req, res) => {
        res.send('StellHeal API is running...');
    });

    app.use('/api', mainRouter);

    app.all('*', (req, res) => {
        res.status(404).json({
            code: 'NOT_FOUND',
            message: 'Route not found'
        });
    });

    app.use(errorHandler);

    try {
        await prisma.$connect();
        console.log('Database connected');

        app.listen(PORT, '0.0.0.0', () => {
            console.log(`Server running on port ${PORT}`);
        });
    } catch (err) {
        console.error('Failed to connect to DB:', err);
        await prisma.$disconnect();
        process.exit(1);
    }
}

main();

const gracefulShutdown = async () => {
    console.log('Shutting down gracefully...');
    await prisma.$disconnect();
    process.exit(0);
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);