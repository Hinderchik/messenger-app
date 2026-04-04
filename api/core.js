import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export default async function handler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const action = url.searchParams.get('action');
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  // GET /api/core?action=users&userId=xxx
  if (action === 'users' && req.method === 'GET') {
    const { userId } = url.searchParams;
    if (!userId) return res.status(400).json({ error: 'User ID required' });
    
    try {
      const client = await pool.connect();
      const result = await client.query(
        'SELECT id, username, online FROM users WHERE id != $1 ORDER BY online DESC',
        [userId]
      );
      client.release();
      return res.status(200).json(result.rows);
    } catch (error) {
      return res.status(500).json({ error: 'Internal error' });
    }
  }
  
  // GET /api/core?action=chats&userId=xxx
  if (action === 'chats' && req.method === 'GET') {
    const { userId } = url.searchParams;
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
      return res.status(200).json(result.rows);
    } catch (error) {
      return res.status(500).json({ error: 'Internal error' });
    }
  }
  
  // POST /api/core?action=create-chat
  if (action === 'create-chat' && req.method === 'POST') {
    const { user1Id, user2Id } = req.body;
    if (!user1Id || !user2Id) return res.status(400).json({ error: 'User IDs required' });
    
    try {
      const client = await pool.connect();
      const result = await client.query('SELECT create_private_chat($1, $2) as chat_id', [user1Id, user2Id]);
      client.release();
      return res.status(200).json({ chatId: result.rows[0].chat_id });
    } catch (error) {
      return res.status(500).json({ error: 'Internal error' });
    }
  }
  
  // GET /api/core?action=messages&chatId=xxx
  if (action === 'messages' && req.method === 'GET') {
    const { chatId, limit = 50 } = url.searchParams;
    if (!chatId) return res.status(400).json({ error: 'Chat ID required' });
    
    try {
      const client = await pool.connect();
      const result = await client.query(
        'SELECT m.*, u.username as from_name FROM messages m JOIN users u ON u.id = m.from_id WHERE m.chat_id = $1 ORDER BY m.created_at ASC LIMIT $2',
        [chatId, limit]
      );
      client.release();
      return res.status(200).json(result.rows);
    } catch (error) {
      return res.status(500).json({ error: 'Internal error' });
    }
  }
  
  // POST /api/core?action=send-message
  if (action === 'send-message' && req.method === 'POST') {
    const { chatId, fromId, text } = req.body;
    if (!chatId || !fromId || !text) return res.status(400).json({ error: 'Missing fields' });
    
    try {
      const client = await pool.connect();
      const result = await client.query(
        'INSERT INTO messages (chat_id, from_id, text) VALUES ($1, $2, $3) RETURNING *',
        [chatId, fromId, text]
      );
      client.release();
      return res.status(200).json(result.rows[0]);
    } catch (error) {
      return res.status(500).json({ error: 'Internal error' });
    }
  }
  
  // POST /api/core?action=create-group
  if (action === 'create-group' && req.method === 'POST') {
    const { name, createdBy, members } = req.body;
    if (!name || !createdBy) return res.status(400).json({ error: 'Name and creator required' });
    
    try {
      const client = await pool.connect();
      const result = await client.query(
        'INSERT INTO chats (id, type, name, created_by) VALUES (gen_random_uuid(), $1, $2, $3) RETURNING id',
        ['group', name, createdBy]
      );
      const chatId = result.rows[0].id;
      
      await client.query('INSERT INTO chat_members (chat_id, user_id, role) VALUES ($1, $2, $3)', [chatId, createdBy, 'owner']);
      if (members && members.length) {
        for (const memberId of members) {
          await client.query('INSERT INTO chat_members (chat_id, user_id, role) VALUES ($1, $2, $3)', [chatId, memberId, 'member']);
        }
      }
      client.release();
      return res.status(200).json({ chatId });
    } catch (error) {
      return res.status(500).json({ error: 'Internal error' });
    }
  }
  
  // POST /api/core?action=create-channel
  if (action === 'create-channel' && req.method === 'POST') {
    const { name, description, createdBy } = req.body;
    if (!name || !createdBy) return res.status(400).json({ error: 'Name and creator required' });
    
    try {
      const client = await pool.connect();
      const result = await client.query(
        'INSERT INTO chats (id, type, name, description, created_by) VALUES (gen_random_uuid(), $1, $2, $3, $4) RETURNING id',
        ['channel', name, description, createdBy]
      );
      const chatId = result.rows[0].id;
      await client.query('INSERT INTO chat_members (chat_id, user_id, role) VALUES ($1, $2, $3)', [chatId, createdBy, 'owner']);
      client.release();
      return res.status(200).json({ chatId });
    } catch (error) {
      return res.status(500).json({ error: 'Internal error' });
    }
  }
  
  // GET /api/core?action=groups&userId=xxx
  if (action === 'groups' && req.method === 'GET') {
    const { userId } = url.searchParams;
    if (!userId) return res.status(400).json({ error: 'User ID required' });
    
    try {
      const client = await pool.connect();
      const result = await client.query(
        `SELECT c.id, c.name, 
          (SELECT text FROM messages WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message
        FROM chats c
        JOIN chat_members cm ON cm.chat_id = c.id
        WHERE c.type = 'group' AND cm.user_id = $1`,
        [userId]
      );
      client.release();
      return res.status(200).json(result.rows);
    } catch (error) {
      return res.status(500).json({ error: 'Internal error' });
    }
  }
  
  // GET /api/core?action=channels&userId=xxx
  if (action === 'channels' && req.method === 'GET') {
    const { userId } = url.searchParams;
    if (!userId) return res.status(400).json({ error: 'User ID required' });
    
    try {
      const client = await pool.connect();
      const result = await client.query(
        `SELECT c.id, c.name, c.description,
          (SELECT text FROM messages WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message
        FROM chats c
        JOIN chat_members cm ON cm.chat_id = c.id
        WHERE c.type = 'channel' AND cm.user_id = $1`,
        [userId]
      );
      client.release();
      return res.status(200).json(result.rows);
    } catch (error) {
      return res.status(500).json({ error: 'Internal error' });
    }
  }
  
  // POST /api/core?action=reply-message
  if (action === 'reply-message' && req.method === 'POST') {
    const { messageId, userId, text } = req.body;
    if (!messageId || !userId || !text) return res.status(400).json({ error: 'Missing fields' });
    
    try {
      const client = await pool.connect();
      const result = await client.query(
        'INSERT INTO messages (chat_id, from_id, text, reply_to) SELECT chat_id, $1, $2, $3 FROM messages WHERE id = $4 RETURNING *',
        [userId, text, messageId, messageId]
      );
      client.release();
      return res.status(200).json(result.rows[0]);
    } catch (error) {
      return res.status(500).json({ error: 'Internal error' });
    }
  }
  
  // POST /api/core?action=upload-avatar
  if (action === 'upload-avatar' && req.method === 'POST') {
    const { userId, avatar } = req.body;
    if (!userId || !avatar) return res.status(400).json({ error: 'User ID and avatar required' });
    
    try {
      const client = await pool.connect();
      await client.query('UPDATE users SET avatar = $1 WHERE id = $2', [avatar, userId]);
      client.release();
      return res.status(200).json({ message: 'Avatar updated' });
    } catch (error) {
      return res.status(500).json({ error: 'Internal error' });
    }
  }
  
  res.status(404).json({ error: 'Not found' });
}
