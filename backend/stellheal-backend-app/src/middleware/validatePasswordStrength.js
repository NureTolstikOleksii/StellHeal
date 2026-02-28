export function validatePasswordStrength(req, res, next) {
    const { newPassword } = req.body;

    if (!newPassword) {
        return res.status(400).json({ message: 'Новий пароль обов’язковий' });
    }

    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_])[A-Za-z\d\W_]{8,}$/;

    if (!regex.test(newPassword)) {
        return res.status(400).json({
            message: `Новий пароль має відповідати таким вимогам:\n- не менше 8 символів;\n- лише латинські літери;\n- хоча б 1 велика літера;\n- хоча б 1 маленька літера;\n- хоча б 1 цифра;\n- хоча б 1 спеціальний символ.`
        });
    }

    next();
}