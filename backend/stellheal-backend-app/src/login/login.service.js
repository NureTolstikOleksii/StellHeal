import crypto from 'crypto';

export class LoginService {
    async findUserByLogin(db, login) {
        try {
            const user = await db.users.findUnique({
                where: {login},
                include: {roles: true}
            });
            return user;
        } catch (error) {
            throw new Error(`Error finding user by login: ${error.message}`);
        }
    }

    async createResetToken(prisma, userId) {
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 година

        await prisma.password_reset_tokens.create({
            data: {
                user_id: userId,
                token,
                expires_at: expiresAt,
            }
        });

        return token;
    }

    async findUserByResetToken(prisma, token) {
        const record = await prisma.password_reset_tokens.findUnique({
            where: { token },
            include: { users: true }
        });

        if (!record || new Date(record.expires_at) < new Date()) return null;
        return record.users;
    }

    async updatePassword(prisma, userId, hashedPassword) {
        return prisma.users.update({
            where: { user_id: userId },
            data: { password: hashedPassword }
        });
    }

    async deleteResetToken(prisma, token) {
        await prisma.password_reset_tokens.delete({
            where: { token }
        });
    }
}
