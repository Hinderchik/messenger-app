import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Создать группу
export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { name, createdBy, members } = req.body;
    
    try {
      const client = await pool.connect();
      const result = await client.query(
        'INSERT INTO chats (id, type, name, created_by) VALUES (gen_random_uuid(), $1, $2, $3) RETURNING id',
        ['group', name, createdBy]
      );
      const chatId = result.rows[0].id;
      
      // Добавляем создателя
      await client.query(
        'INSERT INTO chat_members (chat_id, user_id, role) VALUES ($1, $2, $3)',
        [chatId, createdBy, 'owner']
      );
      
      // Добавляем участников
      for (const memberId of members) {
        await client.query(
          'INSERT INTO chat_members (chat_id, user_id, role) VALUES ($1, $2, $3)',
          [chatId, memberId, 'member']
        );
      }
      
      client.release();
      res.status(200).json({ chatId });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal error' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
