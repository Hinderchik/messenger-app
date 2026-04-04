import pg from 'pg';
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

  const { userId, email } = req.body;

  if (!userId || !email) {
    return res.status(400).json({ error: 'User ID and email required' });
  }

  try {
    const client = await pool.connect();
    
    const existing = await client.query(
      'SELECT email FROM users WHERE email = $1 AND id != $2',
      [email, userId]
    );
    
    if (existing.rows.length > 0) {
      client.release();
      return res.status(400).json({ error: 'Email already in use' });
    }
    
    const verifyToken = crypto.randomBytes(32).toString('hex');
    
    await client.query(
      'UPDATE users SET email = $1, email_verify_token = $2, email_verified = false WHERE id = $3',
      [email, verifyToken, userId]
    );
    
    const userResult = await client.query(
      'SELECT username FROM users WHERE id = $1',
      [userId]
    );
    
    client.release();
    
    const username = userResult.rows[0]?.username || 'User';
    await sendVerificationEmail(email, username, verifyToken);
    
    res.status(200).json({ message: 'Verification email sent' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal error' });
  }
}
