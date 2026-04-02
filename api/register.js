import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL, {
  ssl: { rejectUnauthorized: false }
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'All fields required' });
  }

  try {
    // Проверяем существует ли пользователь
    const existing = await sql`
      SELECT id FROM users WHERE username = ${username}
    `;

    if (existing.length > 0) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    // Генерируем соль и хеш пароля
    const salt = Math.random().toString(36).substring(2, 15);
    const hash = require('crypto').createHash('sha256').update(password + salt).digest('hex');

    // Создаём пользователя
    const [user] = await sql`
      INSERT INTO users (username, email, password_hash, salt, online, last_seen)
      VALUES (${username}, ${email}, ${hash}, ${salt}, true, NOW())
      RETURNING id, username
    `;

    res.status(200).json({ id: user.id, username: user.username });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
