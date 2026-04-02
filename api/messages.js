import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { userId, chatId } = req.query;

    if (!userId || !chatId) {
      return res.status(400).json({ error: 'User ID and Chat ID required' });
    }

    try {
      const client = await pool.connect();
      
      const result = await client.query(
        `SELECT * FROM messages 
         WHERE (from_id = $1 AND to_id = $2) OR (from_id = $2 AND to_id = $1)
         ORDER BY created_at ASC LIMIT 100`,
        [userId, chatId]
      );

      client.release();
      res.status(200).json(result.rows);
    } catch (error) {
      console.error('Messages error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } 
  else if (req.method === 'POST') {
    const { fromId, toId, text } = req.body;

    if (!fromId || !toId || !text) {
      return res.status(400).json({ error: 'All fields required' });
    }

    try {
      const client = await pool.connect();
      
      const result = await client.query(
        `INSERT INTO messages (from_id, to_id, text, created_at)
         VALUES ($1, $2, $3, NOW())
         RETURNING *`,
        [fromId, toId, text]
      );

      client.release();
      res.status(200).json(result.rows[0]);
    } catch (error) {
      console.error('Send message error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } 
  else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
