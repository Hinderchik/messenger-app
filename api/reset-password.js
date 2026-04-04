import pg from 'pg';
import crypto from 'crypto';
import { sendResetPasswordEmail } from './_email.js';

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
  if (!login) return res.status(400).json({ error: 'Login required' });

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
    console.error(error);
    res.status(500).json({ error: 'Internal error' });
  }
}
