import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import dotenv from 'dotenv';
import * as os from "node:os";

dotenv.config();

export class BackupService {
     // отриманння останнього бекапу
    async getLastBackup() {
        const logFile = path.join('backups', 'last-backup.txt');
        if (fs.existsSync(logFile)) {
            const timestamp = fs.readFileSync(logFile, 'utf-8');
            return timestamp;
        }
        return null;
    }

    // створення бекапу
    async createBackup(type = 'manual') {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupDir = path.join('backups');
        if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir);

        const dbFile = path.join(backupDir, `backup-${timestamp}.sql`);
        const envFile = path.join(backupDir, `env-backup-${timestamp}.env`);

        const dbUrl = process.env.DATABASE_URL;
        const isWindows = os.platform() === 'win32';
        const pgDumpPath = isWindows
            ? `"C:\\Program Files\\PostgreSQL\\17\\bin\\pg_dump.exe"`
            : 'pg_dump';

        const dbDumpCommand = `${pgDumpPath} --dbname="${dbUrl}" -f "${dbFile}"`;

        // 1. Створити SQL dump
        await new Promise((resolve, reject) => {
            exec(dbDumpCommand, (error, stdout, stderr) => {
                if (error) {
                    console.error('Помилка при створенні дампу БД:', error);
                    return reject(error);
                }
                resolve();
            });
        });

        // 2. Копіювати .env
        const sourceEnv = path.resolve('.env');
        if (fs.existsSync(sourceEnv)) {
            fs.copyFileSync(sourceEnv, envFile);
        }

        // 3. Записати лог останнього резервного копіювання
        const logFile = path.join(backupDir, 'last-backup.txt');
        fs.writeFileSync(logFile, new Date().toISOString());

        return { timestamp: new Date().toISOString(), type };
    }
}
