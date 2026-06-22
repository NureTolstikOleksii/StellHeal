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

export const uploadPrescriptionFile = async (file) => {
    const safeName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const blobName = `${Date.now()}-${safeName}`;
    const blockBlobClient = prescriptionContainer.getBlockBlobClient(blobName);

    await blockBlobClient.uploadData(file.buffer, {
        blobHTTPHeaders: { blobContentType: file.mimetype }
    });

    return blobName;
};

export const getPrescriptionFileUrl = async (blobName, expiresInMinutes = 60) => {
    const blockBlobClient = prescriptionContainer.getBlockBlobClient(blobName);

    const sasUrl = await blockBlobClient.generateSasUrl({
        expiresOn: new Date(Date.now() + expiresInMinutes * 60 * 1000),
        permissions: BlobSASPermissions.parse('r'),
    });

    return sasUrl;
};

export const deletePrescriptionFile = async (blobName) => {
    const blockBlobClient = prescriptionContainer.getBlockBlobClient(blobName);
    await blockBlobClient.deleteIfExists();
};

const deleteOldAvatars = async (userId) => {
    // дозволені символи розширення — лише букви/цифри
    const pattern = new RegExp(`^avatar-${userId}(-\\d+)?\\.[A-Za-z0-9]+$`);

    for await (const blob of avatarContainer.listBlobsFlat({ prefix: `avatar-${userId}` })) {
        if (pattern.test(blob.name)) {
            await avatarContainer.getBlockBlobClient(blob.name).deleteIfExists();
        }
    }
};

export const uploadAvatarToAzure = async (fileBuffer, originalname, mimetype, userId) => {
    const ext = (originalname.split('.').pop() || 'jpg').toLowerCase();

    await deleteOldAvatars(userId);

    const blobName = `avatar-${userId}-${Date.now()}.${ext}`;
    const blockBlobClient = avatarContainer.getBlockBlobClient(blobName);

    await blockBlobClient.uploadData(fileBuffer, {
        blobHTTPHeaders: { blobContentType: mimetype }
    });

    return blockBlobClient.url;
};

export const deleteAvatar = async (blobName) => {
    const blockBlobClient = avatarContainer.getBlockBlobClient(blobName);
    await blockBlobClient.deleteIfExists();
};