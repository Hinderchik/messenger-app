import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    host: 'smtp.resend.com',
    port: 465,
    secure: true,
    auth: { user: 'resend', pass: process.env.RESEND_API_KEY }
});

export async function sendVerificationEmail(email, username, token) {
    const appUrl = process.env.APP_URL || 'https://bpmshopsgh.ru';
    const verificationUrl = `${appUrl}/verify-email?token=${token}`;
    
    const html = `
        <div style="font-family: Arial; padding: 20px;">
            <h2>Подтверждение email</h2>
            <p>Привет, ${username}!</p>
            <a href="${verificationUrl}">Подтвердить email</a>
        </div>
    `;
    
    await transporter.sendMail({
        from: 'noreply@bpmshopsgh.ru',
        to: email,
        subject: 'Подтверждение email',
        html: html
    });
}

export async function sendResetPasswordEmail(email, username, token) {
    const appUrl = process.env.APP_URL || 'https://bpmshopsgh.ru';
    const resetUrl = `${appUrl}/reset-password?token=${token}`;
    
    await transporter.sendMail({
        from: 'noreply@bpmshopsgh.ru',
        to: email,
        subject: 'Сброс пароля',
        html: `<a href="${resetUrl}">Сбросить пароль</a>`
    });
}
