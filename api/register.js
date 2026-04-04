import pg from 'pg';
import { hashPassword } from './_password_hash.js';
import { sendVerificationEmail } from './_email.js';
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

  const { username, email, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Имя пользователя и пароль обязательны' });
  }

  if (password.length < 8 || password.length > 16) {
    return res.status(400).json({ error: 'Пароль должен быть 8-16 символов' });
  }

  try {
    const client = await pool.connect();
    
    const existing = await client.query(
      'SELECT id FROM users WHERE username = $1',
      [username]
    );

    if (existing.rows.length > 0) {
      client.release();
      return res.status(400).json({ error: 'Пользователь уже существует' });
    }

    const { hash, chainId, salt } = await hashPassword(password);
    
    let verifyToken = null;
    let emailVerified = false;
    
    // Если email указан - отправляем письмо
    if (email && email.trim()) {
      verifyToken = crypto.randomBytes(32).toString('hex');
      emailVerified = false;
    } else {
      emailVerified = true; // Без email считаем верифицированным? Нет, просто без подтверждения
      emailVerified = false;
    }

    const result = await client.query(
      `INSERT INTO users (username, email, password_hash, password_chain, password_salt, email_verify_token, email_verified, online, last_seen)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW())
       RETURNING id, username, email`,
      [username, email || null, hash, chainId, salt, verifyToken, emailVerified]
    );

    client.release();
    
    // Отправляем письмо только если email указан
    if (email && email.trim() && verifyToken) {
      await sendVerificationEmail(email, username, verifyToken);
    }
    
    res.status(200).json({ 
      id: result.rows[0].id, 
      username: result.rows[0].username,
      message: email ? 'Проверьте почту для подтверждения' : 'Регистрация успешна'
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
}
