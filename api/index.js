import pg from 'pg';
import crypto from 'crypto';
import { hashPassword, verifyPassword } from './_password_hash.js';
import { sendVerificationEmail, sendResetPasswordEmail } from './_email.js';

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export default async function handler(req, res) {
  // Получаем путь из URL
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname.replace('/api/', '');
  
  console.log('API called:', path, req.method);
  
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // REGISTER
  if (path === 'register' && req.method === 'POST') {
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
      
      if (verifyToken && email) {
        await sendVerificationEmail(email, username, verifyToken);
      }
      
      res.status(200).json({ id: result.rows[0].id, username: result.rows[0].username });
    } catch (error) {
      console.error('Register error:', error);
      res.status(500).json({ error: 'Internal error' });
    }
    return;
  }
  
  // LOGIN
  if (path === 'login' && req.method === 'POST') {
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
      console.error('Login error:', error);
      res.status(500).json({ error: 'Internal error' });
    }
    return;
  }
  
  // USERS LIST
  if (path === 'users' && req.method === 'GET') {
    const userId = url.searchParams.get('userId');
    if (!userId) {
      return res.status(400).json({ error: 'User ID required' });
    }
    
    try {
      const client = await pool.connect();
      const result = await client.query(
        'SELECT id, username, online FROM users WHERE id != $1 ORDER BY online DESC',
        [userId]
      );
      client.release();
      res.status(200).json(result.rows);
    } catch (error) {
      console.error('Users error:', error);
      res.status(500).json({ error: 'Internal error' });
    }
    return;
  }
  
  // CREATE CHAT
  if (path === 'create-chat' && req.method === 'POST') {
    const { user1Id, user2Id } = req.body;
    if (!user1Id || !user2Id) {
      return res.status(400).json({ error: 'User IDs required' });
    }
    
    try {
      const client = await pool.connect();
      const result = await client.query('SELECT create_private_chat($1, $2) as chat_id', [user1Id, user2Id]);
      client.release();
      res.status(200).json({ chatId: result.rows[0].chat_id });
    } catch (error) {
      console.error('Create chat error:', error);
      res.status(500).json({ error: 'Internal error' });
    }
    return;
  }
  
  // MESSAGES GET
  if (path === 'messages' && req.method === 'GET') {
    const chatId = url.searchParams.get('chatId');
    if (!chatId) {
      return res.status(400).json({ error: 'Chat ID required' });
    }
    
    try {
      const client = await pool.connect();
      const result = await client.query(
        'SELECT m.*, u.username as from_name FROM messages m JOIN users u ON u.id = m.from_id WHERE m.chat_id = $1 ORDER BY m.created_at ASC LIMIT 100',
        [chatId]
      );
      client.release();
      res.status(200).json(result.rows);
    } catch (error) {
      console.error('Messages error:', error);
      res.status(500).json({ error: 'Internal error' });
    }
    return;
  }
  
  // MESSAGES POST
  if (path === 'messages' && req.method === 'POST') {
    const { chatId, fromId, text } = req.body;
    if (!chatId || !fromId || !text) {
      return res.status(400).json({ error: 'Missing fields' });
    }
    
    try {
      const client = await pool.connect();
      const result = await client.query(
        'INSERT INTO messages (chat_id, from_id, text) VALUES ($1, $2, $3) RETURNING *',
        [chatId, fromId, text]
      );
      client.release();
      res.status(200).json(result.rows[0]);
    } catch (error) {
      console.error('Send message error:', error);
      res.status(500).json({ error: 'Internal error' });
    }
    return;
  }
  
  // VERIFY EMAIL
  if (path === 'verify-email' && req.method === 'GET') {
    const token = url.searchParams.get('token');
    if (!token) {
      return res.status(400).json({ error: 'Token required' });
    }
    
    try {
      const client = await pool.connect();
      const result = await client.query('SELECT id FROM users WHERE email_verify_token = $1', [token]);
      if (result.rows.length === 0) {
        client.release();
        return res.status(400).json({ error: 'Invalid token' });
      }
      await client.query('UPDATE users SET email_verified = true, email_verify_token = NULL WHERE id = $1', [result.rows[0].id]);
      client.release();
      res.status(200).json({ message: 'Email verified successfully' });
    } catch (error) {
      console.error('Verify error:', error);
      res.status(500).json({ error: 'Internal error' });
    }
    return;
  }
  
  // RESEND VERIFICATION
  if (path === 'resend-verification' && req.method === 'POST') {
    const { login } = req.body;
    if (!login) {
      return res.status(400).json({ error: 'Login required' });
    }
    
    try {
      const client = await pool.connect();
      const user = await client.query('SELECT id, username, email FROM users WHERE username = $1 OR email = $1', [login]);
      if (user.rows.length && user.rows[0].email) {
        const verifyToken = crypto.randomBytes(32).toString('hex');
        await client.query('UPDATE users SET email_verify_token = $1 WHERE id = $2', [verifyToken, user.rows[0].id]);
        await sendVerificationEmail(user.rows[0].email, user.rows[0].username, verifyToken);
      }
      client.release();
      res.status(200).json({ message: 'If email exists, verification sent' });
    } catch (error) {
      console.error('Resend error:', error);
      res.status(500).json({ error: 'Internal error' });
    }
    return;
  }
  
  // RESET PASSWORD
  if (path === 'reset-password' && req.method === 'POST') {
    const { login } = req.body;
    if (!login) {
      return res.status(400).json({ error: 'Login required' });
    }
    
    try {
      const client = await pool.connect();
      const user = await client.query('SELECT id, username, email FROM users WHERE username = $1 OR email = $1', [login]);
      if (user.rows.length && user.rows[0].email) {
        const resetToken = crypto.randomBytes(32).toString('hex');
        await client.query('UPDATE users SET reset_token = $1, reset_expires = NOW() + INTERVAL \'1 hour\' WHERE id = $2', [resetToken, user.rows[0].id]);
        await sendResetPasswordEmail(user.rows[0].email, user.rows[0].username, resetToken);
      }
      client.release();
      res.status(200).json({ message: 'If email exists, reset link sent' });
    } catch (error) {
      console.error('Reset error:', error);
      res.status(500).json({ error: 'Internal error' });
    }
    return;
  }
  
  // RESET PASSWORD CONFIRM
  if (path === 'reset-password-confirm' && req.method === 'POST') {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ error: 'Token and password required' });
    }
    
    try {
      const client = await pool.connect();
      const result = await client.query('SELECT id FROM users WHERE reset_token = $1 AND reset_expires > NOW()', [token]);
      if (result.rows.length === 0) {
        client.release();
        return res.status(400).json({ error: 'Invalid or expired token' });
      }
      const { hash, chainId, salt } = await hashPassword(password);
      await client.query(
        'UPDATE users SET password_hash = $1, password_chain = $2, password_salt = $3, reset_token = NULL, reset_expires = NULL WHERE id = $4',
        [hash, chainId, salt, result.rows[0].id]
      );
      client.release();
      res.status(200).json({ message: 'Password reset successfully' });
    } catch (error) {
      console.error('Reset confirm error:', error);
      res.status(500).json({ error: 'Internal error' });
    }
    return;
  }
  
  // ADD EMAIL
  if (path === 'add-email' && req.method === 'POST') {
    const { userId, email } = req.body;
    if (!userId || !email) {
      return res.status(400).json({ error: 'User ID and email required' });
    }
    
    try {
      const client = await pool.connect();
      const verifyToken = crypto.randomBytes(32).toString('hex');
      await client.query(
        'UPDATE users SET email = $1, email_verify_token = $2, email_verified = false WHERE id = $3',
        [email, verifyToken, userId]
      );
      const user = await client.query('SELECT username FROM users WHERE id = $1', [userId]);
      client.release();
      
      await sendVerificationEmail(email, user.rows[0]?.username || 'User', verifyToken);
      res.status(200).json({ message: 'Verification email sent' });
    } catch (error) {
      console.error('Add email error:', error);
      res.status(500).json({ error: 'Internal error' });
    }
    return;
  }
  
  // USER STATUS
  if (path === 'user-status' && req.method === 'GET') {
    const userId = url.searchParams.get('userId');
    if (!userId) {
      return res.status(400).json({ error: 'User ID required' });
    }
    
    try {
      const client = await pool.connect();
      const result = await client.query('SELECT email, email_verified FROM users WHERE id = $1', [userId]);
      client.release();
      res.status(200).json(result.rows[0] || {});
    } catch (error) {
      console.error('User status error:', error);
      res.status(500).json({ error: 'Internal error' });
    }
    return;
  }
  
  // CHATS LIST
  if (path === 'chats' && req.method === 'GET') {
    const userId = url.searchParams.get('userId');
    if (!userId) {
      return res.status(400).json({ error: 'User ID required' });
    }
    
    try {
      const client = await pool.connect();
      const result = await client.query(
        `SELECT c.id, c.type, c.name, 
          (SELECT json_agg(json_build_object('id', u.id, 'username', u.username))
           FROM chat_members cm2
           JOIN users u ON u.id = cm2.user_id
           WHERE cm2.chat_id = c.id) as members,
          (SELECT text FROM messages WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message
        FROM chats c
        JOIN chat_members cm ON cm.chat_id = c.id
        WHERE cm.user_id = $1`,
        [userId]
      );
      client.release();
      res.status(200).json(result.rows);
    } catch (error) {
      console.error('Chats error:', error);
      res.status(500).json({ error: 'Internal error' });
    }
    return;
  }
  
  // Ping (для проверки)
  if (path === 'ping') {
    return res.status(200).json({ status: 'ok', time: Date.now() });
  }
  
  // Not found
  res.status(404).json({ error: 'Not found', path });
}
