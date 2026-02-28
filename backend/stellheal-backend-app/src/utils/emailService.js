import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
    },
});

export const sendWelcomeEmail = async (to, password) => {
    const htmlContent = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px;border:1px solid #e0e0e0;border-radius:10px;">
            <h3 style="color:#2a7de1;">Вітаємо у Healthy Helper!</h3>
            <p>Дякуємо, що приєдналися до нашої цифрової медичної системи <strong>Healthy Helper</strong> — платформи для керування призначеннями, нагадуваннями та медичними даними.</p>
            
            <h3>🎉 Ваш обліковий запис створено успішно! Для входу у мобільний застосунок скористайтесь наступними данними:</h3>
            <p><strong>Електронна пошта:</strong> ${to}<br/>
            <strong>Тимчасовий пароль:</strong> ${password}</p>

            <p style="color:#d93025;"><strong>‼️З міркувань безпеки рекомендуємо змінити пароль після першого входу.</strong></p>

            <p>Якщо у вас виникли питання, наша команда підтримки завжди готова допомогти.</p>

            <p>З повагою,<br/>
            Команда <strong>Healthy Helper</strong> 💙</p>
        </div>
    `;

    await transporter.sendMail({
        from: `"Healthy Helper" <${process.env.MAIL_USER}>`,
        to,
        subject: 'Вітаємо у Healthy Helper!',
        html: htmlContent,
    });
};

export const sendStaffCredentialsEmail = async (to, password) => {
    const htmlContent = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px;border:1px solid #e0e0e0;border-radius:10px;">
            <h3 style="color:#2a7de1;">Ваш доступ до системи Healthy Helper</h3>
            <p>Вас додано до медичної команди в цифровій системі <strong>Healthy Helper</strong>.</p>
            
            <p><strong>Електронна пошта:</strong> ${to}<br/>
            <strong>Тимчасовий пароль:</strong> ${password}</p>

            <p style="color:#d93025;"><strong>‼️Будь ласка, змініть пароль після першого входу!</strong></p>

            <p>З повагою,<br/>
            Команда <strong>Healthy Helper</strong></p>
        </div>
    `;

    await transporter.sendMail({
        from: `"Healthy Helper" <${process.env.MAIL_USER}>`,
        to,
        subject: 'Доступ до системи Healthy Helper',
        html: htmlContent,
    });
};

export const sendResetPasswordEmail = async (to, token) => {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

    const htmlContent = `
        <h3>Запит на відновлення пароля</h3>
        <p>Вітаємо!</p>
        <p>Ви надіслали запит на відновлення пароля до вашого облікового запису <strong>Healthy Helper</strong>.</p>
        <p>Якщо ви не ініціювали цю дію — просто проігноруйте цей лист. Ваші дані залишаться в безпеці.</p>
        <p>Щоб створити новий пароль, перейдіть за наступним посиланням:</p>
        <p><a href="${resetUrl}">Натисніть тут для відновлення пароля</a></p>
        <p>Зверніть увагу: посилання буде активним протягом 1 години.</p>
        <br />
        <p>З повагою,<br />
        Команда Healthy Helper</p>
    `;
    await transporter.sendMail({
        from: `"Healthy Helper" <${process.env.MAIL_USER}>`,
        to,
        subject: 'Інструкції для відновлення пароля',
        html: htmlContent,
    });
};
