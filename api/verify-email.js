import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export default async function handler(req, res) {
  const { token } = req.query;
  
  if (!token) {
    return res.status(400).json({ error: 'Token required' });
  }
  
  try {
    const client = await pool.connect();
    const result = await client.query(
      'SELECT id FROM users WHERE email_verify_token = $1',
      [token]
    );
    
    if (result.rows.length === 0) {
      client.release();
      return res.status(400).json({ error: 'Invalid token' });
    }
    
    await client.query('UPDATE users SET email_verified = true, email_verify_token = NULL WHERE id = $1', [result.rows[0].id]);
    client.release();
    
    // Редирект на страницу входа
    res.writeHead(302, { Location: '/login.html?verified=true' });
    res.end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal error' });
  }
}
