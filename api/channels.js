import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { name, description, createdBy } = req.body;
    
    try {
      const client = await pool.connect();
      const result = await client.query(
        'INSERT INTO chats (id, type, name, description, created_by) VALUES (gen_random_uuid(), $1, $2, $3, $4) RETURNING id',
        ['channel', name, description, createdBy]
      );
      
      // Добавляем создателя как админа
      await client.query(
        'INSERT INTO chat_members (chat_id, user_id, role) VALUES ($1, $2, $3)',
        [result.rows[0].id, createdBy, 'owner']
      );
      
      client.release();
      res.status(200).json({ chatId: result.rows[0].id });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal error' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
