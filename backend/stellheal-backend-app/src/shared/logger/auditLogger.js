import prisma from '../../config/prisma.js';

export const logAction = async ({
                                    userId,
                                    action,
                                    entity,
                                    entityId,
                                    description,
                                    metadata,
                                    req
                                }) => {
    try {
        await prisma.audit_logs.create({
            data: {
                user_id: userId || null,
                action,
                entity,
                entity_id: entityId || null,
                description,
                metadata,
                ip_address: req?.ip || null
            }
        });
    } catch (e) {
        console.error('Audit log error:', e);
    }
};