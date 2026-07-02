import zlib from 'zlib';
import { promisify } from 'util';
import dotenv from 'dotenv';
import cron from 'node-cron';

import { BlobServiceClient } from '@azure/storage-blob';
import prisma from '../../config/prisma.js';
import { logAction } from '../../shared/logger/auditLogger.js';
import { ACTIONS } from '../../shared/constants/actions.js';
import { AppError } from '../../shared/errors/AppError.js';
import { ERROR_CODES } from '../../shared/constants/errorCodes.js';

dotenv.config();

const gzip   = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

const BACKUP_CONTAINER   = 'backups';
const MAX_MANUAL_BACKUPS = 10;
const MAX_AUTO_BACKUPS   = 7;

const TABLE_ORDER = [
    'roles',
    'users',
    'medical_staff',
    'wards',
    'prescriptions',
    'prescription_files',
    'medications',
    'prescription_medications',
    'containers',
    'compartments',
    'compartment_medications',
    'fill_sessions',
    'device_commands',
    'device_events',
    'notifications',
    'notification_recipients',
    'password_reset_tokens',
    'refresh_tokens',
    'audit_logs',
];

function getContainer() {
    const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING;
    if (!connStr) throw new Error('AZURE_STORAGE_CONNECTION_STRING не задано');
    return BlobServiceClient
        .fromConnectionString(connStr)
        .getContainerClient(BACKUP_CONTAINER);
}

export class BackupService {

    // Запуск автоматичних бекапів (при старті сервера)
    startScheduler() {
        // щодня о 02:00 ночі
        cron.schedule('0 2 * * *', async () => {
            console.log('[Backup] Starting scheduled backup...');
            try {
                await this.createBackup('auto', null);
                console.log('[Backup] Scheduled backup completed');
            } catch (err) {
                console.error('[Backup] Scheduled backup failed:', err.message);
            }
        });

        console.log('[Backup] Scheduler started — daily at 02:00');
    }

    async listBackups() {
        const container = getContainer();
        const backups   = [];

        for await (const blob of container.listBlobsFlat({ includeMetadata: true })) {
            backups.push({
                name:         blob.name,
                lastModified: blob.properties.lastModified,
                size:         blob.properties.contentLength,
                type:         blob.metadata?.type || 'manual',
            });
        }

        return backups.sort((a, b) =>
            new Date(b.lastModified) - new Date(a.lastModified)
        );
    }

    async getLastBackup() {
        const backups = await this.listBackups();
        return backups[0] || null;
    }

    async createBackup(type = 'manual', req) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName  = `${type}-backup-${timestamp}.json.gz`;

        // 1. Читаємо всі таблиці через Prisma
        const data = {};
        const meta = { created_at: new Date().toISOString(), type, tables: {} };

        for (const table of TABLE_ORDER) {
            try {
                const rows     = await prisma[table].findMany();
                data[table]    = rows;
                meta.tables[table] = rows.length;
            } catch {
                data[table]    = [];
                meta.tables[table] = 0;
            }
        }

        data._meta = meta;

        // 2. Стискаємо gzip
        const compressed = await gzip(
            Buffer.from(JSON.stringify(data), 'utf-8')
        );

        // 3. Завантажуємо в Azure Blob
        const container = getContainer();
        const blockBlob = container.getBlockBlobClient(fileName);

        await blockBlob.uploadData(compressed, {
            blobHTTPHeaders: { blobContentType: 'application/gzip' },
            metadata: {
                type,
                created_by:  String(req?.user?.userId || 'system'),
                table_count: String(TABLE_ORDER.length),
            }
        });

        await this._rotateBackups(type);

        if (req?.user?.userId) {
            await logAction({
                userId:      req.user.userId,
                action:      ACTIONS.SECURITY_EVENT,
                entity:      'BACKUP',
                description: `Backup created (${type}): ${fileName}`,
                req
            });
        }

        return { name: fileName, timestamp: new Date().toISOString(), type };
    }

    async restoreBackup(blobName, req) {
        const container = getContainer();
        const blockBlob = container.getBlockBlobClient(blobName);

        const exists = await blockBlob.exists();
        if (!exists) {
            throw new AppError(ERROR_CODES.NOT_FOUND, 'Бекап не знайдено', 404);
        }

        // 1. Завантажуємо і розпаковуємо
        const response = await blockBlob.download(0);
        const chunks   = [];
        for await (const chunk of response.readableStreamBody) {
            chunks.push(chunk);
        }
        const json = (await gunzip(Buffer.concat(chunks))).toString('utf-8');
        const data = JSON.parse(json);
        delete data._meta;

        // 2. Відновлюємо в транзакції
        const reverseOrder = [...TABLE_ORDER].reverse();

        await prisma.$transaction(async (tx) => {
            for (const table of reverseOrder) {
                try { await tx[table].deleteMany(); } catch { }
            }
            for (const table of TABLE_ORDER) {
                const rows = data[table];
                if (!rows?.length) continue;
                try {
                    await tx[table].createMany({ data: rows, skipDuplicates: true });
                } catch (err) {
                    console.error(`Restore error [${table}]:`, err.message);
                }
            }
        }, { timeout: 120_000 });

        await logAction({
            userId:      req?.user?.userId,
            action:      ACTIONS.SECURITY_EVENT,
            entity:      'BACKUP',
            description: `Database restored from: ${blobName}`,
            req
        });

        return { message: 'Відновлення успішно завершено', name: blobName };
    }

    async deleteBackup(blobName, req) {
        const container = getContainer();
        const blockBlob = container.getBlockBlobClient(blobName);

        const exists = await blockBlob.exists();
        if (!exists) {
            throw new AppError(ERROR_CODES.NOT_FOUND, 'Бекап не знайдено', 404);
        }

        await blockBlob.delete();

        await logAction({
            userId:      req?.user?.userId,
            action:      ACTIONS.SECURITY_EVENT,
            entity:      'BACKUP',
            description: `Backup deleted: ${blobName}`,
            req
        });
    }

    async _rotateBackups(type) {
        const maxKeep = type === 'auto' ? MAX_AUTO_BACKUPS : MAX_MANUAL_BACKUPS;
        const all     = await this.listBackups();
        const ofType  = all.filter(b => b.type === type);

        if (ofType.length <= maxKeep) return;

        const toDelete = ofType.slice(maxKeep);
        const container = getContainer();

        for (const b of toDelete) {
            try {
                await container.getBlockBlobClient(b.name).delete();
                console.log(`[Backup] Rotated old backup: ${b.name}`);
            } catch (err) {
                console.error(`[Backup] Failed to rotate ${b.name}:`, err.message);
            }
        }
    }
}