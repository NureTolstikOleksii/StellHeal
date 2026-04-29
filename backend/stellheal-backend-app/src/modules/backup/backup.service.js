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

    // останній backup
    async getLastBackup() {
        const logFile = path.join('backups', 'last-backup.txt');

        if (fs.existsSync(logFile)) {
            return fs.readFileSync(logFile, 'utf-8');
        }

        return null;
    }

    // створення backup
    async createBackup(type = 'manual', req) {

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupDir = path.join('backups');

        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir);
        }

        const dbFile = path.join(backupDir, `backup-${timestamp}.sql`);

        const dbUrl = process.env.DATABASE_URL;

        if (!dbUrl) {
            throw new AppError(
                ERROR_CODES.INTERNAL_ERROR,
                'DATABASE_URL not configured',
                500
            );
        }

        const isWindows = os.platform() === 'win32';

        const pgDumpPath = isWindows
            ? `"C:\\Program Files\\PostgreSQL\\17\\bin\\pg_dump.exe"`
            : 'pg_dump';

        const command = `${pgDumpPath} --dbname="${dbUrl}" -f "${dbFile}"`;

        // створення dump
        await new Promise((resolve, reject) => {
            exec(command, (error) => {
                if (error) {
                    return reject(new AppError(
                        ERROR_CODES.INTERNAL_ERROR,
                        'Failed to create DB dump',
                        500
                    ));
                }
                resolve();
            });
        });

        // ❌ ВАЖЛИВО: НЕ копіюємо .env
        // (залишаємо як рекомендацію)

        const logFile = path.join(backupDir, 'last-backup.txt');
        fs.writeFileSync(logFile, new Date().toISOString());

        // audit log
        await logAction({
            userId: req?.user?.userId,
            action: ACTIONS.SECURITY_EVENT,
            entity: 'BACKUP',
            entityId: null,
            description: `Backup created (${type})`,
            req
        });

        return {
            timestamp: new Date().toISOString(),
            type
        };
    }
}