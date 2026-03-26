import { Resend } from 'resend';
import dotenv from 'dotenv';

dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);

const sendEmail = async (to, subject, html) => {
    try {
        await resend.emails.send({
            from: process.env.MAIL_FROM,
            to,
            subject,
            html,
            tracking_settings: {
                click: {
                    enabled: false,
                },
            },
        });

        console.log(`Email sent to ${to}`, response);
        return response;
    } catch (error) {
        console.error(`Email error to ${to}`, error);
        throw error;
    }
};

export const sendWelcomeEmail = async (to, password) => {
    const html = `
        <div style="font-family:Arial;max-width:600px;margin:auto;padding:20px;border:1px solid #eee;border-radius:10px;">
            <h2 style="color:#2a7de1;">Welcome to StellHeal 💙</h2>

            <p>Your account has been created successfully.</p>

            <p><strong>Email:</strong> ${to}</p>
            <p><strong>Password:</strong> ${password}</p>

            <p style="color:red;"><strong>Please change your password after login!</strong></p>
        </div>
    `;

    return sendEmail(to, 'Welcome to StellHeal', html);
};

export const sendStaffCredentialsEmail = async (to, password) => {
    const html = `
        <div style="font-family:Arial;max-width:600px;margin:auto;padding:20px;border:1px solid #eee;border-radius:10px;">
            <h2 style="color:#2a7de1;">Access to StellHeal</h2>

            <p>You have been added to the system.</p>

            <p><strong>Email:</strong> ${to}</p>
            <p><strong>Password:</strong> ${password}</p>

            <p style="color:red;"><strong>Change password after login!</strong></p>
        </div>
    `;

    return sendEmail(to, 'Your StellHeal access', html);
};

export const sendResetPasswordEmail = async (to, token) => {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

    const html = `
        <div style="font-family:Arial;max-width:600px;margin:auto;padding:20px;border:1px solid #eee;border-radius:10px;">
            <h2 style="color:#2a7de1;">Reset your password</h2>

            <p>Click the button below to reset your password:</p>

            <a href="${resetUrl}" 
               style="display:inline-block;background:#2a7de1;color:white;padding:10px 20px;border-radius:5px;text-decoration:none;">
               Reset Password
            </a>

            <p>This link is valid for 1 hour.</p>
        </div>
    `;

    return sendEmail(to, 'Reset your password', html);
};