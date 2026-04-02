import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ error: 'User ID required' });
  }

  // Проверяем, что userId - валидный UUID
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(userId)) {
    return res.status(400).json({ error: 'Invalid user ID format' });
  }

  try {
    const client = await pool.connect();
    
    const result = await client.query(
      'SELECT id, username, online, last_seen FROM users WHERE id != $1 ORDER BY online DESC, username ASC',
      [userId]
    );

    client.release();
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Users API error:', error);
    res.status(500).json({ error: error.message });
  }
}
