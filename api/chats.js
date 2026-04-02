import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Получить все чаты пользователя
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ error: 'User ID required' });
  }

  try {
    const client = await pool.connect();
    
    // Получаем чаты с последним сообщением
    const result = await client.query(
      `SELECT 
        c.id, c.type, c.name, c.avatar, c.description,
        (SELECT json_agg(json_build_object('id', u.id, 'username', u.username, 'online', u.online))
         FROM chat_members cm2
         JOIN users u ON u.id = cm2.user_id
         WHERE cm2.chat_id = c.id) as members,
        (SELECT text FROM messages WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
        (SELECT created_at FROM messages WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_time
      FROM chats c
      JOIN chat_members cm ON cm.chat_id = c.id
      WHERE cm.user_id = $1
      ORDER BY last_message_time DESC NULLS LAST`,
      [userId]
    );

    client.release();
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Chats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
