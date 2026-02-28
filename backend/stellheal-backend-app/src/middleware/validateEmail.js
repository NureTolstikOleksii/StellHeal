export const validateEmail = (req, res, next) => {
    const { email } = req.body;
    const { login } = req.body;

    if (!email && !login) {
        return res.status(400).json({ error: 'Поле email є обовʼязковим' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email) && !emailRegex.test(login)) {
        return res.status(400).json({ error: 'Некоректний формат email' });
    }

    next();
};
