import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import crypto from 'crypto';
import { hashPassword, verify } from './api/_password_hash.js';
import { sendVerificationEmail } from './api/_email.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

app.use(express.json());
app.use(express.static(__dirname));

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.post('/api/auth', async (req, res) => {
  const { action } = req.query;
  const { username, email, password, login } = req.body;
  
  if (action === 'register') {
    if (!username || !password) return res.status(400).json({ error: 'Имя пользователя и пароль обязательны' });
    
    try {
      const client = await pool.connect();
      const existing = await client.query('SELECT id FROM users WHERE LOWER(username) = LOWER($1)', [username]);
      if (existing.rows.length > 0) {
        client.release();
        return res.status(400).json({ error: 'Пользователь с таким именем уже существует' });
      }
      
      const { hash, chainId, salt } = await hashPassword(password);
      const verifyToken = crypto.randomBytes(32).toString('hex');
      
      await client.query(
        `INSERT INTO users (username, email, password_hash, password_chain, password_salt, email_verify_token, online, last_seen)
         VALUES ($1, $2, $3, $4, $5, $6, true, NOW())`,
        [username, email || null, hash, chainId, salt, verifyToken]
      );
      client.release();
      
      if (email) await sendVerificationEmail(email, username, verifyToken);
      
      res.json({ success: true, message: 'Регистрация успешна!' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Ошибка сервера' });
    }
    return;
  }
  
  if (action === 'login') {
    if (!login || !password) return res.status(400).json({ error: 'Логин и пароль обязательны' });
    
    try {
      const client = await pool.connect();
      const result = await client.query(
        'SELECT id, username, email, email_verified, password_hash, password_chain, password_salt FROM users WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($1)',
        [login]
      );
      
      if (result.rows.length === 0) {
        client.release();
        return res.status(401).json({ error: 'Неверный логин или пароль' });
      }
      
      const user = result.rows[0];
      const isValid = await verify(password, user.password_hash, user.password_chain, user.password_salt);
      
      if (!isValid) {
        client.release();
        return res.status(401).json({ error: 'Неверный логин или пароль' });
      }
      
      if (!user.email_verified && user.email) {
        client.release();
        return res.status(401).json({ error: 'Подтвердите email перед входом', needsVerification: true });
      }
      
      await client.query('UPDATE users SET online = true, last_seen = NOW() WHERE id = $1', [user.id]);
      client.release();
      
      res.json({ id: user.id, username: user.username, email: user.email, emailVerified: user.email_verified });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Ошибка сервера' });
    }
    return;
  }
  
  res.status(400).json({ error: 'Неизвестное действие' });
});

app.get('/api/ping', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
