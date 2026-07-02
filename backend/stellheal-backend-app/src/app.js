import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { globalLimiter } from './middleware/rateLimiter.js';
import { errorHandler } from './middleware/errorHandler.js';
import mainRouter from './routes/index.js';

export function createApp() {
    const app = express();

    app.set('trust proxy', 1);
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    app.use(cookieParser());
    app.use(globalLimiter);
    app.use(cors({ origin: '*', credentials: true }));

    app.get('/', (req, res) => {
        res.send('StellHeal API is running...');
    });

    app.use('/api', mainRouter);
    app.all('*', (req, res) => {
        res.status(404).json({ code: 'NOT_FOUND', message: 'Route not found' });
    });
    app.use(errorHandler);

    return app;
}