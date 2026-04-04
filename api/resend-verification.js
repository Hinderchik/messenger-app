import pg from 'pg';
import crypto from 'crypto';
import nodemailer from 'nodemailer';

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const transporter = nodemailer.createTransport({
    host: 'smtp.resend.com',
    port: 465,
    secure: true,
    auth: { user: 'resend', pass: process.env.RESEND_API_KEY }
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { login } = req.body;
  if (!login) return res.status(400).json({ error: 'Login required' });

  try {
    const client = await pool.connect();
    
    // Ищем пользователя по username или email
    const user = await client.query(
      'SELECT id, username, email FROM users WHERE username = $1 OR email = $1',
      [login]
    );
    
    if (user.rows.length === 0 || !user.rows[0].email) {
      client.release();
      return res.status(200).json({ message: 'Если email существует, письмо отправлено' });
    }
    
    const userId = user.rows[0].id;
    const username = user.rows[0].username;
    const email = user.rows[0].email;
    
    // Генерируем токен
    const token = crypto.randomBytes(32).toString('hex');
    await client.query('UPDATE users SET email_verify_token = $1 WHERE id = $2', [token, userId]);
    client.release();
    
    const appUrl = process.env.APP_URL || 'https://bpmshopsgh.ru';
    const verificationUrl = `${appUrl}/verify-email?token=${token}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="UTF-8"></head>
      <body style="font-family: Arial, sans-serif; padding: 20px;">
        <div style="max-width: 500px; margin: 0 auto; background: #fff; border-radius: 10px; padding: 30px;">
          <h2>Подтверждение email</h2>
          <p>Привет, <strong>${username}</strong>!</p>
          <p>Нажми на кнопку, чтобы подтвердить email:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}" style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px;">Подтвердить</a>
          </div>
          <p>Или скопируй ссылку: ${verificationUrl}</p>
        </div>
      </body>
      </html>
    `;
    
    await transporter.sendMail({
      from: 'noreply@bpmshopsgh.ru',
      to: email,
      subject: 'Подтверждение email - c.c Messenger',
      html: html
    });
    
    res.status(200).json({ message: 'Письмо отправлено' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Ошибка отправки' });
  }
}
