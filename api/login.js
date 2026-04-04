import pg from 'pg';
import { verifyPassword } from './_password_hash.js';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Простой rate limiter в памяти
const loginAttempts = new Map();

function checkRateLimit(ip) {
  const now = Date.now();
  const attempts = loginAttempts.get(ip) || [];
  const recent = attempts.filter(t => now - t < 60000);
  if (recent.length >= 5) return false;
  loginAttempts.set(ip, [...recent, now]);
  return true;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  
  if (!checkRateLimit(clientIp)) {
    return res.status(429).json({ error: 'Слишком много попыток. Попробуйте позже.' });
  }

  const { login, password } = req.body;

  if (!login || !password) {
    return res.status(400).json({ error: 'Логин и пароль обязательны' });
  }

  try {
    const client = await pool.connect();
    
    const result = await client.query(
      'SELECT id, username, email, password_hash, password_chain, password_salt, login_attempts, locked_until FROM users WHERE username = $1 OR email = $1',
      [login]
    );

    if (result.rows.length === 0) {
      client.release();
      await new Promise(resolve => setTimeout(resolve, 100));
      return res.status(401).json({ error: 'Неверный логин или пароль' });
    }

    const user = result.rows[0];

    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      client.release();
      return res.status(401).json({ error: 'Аккаунт временно заблокирован' });
    }

    const isValid = await verifyPassword(password, user.password_hash, user.password_chain, user.password_salt);

    if (!isValid) {
      const attempts = (user.login_attempts || 0) + 1;
      let lockedUntil = null;
      
      if (attempts >= 5) {
        lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
      }
      
      await client.query(
        'UPDATE users SET login_attempts = $1, locked_until = $2 WHERE id = $3',
        [attempts, lockedUntil, user.id]
      );
      
      client.release();
      return res.status(401).json({ error: 'Неверный логин или пароль' });
    }

    await client.query(
      'UPDATE users SET login_attempts = 0, locked_until = NULL, online = true, last_seen = NOW() WHERE id = $1',
      [user.id]
    );

    client.release();

    res.status(200).json({ id: user.id, username: user.username, email: user.email });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
}
