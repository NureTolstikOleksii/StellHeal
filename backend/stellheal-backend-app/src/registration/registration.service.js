export class RegisterService {
    async createUserAccount(db, data, role) {
        try {
            if (data.birth_date) {
                data.birth_date = new Date(data.birth_date);
            }

            const newUser = await db.users.create({
                data: {
                    login: data.email,
                    password: data.password,
                    first_name: data.first_name,
                    last_name: data.last_name,
                    patronymic: data.patronymic,
                    date_of_birth: data.birth_date,
                    contact_info: data.address,
                    phone: data.phone,
                    role_id: role,
                },
            });

            return {
                message: 'Account created successfully',
                first_name: newUser.first_name,
                email: newUser.login,
            };
        } catch (error) {
            throw new Error(`Error creating user: ${error.message}`);
        }
    }
}