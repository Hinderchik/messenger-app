import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL, {
  ssl: { rejectUnauthorized: false }
});

export default async function handler(req, res) {
  const { userId, chatId } = req.query;
  const { method } = req;

  if (method === 'GET') {
    // Получить сообщения
    if (!userId || !chatId) {
      return res.status(400).json({ error: 'User ID and Chat ID required' });
    }

    try {
      const messages = await sql`
        SELECT * FROM messages 
        WHERE (from_id = ${userId} AND to_id = ${chatId}) 
           OR (from_id = ${chatId} AND to_id = ${userId})
        ORDER BY created_at ASC
        LIMIT 100
      `;

      res.status(200).json(messages);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } 
  else if (method === 'POST') {
    // Отправить сообщение
    const { fromId, toId, text } = req.body;

    if (!fromId || !toId || !text) {
      return res.status(400).json({ error: 'All fields required' });
    }

    try {
      const [message] = await sql`
        INSERT INTO messages (from_id, to_id, text, created_at)
        VALUES (${fromId}, ${toId}, ${text}, NOW())
        RETURNING *
      `;

      res.status(200).json(message);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } 
  else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
