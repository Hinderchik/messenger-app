import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export default async function handler(req, res) {
  try {
    const client = await pool.connect();
    const time = await client.query('SELECT NOW() as time');
    const users = await client.query('SELECT id, username, online FROM users LIMIT 5');
    client.release();
    
    res.status(200).json({ 
      connected: true, 
      time: time.rows[0].time,
      users_count: users.rows.length,
      sample_users: users.rows
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
