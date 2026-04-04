import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Хранилище кодов (в памяти)
const codes = new Map();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code, email, token } = req.body;
  
  if (!code && !token) {
    return res.status(400).json({ error: 'Code or token required' });
  }

  try {
    const client = await pool.connect();
    let userId = null;
    
    // Поиск по токену
    if (token) {
      const userRes = await client.query('SELECT id FROM users WHERE email_verify_token = $1', [token]);
      if (userRes.rows.length > 0) {
        userId = userRes.rows[0].id;
      }
    }
    
    // Поиск по email и коду
    if (!userId && email && code) {
      const stored = codes.get(email);
      if (stored && stored.code === code && stored.expires > Date.now()) {
        const userRes = await client.query('SELECT id FROM users WHERE email = $1', [email]);
        if (userRes.rows.length > 0) {
          userId = userRes.rows[0].id;
        }
        codes.delete(email);
      }
    }
    
    if (!userId) {
      client.release();
      return res.status(400).json({ error: 'Неверный код или токен' });
    }
    
    await client.query('UPDATE users SET email_verified = true, email_verify_token = NULL WHERE id = $1', [userId]);
    client.release();
    
    res.status(200).json({ message: 'Email подтверждён!' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal error' });
  }
}
