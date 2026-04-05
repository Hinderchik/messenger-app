import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    host: 'smtp.resend.com',
    port: 465,
    secure: true,
    auth: { user: 'resend', pass: process.env.RESEND_API_KEY }
});

export default async function handler(req, res) {
    try {
        const info = await transporter.sendMail({
            from: 'noreply@bpmshopsgh.ru',
            to: 'artyemrebinkov@gmail.com',
            subject: 'Тестовое письмо',
            html: '<h1>Тест</h1><p>Если вы видите это письмо, SMTP работает</p>'
        });
        res.status(200).json({ success: true, messageId: info.messageId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}
