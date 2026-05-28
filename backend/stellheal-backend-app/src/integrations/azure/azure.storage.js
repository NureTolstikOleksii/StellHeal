import { BlobServiceClient, BlobSASPermissions } from '@azure/storage-blob';

const blobServiceClient = BlobServiceClient.fromConnectionString(
    process.env.AZURE_STORAGE_CONNECTION_STRING
);

const prescriptionContainer = blobServiceClient.getContainerClient(
    process.env.AZURE_STORAGE_PRESCRIPTION_CONTAINER
);

const avatarContainer = blobServiceClient.getContainerClient(
    process.env.AZURE_STORAGE_AVATAR_CONTAINER
);

// ── Призначення: завантажити ──────────────────────────────────────────────────
export const uploadPrescriptionFile = async (file) => {
    const safeName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const blobName = `${Date.now()}-${safeName}`;
    const blockBlobClient = prescriptionContainer.getBlockBlobClient(blobName);

    await blockBlobClient.uploadData(file.buffer, {
        blobHTTPHeaders: { blobContentType: file.mimetype }
    });

    return blobName;
};

// ── Призначення: отримати тимчасовий URL (60 хв) ─────────────────────────────
export const getPrescriptionFileUrl = async (blobName, expiresInMinutes = 60) => {
    const blockBlobClient = prescriptionContainer.getBlockBlobClient(blobName);

    const sasUrl = await blockBlobClient.generateSasUrl({
        expiresOn: new Date(Date.now() + expiresInMinutes * 60 * 1000),
        permissions: BlobSASPermissions.parse('r'),
    });

    return sasUrl;
};

// ── Призначення: видалити ─────────────────────────────────────────────────────
export const deletePrescriptionFile = async (blobName) => {
    const blockBlobClient = prescriptionContainer.getBlockBlobClient(blobName);
    await blockBlobClient.deleteIfExists();
};

// ── Аватарки: завантажити ─────────────────────────────────────────────────────
export const uploadAvatarToAzure = async (fileBuffer, originalname, mimetype, userId) => {
    const ext = originalname.split('.').pop();
    const blobName = `avatar-${userId}.${ext}`;
    const blockBlobClient = avatarContainer.getBlockBlobClient(blobName);

    await blockBlobClient.uploadData(fileBuffer, {
        blobHTTPHeaders: { blobContentType: mimetype }
    });

    return blockBlobClient.url; // публічний URL
};

// ── Аватарки: видалити ────────────────────────────────────────────────────────
export const deleteAvatar = async (blobName) => {
    const blockBlobClient = avatarContainer.getBlockBlobClient(blobName);
    await blockBlobClient.deleteIfExists();
};