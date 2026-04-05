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

// Хранилище кодов (в памяти)
const codes = new Map();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { login } = req.body;
  if (!login) return res.status(400).json({ error: 'Login required' });

  try {
    const client = await pool.connect();
    
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
    
    // Генерируем 6-значный код
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const token = crypto.randomBytes(32).toString('hex');
    
    // Сохраняем код
    codes.set(email, { code, token, expires: Date.now() + 15 * 60 * 1000 });
    
    // Сохраняем токен в БД
    await client.query('UPDATE users SET email_verify_token = $1 WHERE id = $2', [token, userId]);
    client.release();
    
    const appUrl = process.env.APP_URL || 'https://bpmshopsgh.ru';
    const verificationUrl = `${appUrl}/verify-code?email=${encodeURIComponent(email)}&token=${token}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Подтверждение email - c.c Messenger</title>
        <style>
          body { font-family: Arial, sans-serif; background: #f5f5f5; padding: 20px; }
          .container { max-width: 500px; margin: 0 auto; background: white; border-radius: 20px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #667eea, #764ba2); padding: 30px; text-align: center; }
          .header .logo { font-size: 48px; }
          .header h1 { color: white; margin-top: 10px; font-size: 24px; }
          .content { padding: 30px; text-align: center; }
          .code {
            font-size: 48px;
            font-weight: bold;
            letter-spacing: 10px;
            color: #667eea;
            background: #f0f0f0;
            padding: 15px;
            border-radius: 12px;
            margin: 20px 0;
            font-family: monospace;
          }
          .button {
            display: inline-block;
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 25px;
            margin-top: 20px;
          }
          .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #999; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">💬</div>
            <h1>c.c Messenger</h1>
          </div>
          <div class="content">
            <h2>Здравствуйте, ${username}!</h2>
            <p>Для подтверждения email введите этот код:</p>
            <div class="code">${code}</div>
            <p>Код действителен в течение 15 минут.</p>
            <a href="${verificationUrl}" class="button">Или нажмите сюда</a>
          </div>
          <div class="footer">
            <p>Если вы не запрашивали подтверждение, просто проигнорируйте это письмо.</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    await transporter.sendMail({
      from: 'noreply@bpmshopsgh.ru',
      to: email,
      subject: 'Код подтверждения - c.c Messenger',
      html: html
    });
    
    res.status(200).json({ message: 'Код отправлен на почту' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Ошибка отправки' });
  }
}
