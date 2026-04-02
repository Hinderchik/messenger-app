import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export default async function handler(req, res) {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as time');
    const users = await client.query('SELECT COUNT(*) FROM users');
    client.release();
    
    res.status(200).json({ 
      connected: true, 
      time: result.rows[0].time,
      users_count: users.rows[0].count
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
