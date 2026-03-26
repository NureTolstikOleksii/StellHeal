import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import { PrismaClient } from '@prisma/client';
import { registerRouter } from './src/registration/registration.controller.js';
import { loginRouter } from './src/login/login.controller.js';
import { profileRouter } from './src/profile/profile.controller.js';
import { medicationRouter } from './src/medication/medication.controller.js';
import { mainRouter } from './src/patients/patients.controller.js';
import { containerRouter } from './src/container/container.controller.js';
import { notificationRouter } from './src/notifications/notifications.controller.js';
import wardsRouter from './src/wards/wards.controller.js';
import { staffRouter } from "./src/staff/staff.controller.js";
import {statsRouter} from "./src/stats/stats.controller.js";
import {backupRouter} from "./src/backup/backup.controller.js";

dotenv.config();

const prisma = new PrismaClient();
const app = express();

async function main() {
    app.use(express.json());

    app.use(express.urlencoded({ extended: true }));

    app.use((req, res, next) => {
        req.db = prisma;
        next();
    });

    app.use(cors({
        origin: '*',
        credentials: true,
    }));

    app.use(cookieParser());

    app.get('/', (req, res) => {
        res.send('Hello from back!');
    });

    app.use(session({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: true,
        cookie: {
            secure: false,
            maxAge: 60 * 60 * 1000
        }
    }));

    //Маршрути
    app.use('/register', registerRouter);
    
    app.use('/login', loginRouter);

    app.use('/medication', medicationRouter);

    app.use('/patients', mainRouter);

    app.use('/wards', wardsRouter);

    app.use('/containers', containerRouter);

    app.use('/profile', profileRouter);

    app.use('/notification', notificationRouter);

    app.use('/staff', staffRouter);

    app.use('/stats', statsRouter);

    app.use('/backup', backupRouter);

    app.all('*', (req, res) => {
        res.status(404).json({ message: 'Not Found' });
    });

    app.use((err, req, res, next) => {
        console.error(err.stack);
        res.status(500).send('Oops, something happened...');
    });

    app.listen(process.env.PORT || 4200, '0.0.0.0', () => {
        console.log(`Server is running on port ${process.env.PORT || 4200}`);
    });
}

main().catch((err) => {
    console.error(err);
    prisma.$disconnect();
});
