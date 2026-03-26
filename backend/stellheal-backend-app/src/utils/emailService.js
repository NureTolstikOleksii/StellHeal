import { Resend } from 'resend';
import dotenv from 'dotenv';
dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);

const MAIL_FROM = process.env.MAIL_FROM || 'onboarding@resend.dev';

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

    try {
        await resend.emails.send({
            from: `StellHeal <${MAIL_FROM}>`,
            to: [to],
            subject: 'Вітаємо у StellHeal!',
            html: htmlContent,
        });
        console.log(`✅ Welcome email sent to ${to}`);
    } catch (error) {
        console.error(`❌ Error sending welcome email:`, error);
        throw error;
    }
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

    try {
        await resend.emails.send({
            from: `StellHeal <${MAIL_FROM}>`,
            to: [to],
            subject: 'Доступ до системи StellHeal',
            html: htmlContent,
        });
        console.log(`✅ Staff credentials email sent to ${to}`);
    } catch (error) {
        console.error(`❌ Error sending staff email:`, error);
        throw error;
    }
};

export const sendResetPasswordEmail = async (to, token) => {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

    const htmlContent = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px;border:1px solid #e0e0e0;border-radius:10px;">
            <h3 style="color:#2a7de1;">Запит на відновлення пароля</h3>
            <p>Вітаємо!</p>
            <p>Ви надіслали запит на відновлення пароля до вашого облікового запису <strong>StellHeal</strong>.</p>
            <p>Якщо ви не ініціювали цю дію — просто проігноруйте цей лист. Ваші дані залишаться в безпеці.</p>
            <p>Щоб створити новий пароль, перейдіть за наступним посиланням:</p>
            <p style="margin: 20px 0;">
                <a href="${resetUrl}" style="background-color:#2a7de1;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;">Натисніть тут для відновлення пароля</a>
            </p>
            <p>Зверніть увагу: посилання буде активним протягом 1 години.</p>
            <br />
            <p>З повагою,<br />
            Команда <strong>StellHeal</strong></p>
        </div>
    `;

    try {
        await resend.emails.send({
            from: `StellHeal <${MAIL_FROM}>`,
            to: [to],
            subject: 'Інструкції для відновлення пароля',
            html: htmlContent,
        });
        console.log(`✅ Reset password email sent to ${to}`);
    } catch (error) {
        console.error(`❌ Error sending reset email:`, error);
        throw error;
    }
};