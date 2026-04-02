import postgres from 'postgres';
import crypto from 'crypto';

const sql = postgres(process.env.DATABASE_URL, {
  ssl: { rejectUnauthorized: false }
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  try {
    const [user] = await sql`
      SELECT id, username, password_hash, salt FROM users WHERE username = ${username}
    `;

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const hash = crypto.createHash('sha256').update(password + user.salt).digest('hex');

    if (hash !== user.password_hash) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Обновляем статус онлайн
    await sql`
      UPDATE users SET online = true, last_seen = NOW() WHERE id = ${user.id}
    `;

    res.status(200).json({ id: user.id, username: user.username });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
