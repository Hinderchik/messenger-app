import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export default async function handler(req, res) {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'User ID required' });

  try {
    const client = await pool.connect();
    const result = await client.query(
      `SELECT c.id, c.type, c.name, 
        (SELECT json_agg(json_build_object('id', u.id, 'username', u.username))
         FROM chat_members cm2
         JOIN users u ON u.id = cm2.user_id
         WHERE cm2.chat_id = c.id) as members,
        (SELECT text FROM messages WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message
      FROM chats c
      JOIN chat_members cm ON cm.chat_id = c.id
      WHERE cm.user_id = $1`,
      [userId]
    );
    client.release();
    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal error' });
  }
}
