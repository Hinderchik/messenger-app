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
  if (!token || !password) return res.status(400).json({ error: 'Token and password required' });

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
    console.error(error);
    res.status(500).json({ error: 'Internal error' });
  }
}
