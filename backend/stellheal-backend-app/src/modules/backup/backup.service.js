import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import dotenv from 'dotenv';
import * as os from 'node:os';

import { AppError } from '../../shared/errors/AppError.js';
import { ERROR_CODES } from '../../shared/constants/errorCodes.js';
import { logAction } from '../../shared/logger/auditLogger.js';
import { ACTIONS } from '../../shared/constants/actions.js';

dotenv.config();

export class BackupService {

    // last backup ok
    async getLastBackup() {
        const logFile = path.join('backups', 'last-backup.txt');

        if (fs.existsSync(logFile)) {
            return fs.readFileSync(logFile, 'utf-8');
        }

        return null;
    }

    // create backup (not ok)
    async createBackup(type = 'manual', req) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

        const dbFile = `backups/db-${timestamp}.dump`;

        const command = `pg_dump -Fc --dbname="${process.env.DATABASE_URL}" -f "${dbFile}"`;

        await execPromise(command);

        // копіюємо uploads
        const uploadsBackup = `backups/uploads-${timestamp}`;
        fs.cpSync('uploads', uploadsBackup, { recursive: true });

        await logAction({
            userId: req?.user?.userId,
            action: ACTIONS.SECURITY_EVENT,
            entity: 'BACKUP',
            description: `Backup created (${type})`,
            req
        });

        return { timestamp };
    }
}