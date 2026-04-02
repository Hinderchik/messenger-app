import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { chatId, limit = 50, before } = req.query;

    if (!chatId) {
      return res.status(400).json({ error: 'Chat ID required' });
    }

    try {
      const client = await pool.connect();
      
      let query = `
        SELECT m.*, u.username as from_name, u.avatar as from_avatar
        FROM messages m
        JOIN users u ON u.id = m.from_id
        WHERE m.chat_id = $1
      `;
      const params = [chatId];
      
      if (before) {
        query += ` AND m.created_at < $2`;
        params.push(before);
      }
      
      query += ` ORDER BY m.created_at DESC LIMIT $${params.length + 1}`;
      params.push(limit);
      
      const result = await client.query(query, params);
      
      client.release();
      res.status(200).json(result.rows.reverse());
    } catch (error) {
      console.error('Messages error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } 
  else if (req.method === 'POST') {
    const { chatId, fromId, text, replyTo, fileUrl, fileType } = req.body;

    if (!chatId || !fromId || (!text && !fileUrl)) {
      return res.status(400).json({ error: 'Chat ID, from ID and text or file required' });
    }

    try {
      const client = await pool.connect();
      
      const result = await client.query(
        `INSERT INTO messages (chat_id, from_id, text, reply_to, file_url, file_type)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [chatId, fromId, text || null, replyTo || null, fileUrl || null, fileType || null]
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
