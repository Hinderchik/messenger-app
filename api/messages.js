import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { chatId } = req.query;
    if (!chatId) return res.status(400).json({ error: 'Chat ID required' });

    try {
      const client = await pool.connect();
      const result = await client.query(
        'SELECT m.*, u.username as from_name FROM messages m JOIN users u ON u.id = m.from_id WHERE m.chat_id = $1 ORDER BY m.created_at ASC LIMIT 100',
        [chatId]
      );
      client.release();
      res.status(200).json(result.rows);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal error' });
    }
  } else if (req.method === 'POST') {
    const { chatId, fromId, text } = req.body;
    if (!chatId || !fromId || !text) return res.status(400).json({ error: 'Missing fields' });

    try {
      const client = await pool.connect();
      const result = await client.query(
        'INSERT INTO messages (chat_id, from_id, text) VALUES ($1, $2, $3) RETURNING *',
        [chatId, fromId, text]
      );
      client.release();
      res.status(200).json(result.rows[0]);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal error' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
