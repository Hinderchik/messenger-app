import pg from 'pg';
import { hashPassword } from './_password_hash.js';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token, password } = req.body;

  if (!token || !password) {
    return res.status(400).json({ error: 'Token and password required' });
  }

  if (password.length < 8 || password.length > 16) {
    return res.status(400).json({ error: 'Password must be 8-16 characters' });
  }

  try {
    const client = await pool.connect();
    
    const result = await client.query(
      'SELECT id FROM users WHERE reset_token = $1 AND reset_expires > NOW()',
      [token]
    );

    if (result.rows.length === 0) {
      client.release();
      return res.status(400).json({ error: 'Неверный или просроченный токен' });
    }

    const userId = result.rows[0].id;
    const { hash, chainId, salt } = await hashPassword(password);

    await client.query(
      'UPDATE users SET password_hash = $1, password_chain = $2, password_salt = $3, reset_token = NULL, reset_expires = NULL WHERE id = $4',
      [hash, chainId, salt, userId]
    );

    client.release();

    res.status(200).json({ message: 'Пароль успешно изменён! Теперь вы можете войти.' });
  } catch (error) {
    console.error('Reset confirm error:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
}
