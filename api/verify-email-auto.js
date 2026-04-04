import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'User ID required' });

  try {
    const client = await pool.connect();
    await client.query('UPDATE users SET email_verified = true WHERE id = $1', [userId]);
    client.release();
    res.status(200).json({ message: 'Email verified' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal error' });
  }
}
