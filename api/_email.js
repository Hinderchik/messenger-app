import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    host: 'smtp.resend.com',
    port: 465,
    secure: true,
    auth: {
        user: 'resend',
        pass: process.env.RESEND_API_KEY
    }
});

export async function sendVerificationEmail(email, username, token) {
    const appUrl = process.env.APP_URL || 'https://bpmshopsgh.ru';
    const verificationUrl = `${appUrl}/verify-email?token=${token}`;
    
    const html = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="UTF-8"><title>Подтверждение email</title></head>
        <body style="font-family: Arial, sans-serif; padding: 20px;">
            <div style="max-width: 500px; margin: 0 auto; background: #fff; border-radius: 10px; padding: 30px;">
                <h2 style="color: #333;">Подтверждение email</h2>
                <p>Привет, <strong>${username}</strong>!</p>
                <p>Для подтверждения email нажми на кнопку:</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${verificationUrl}" style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px;">Подтвердить</a>
                </div>
                <p>Или скопируй ссылку: ${verificationUrl}</p>
                <hr>
                <p style="color: #999; font-size: 12px;">Если ты не регистрировался, игнорируй письмо.</p>
            </div>
        </body>
        </html>
    `;
    
    try {
        await transporter.sendMail({
            from: 'noreply@bpmshopsgh.ru',
            to: email,
            subject: 'Подтверждение email - c.c Messenger',
            html: html
        });
        console.log('Email sent to:', email);
        return true;
    } catch (error) {
        console.error('Email error:', error);
        return false;
    }
}

export async function sendResetPasswordEmail(email, username, token) {
    const appUrl = process.env.APP_URL || 'https://bpmshopsgh.ru';
    const resetUrl = `${appUrl}/reset-password?token=${token}`;
    
    const html = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="UTF-8"><title>Сброс пароля</title></head>
        <body style="font-family: Arial, sans-serif; padding: 20px;">
            <div style="max-width: 500px; margin: 0 auto; background: #fff; border-radius: 10px; padding: 30px;">
                <h2 style="color: #333;">Сброс пароля</h2>
                <p>Привет, <strong>${username}</strong>!</p>
                <p>Нажми на кнопку, чтобы сбросить пароль:</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${resetUrl}" style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px;">Сбросить пароль</a>
                </div>
                <p>Ссылка действительна 1 час.</p>
                <hr>
                <p style="color: #999; font-size: 12px;">Если ты не запрашивал сброс, игнорируй письмо.</p>
            </div>
        </body>
        </html>
    `;
    
    try {
        await transporter.sendMail({
            from: 'noreply@bpmshopsgh.ru',
            to: email,
            subject: 'Сброс пароля - c.c Messenger',
            html: html
        });
        return true;
    } catch (error) {
        console.error('Reset email error:', error);
        return false;
    }
}
