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

  const { user1Id, user2Id } = req.body;
  if (!user1Id || !user2Id) return res.status(400).json({ error: 'User IDs required' });

  try {
    const client = await pool.connect();
    const result = await client.query('SELECT create_private_chat($1, $2) as chat_id', [user1Id, user2Id]);
    client.release();
    res.status(200).json({ chatId: result.rows[0].chat_id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal error' });
  }
}
