import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

const transporter = nodemailer.createTransport({
    host: '74.125.131.108', // Прямой IP адрес smtp.gmail.com (IPv4)
    port: 465,
    secure: true,
    auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
    },
    tls: {
        rejectUnauthorized: false // Помогает, если есть проблемы с сертификатами на сервере
    }
});

export const sendWelcomeEmail = async (to, password) => {
    const htmlContent = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px;border:1px solid #e0e0e0;border-radius:10px;">
            <h3 style="color:#2a7de1;">Вітаємо у StellHeal!</h3>
            <p>Дякуємо, що приєдналися до нашої цифрової медичної системи <strong>StellHeal</strong> — платформи для керування призначеннями, нагадуваннями та медичними даними.</p>
            
            <h3>🎉 Ваш обліковий запис створено успішно! Для входу у мобільний застосунок скористайтесь наступними данними:</h3>
            <p><strong>Електронна пошта:</strong> ${to}<br/>
            <strong>Тимчасовий пароль:</strong> ${password}</p>

            <p style="color:#d93025;"><strong>‼️З міркувань безпеки рекомендуємо змінити пароль після першого входу.</strong></p>

            <p>Якщо у вас виникли питання, наша команда підтримки завжди готова допомогти.</p>

            <p>З повагою,<br/>
            Команда <strong>StellHeal</strong> 💙</p>
        </div>
    `;

    await transporter.sendMail({
        from: `"StellHeal" <${process.env.MAIL_USER}>`,
        to,
        subject: 'Вітаємо у StellHeal!',
        html: htmlContent,
    });
};

export const sendStaffCredentialsEmail = async (to, password) => {
    const htmlContent = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px;border:1px solid #e0e0e0;border-radius:10px;">
            <h3 style="color:#2a7de1;">Ваш доступ до системи StellHeal</h3>
            <p>Вас додано до медичної команди в цифровій системі <strong>StellHeal</strong>.</p>
            
            <p><strong>Електронна пошта:</strong> ${to}<br/>
            <strong>Тимчасовий пароль:</strong> ${password}</p>

            <p style="color:#d93025;"><strong>‼️Будь ласка, змініть пароль після першого входу!</strong></p>

            <p>З повагою,<br/>
            Команда <strong>StellHeal</strong></p>
        </div>
    `;

    await transporter.sendMail({
        from: `"StellHeal" <${process.env.MAIL_USER}>`,
        to,
        subject: 'Доступ до системи StellHeal',
        html: htmlContent,
    });
};

export const sendResetPasswordEmail = async (to, token) => {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

    const htmlContent = `
        <h3>Запит на відновлення пароля</h3>
        <p>Вітаємо!</p>
        <p>Ви надіслали запит на відновлення пароля до вашого облікового запису <strong>StellHeal</strong>.</p>
        <p>Якщо ви не ініціювали цю дію — просто проігноруйте цей лист. Ваші дані залишаться в безпеці.</p>
        <p>Щоб створити новий пароль, перейдіть за наступним посиланням:</p>
        <p><a href="${resetUrl}">Натисніть тут для відновлення пароля</a></p>
        <p>Зверніть увагу: посилання буде активним протягом 1 години.</p>
        <br />
        <p>З повагою,<br />
        Команда StellHeal</p>
    `;
    await transporter.sendMail({
        from: `"StellHeal" <${process.env.MAIL_USER}>`,
        to,
        subject: 'Інструкції для відновлення пароля',
        html: htmlContent,
    });
};
