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

  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'All fields required' });
  }

  try {
    const client = await pool.connect();
    
    const existing = await client.query(
      'SELECT id FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );

    if (existing.rows.length > 0) {
      client.release();
      return res.status(400).json({ error: 'Username or email already exists' });
    }

    const result = await client.query(
      `INSERT INTO users (username, email, password, online, last_seen)
       VALUES ($1, $2, $3, true, NOW())
       RETURNING id, username`,
      [username, email, password]
    );

    client.release();
    res.status(200).json({ id: result.rows[0].id, username: result.rows[0].username });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
