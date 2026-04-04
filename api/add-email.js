import pg from 'pg';
import crypto from 'crypto';
import { sendVerificationEmail } from './_email.js';

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
  if (!userId || !email) return res.status(400).json({ error: 'User ID and email required' });

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
    console.error(error);
    res.status(500).json({ error: 'Internal error' });
  }
}
