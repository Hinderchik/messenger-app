import pg from 'pg';
import { sendResetPasswordEmail } from './_email.js';
import crypto from 'crypto';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { login } = req.body;

  if (!login) {
    return res.status(400).json({ error: 'Email или имя пользователя обязательно' });
  }

  try {
    const client = await pool.connect();
    
    const result = await client.query(
      'SELECT id, username, email FROM users WHERE username = $1 OR email = $1',
      [login]
    );

    if (result.rows.length === 0) {
      client.release();
      // Не показываем, что пользователь не найден (безопасность)
      return res.status(200).json({ message: 'Если аккаунт существует, письмо отправлено' });
    }

    const user = result.rows[0];
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 3600000); // 1 час

    await client.query(
      'UPDATE users SET reset_token = $1, reset_expires = $2 WHERE id = $3',
      [resetToken, resetExpires, user.id]
    );

    client.release();

    // Отправляем письмо (даже если email не подтверждён)
    const emailSent = await sendResetPasswordEmail(user.email, user.username, resetToken);
    
    if (emailSent) {
      res.status(200).json({ message: 'Письмо для сброса пароля отправлено' });
    } else {
      res.status(200).json({ message: 'Если аккаунт существует, письмо отправлено' });
    }
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
}
