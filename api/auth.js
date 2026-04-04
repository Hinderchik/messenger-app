import pg from 'pg';
import crypto from 'crypto';
import { hashPassword, verifyPassword } from './_password_hash.js';

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export default async function handler(req, res) {
  // REGISTER - POST /api/auth?action=register
  if (req.method === 'POST' && req.query.action === 'register') {
    const { username, email, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }
    
    try {
      const client = await pool.connect();
      const existing = await client.query('SELECT id FROM users WHERE username = $1', [username]);
      if (existing.rows.length > 0) {
        client.release();
        return res.status(400).json({ error: 'User already exists' });
      }
      
      const { hash, chainId, salt } = await hashPassword(password);
      const verifyToken = (email && email.trim()) ? crypto.randomBytes(32).toString('hex') : null;
      
      const result = await client.query(
        `INSERT INTO users (username, email, password_hash, password_chain, password_salt, email_verify_token, email_verified, online, last_seen)
         VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW())
         RETURNING id, username`,
        [username, email || null, hash, chainId, salt, verifyToken, !verifyToken]
      );
      client.release();
      
      res.status(200).json({ id: result.rows[0].id, username: result.rows[0].username });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal error' });
    }
    return;
  }
  
  // LOGIN - POST /api/auth?action=login
  if (req.method === 'POST' && req.query.action === 'login') {
    const { login, password } = req.body;
    
    if (!login || !password) {
      return res.status(400).json({ error: 'Login and password required' });
    }
    
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
      const isValid = await verifyPassword(password, user.password_hash, user.password_chain, user.password_salt);
      
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
      
      res.status(200).json({ id: user.id, username: user.username, email: user.email, emailVerified: user.email_verified });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal error' });
    }
    return;
  }
  
  res.status(404).json({ error: 'Not found' });
}
