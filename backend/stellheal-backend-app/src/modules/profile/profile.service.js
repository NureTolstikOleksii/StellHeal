import bcrypt from 'bcryptjs';

export class ProfileService {

    // отримання профілю
    async getProfile(db, userId) {
        return await db.users.findUnique({
            where: { user_id: userId },
            include: {
                roles: true,
                medical_staff: true
            }
        });
    }

    // зміна пароля
    async changePassword(db, userId, currentPassword, newPassword) {
        const user = await db.users.findUnique({
            where: { user_id: userId }
        });

        if (!user) {
            const error = new Error('Користувача не знайдено');
            error.statusCode = 404;
            throw error;
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            const error = new Error('Неправильний поточний пароль');
            error.statusCode = 400;
            throw error;
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await db.users.update({
            where: { user_id: userId },
            data: { password: hashedPassword }
        });
    }

    // оновлення профілю
    async updateProfile(db, userId, data) {
        console.log(data)
        return await db.users.update({
            where: { user_id: userId },
            data: {
                first_name: data.first_name,
                last_name: data.last_name,
                patronymic: data.patronymic,
                phone: data.phone,
                login: data.login,
                contact_info: data.contact_info
            }
        });
    }

}
