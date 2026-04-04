import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Ответы/комментарии на сообщения
export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { messageId, userId, text } = req.body;
    
    try {
      const client = await pool.connect();
      const result = await client.query(
        'INSERT INTO messages (chat_id, from_id, text, reply_to) SELECT chat_id, $1, $2, $3 FROM messages WHERE id = $4 RETURNING *',
        [userId, text, messageId, messageId]
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
