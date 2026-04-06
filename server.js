import express from 'express';
import pg from 'pg';
import crypto from 'crypto';
import { register, verify } from './api/_password_hash.js';
import { sendVerificationEmail } from './api/_email.js';

const app = express();
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

app.use(express.json());
app.use(express.static('.'));

app.post('/api/auth', async (req, res) => {
  const { action } = req.query;
  const { username, email, password, login } = req.body;
  
  if (action === 'register') {
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
    
    try {
      const client = await pool.connect();
      const existing = await client.query('SELECT id FROM users WHERE username = $1', [username]);
      if (existing.rows.length > 0) {
        client.release();
        return res.status(400).json({ error: 'User already exists' });
      }
      
      const { hash, chainId, salt } = await register(password);
      const verifyToken = crypto.randomBytes(32).toString('hex');
      
      await client.query(
        `INSERT INTO users (username, email, password_hash, password_chain, password_salt, email_verify_token, online, last_seen)
         VALUES ($1, $2, $3, $4, $5, $6, true, NOW())`,
        [username, email || null, hash, chainId, salt, verifyToken]
      );
      client.release();
      
      if (email) await sendVerificationEmail(email, username, verifyToken);
      
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal error' });
    }
    return;
  }
  
  if (action === 'login') {
    if (!login || !password) return res.status(400).json({ error: 'Login and password required' });
    
    try {
      const client = await pool.connect();
      const result = await client.query(
        'SELECT id, username, email, email_verified, password_hash, password_chain, password_salt FROM users WHERE username = $1 OR email = $1',
        [login]
      );
      
      if (result.rows.length === 0) {
        client.release();
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      const user = result.rows[0];
      const isValid = await verify(password, user.password_hash, user.password_chain, user.password_salt);
      
      if (!isValid) {
        client.release();
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      if (!user.email_verified && user.email) {
        client.release();
        return res.status(401).json({ error: 'Please verify email first', needsVerification: true });
      }
      
      await client.query('UPDATE users SET online = true, last_seen = NOW() WHERE id = $1', [user.id]);
      client.release();
      
      res.json({ id: user.id, username: user.username, email: user.email });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal error' });
    }
    return;
  }
  
  res.status(400).json({ error: 'Invalid action' });
});

app.get('/api/ping', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
