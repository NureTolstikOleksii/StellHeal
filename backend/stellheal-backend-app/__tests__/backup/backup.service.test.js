import { describe, it, expect, vi, beforeEach } from 'vitest';

const { viPrismaMock, mockBlobClient, mockContainerClient } = vi.hoisted(() => {
    const mockBlobClient = {
        exists:     vi.fn(),
        uploadData: vi.fn(),
        download:   vi.fn(),
        delete:     vi.fn(),
    };

    const mockContainerClient = {
        getBlockBlobClient: vi.fn().mockReturnValue(mockBlobClient),
        listBlobsFlat:      vi.fn(),
    };

    const viPrismaMock = {
        roles:                    { findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn() },
        users:                    { findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn() },
        medical_staff:            { findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn() },
        wards:                    { findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn() },
        prescriptions:            { findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn() },
        prescription_files:       { findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn() },
        medications:              { findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn() },
        prescription_medications: { findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn() },
        containers:               { findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn() },
        compartments:             { findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn() },
        compartment_medications:  { findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn() },
        fill_sessions:            { findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn() },
        device_commands:          { findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn() },
        device_events:            { findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn() },
        notifications:            { findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn() },
        notification_recipients:  { findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn() },
        password_reset_tokens:    { findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn() },
        refresh_tokens:           { findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn() },
        audit_logs:               { findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn() },
        $transaction: vi.fn(),
    };

    return { viPrismaMock, mockBlobClient, mockContainerClient };
});

vi.mock('../../src/config/prisma.js',              () => ({ default: viPrismaMock }));
vi.mock('../../src/shared/logger/auditLogger.js',  () => ({ logAction: vi.fn() }));
vi.mock('../../src/shared/constants/actions.js',   () => ({ ACTIONS: { SECURITY_EVENT: 'SECURITY_EVENT' } }));
vi.mock('node-cron',                               () => ({ default: { schedule: vi.fn() } }));
vi.mock('../../src/shared/errors/AppError.js', () => ({
    AppError: class AppError extends Error {
        constructor(code, message, status) { super(message); this.code = code; this.status = status; }
    }
}));
vi.mock('../../src/shared/constants/errorCodes.js', () => ({
    ERROR_CODES: { NOT_FOUND: 'NOT_FOUND' }
}));
vi.mock('@azure/storage-blob', () => ({
    BlobServiceClient: {
        fromConnectionString: vi.fn().mockReturnValue({
            getContainerClient: vi.fn().mockReturnValue(mockContainerClient)
        })
    }
}));

process.env.AZURE_STORAGE_CONNECTION_STRING = 'DefaultEndpointsProtocol=https;AccountName=test;AccountKey=dGVzdA==;EndpointSuffix=core.windows.net';

import { BackupService } from '../../src/modules/backup/backup.service.js';

const makeReq = () => ({ user: { userId: 1 }, headers: {}, ip: '127.0.0.1' });

const makeBlob = (name, type = 'manual', daysAgo = 0) => ({
    name,
    properties: {
        lastModified:  new Date(Date.now() - daysAgo * 86400000),
        contentLength: 1024,
    },
    metadata: { type },
});

async function* makeBlobList(blobs) {
    for (const b of blobs) yield b;
}

let service;
beforeEach(() => {
    vi.clearAllMocks();
    service = new BackupService();
    mockBlobClient.uploadData.mockResolvedValue({});
    mockBlobClient.delete.mockResolvedValue({});
});


describe('startScheduler', () => {

    it('registers daily cron job at 02:00', async () => {
        const cron = await import('node-cron');
        service.startScheduler();
        expect(cron.default.schedule).toHaveBeenCalledWith(
            '0 2 * * *',
            expect.any(Function)
        );
    });
});

describe('listBackups', () => {

    it('returns empty array when no backups exist', async () => {
        mockContainerClient.listBlobsFlat.mockReturnValue(makeBlobList([]));
        const result = await service.listBackups();
        expect(result).toEqual([]);
    });

    it('returns backups sorted by lastModified descending', async () => {
        mockContainerClient.listBlobsFlat.mockReturnValue(makeBlobList([
            makeBlob('old-backup.json.gz',  'manual', 3),
            makeBlob('new-backup.json.gz',  'manual', 0),
            makeBlob('mid-backup.json.gz',  'auto',   1),
        ]));

        const result = await service.listBackups();
        expect(result[0].name).toBe('new-backup.json.gz');
        expect(result[result.length - 1].name).toBe('old-backup.json.gz');
    });

    it('returns correct shape for each backup', async () => {
        mockContainerClient.listBlobsFlat.mockReturnValue(makeBlobList([
            makeBlob('backup.json.gz', 'auto', 0),
        ]));

        const result = await service.listBackups();
        expect(result[0]).toMatchObject({
            name: 'backup.json.gz',
            type: 'auto',
            size: 1024,
        });
        expect(result[0].lastModified).toBeInstanceOf(Date);
    });

    it('defaults type to "manual" when metadata missing', async () => {
        mockContainerClient.listBlobsFlat.mockReturnValue(makeBlobList([{
            name: 'backup.json.gz',
            properties: { lastModified: new Date(), contentLength: 512 },
            metadata: {},
        }]));

        const result = await service.listBackups();
        expect(result[0].type).toBe('manual');
    });
});

describe('getLastBackup', () => {

    it('returns null when no backups exist', async () => {
        mockContainerClient.listBlobsFlat.mockReturnValue(makeBlobList([]));
        expect(await service.getLastBackup()).toBeNull();
    });

    it('returns most recent backup', async () => {
        mockContainerClient.listBlobsFlat.mockReturnValue(makeBlobList([
            makeBlob('old.json.gz', 'manual', 5),
            makeBlob('new.json.gz', 'manual', 0),
        ]));

        const result = await service.getLastBackup();
        expect(result.name).toBe('new.json.gz');
    });
});

describe('createBackup', () => {

    beforeEach(() => {
        mockContainerClient.listBlobsFlat.mockReturnValue(makeBlobList([]));
    });

    it('reads all tables from prisma', async () => {
        await service.createBackup('manual', makeReq());
        expect(viPrismaMock.roles.findMany).toHaveBeenCalledOnce();
        expect(viPrismaMock.users.findMany).toHaveBeenCalledOnce();
        expect(viPrismaMock.audit_logs.findMany).toHaveBeenCalledOnce();
    });

    it('uploads compressed data to azure blob', async () => {
        await service.createBackup('manual', makeReq());
        expect(mockBlobClient.uploadData).toHaveBeenCalledOnce();
        const [data, options] = mockBlobClient.uploadData.mock.calls[0];
        expect(Buffer.isBuffer(data)).toBe(true);
        expect(options.blobHTTPHeaders.blobContentType).toBe('application/gzip');
    });

    it('sets correct metadata on blob', async () => {
        await service.createBackup('manual', makeReq());
        const [, options] = mockBlobClient.uploadData.mock.calls[0];
        expect(options.metadata.type).toBe('manual');
        expect(options.metadata.created_by).toBe('1');
    });

    it('returns correct shape with name, timestamp and type', async () => {
        const result = await service.createBackup('auto', null);
        expect(result).toMatchObject({ type: 'auto' });
        expect(result.name).toContain('auto-backup-');
        expect(result.name).toContain('.json.gz');
        expect(result.timestamp).toBeDefined();
    });

    it('uses "system" as created_by when no req provided', async () => {
        await service.createBackup('auto', null);
        const [, options] = mockBlobClient.uploadData.mock.calls[0];
        expect(options.metadata.created_by).toBe('system');
    });

    it('generates unique filename with ISO timestamp', async () => {
        const result1 = await service.createBackup('manual', makeReq());
        await new Promise(r => setTimeout(r, 10));
        const result2 = await service.createBackup('manual', makeReq());
        expect(result1.name).not.toBe(result2.name);
    });
});

describe('deleteBackup', () => {

    it('throws 404 if backup not found', async () => {
        mockBlobClient.exists.mockResolvedValue(false);
        await expect(service.deleteBackup('nonexistent.json.gz', makeReq()))
            .rejects.toMatchObject({ status: 404, message: 'Бекап не знайдено' });
    });

    it('deletes existing backup', async () => {
        mockBlobClient.exists.mockResolvedValue(true);
        await service.deleteBackup('backup.json.gz', makeReq());
        expect(mockBlobClient.delete).toHaveBeenCalledOnce();
    });
});

describe('_rotateBackups', () => {

    it('does not delete when backup count within limit', async () => {
        mockContainerClient.listBlobsFlat.mockReturnValue(makeBlobList(
            Array.from({ length: 7 }, (_, i) => makeBlob(`auto-backup-${i}.json.gz`, 'auto', i))
        ));

        await service._rotateBackups('auto');
        expect(mockBlobClient.delete).not.toHaveBeenCalled();
    });

    it('deletes oldest backups when exceeding auto limit (7)', async () => {
        const blobs = Array.from({ length: 9 }, (_, i) =>
            makeBlob(`auto-backup-${i}.json.gz`, 'auto', i)
        );
        mockContainerClient.listBlobsFlat.mockReturnValue(makeBlobList(blobs));

        await service._rotateBackups('auto');
        expect(mockBlobClient.delete).toHaveBeenCalledTimes(2);
    });

    it('deletes oldest backups when exceeding manual limit (10)', async () => {
        const blobs = Array.from({ length: 12 }, (_, i) =>
            makeBlob(`manual-backup-${i}.json.gz`, 'manual', i)
        );
        mockContainerClient.listBlobsFlat.mockReturnValue(makeBlobList(blobs));

        await service._rotateBackups('manual');
        expect(mockBlobClient.delete).toHaveBeenCalledTimes(2);
    });

    it('only deletes backups of the same type', async () => {
        mockContainerClient.listBlobsFlat.mockReturnValue(makeBlobList([
            ...Array.from({ length: 5 }, (_, i) => makeBlob(`auto-${i}.json.gz`, 'auto', i)),
            ...Array.from({ length: 5 }, (_, i) => makeBlob(`manual-${i}.json.gz`, 'manual', i)),
        ]));

        await service._rotateBackups('auto');
        expect(mockBlobClient.delete).not.toHaveBeenCalled();
    });
});