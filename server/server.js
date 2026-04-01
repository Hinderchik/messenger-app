const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Создаем папку для файлов
if (!fs.existsSync('./uploads')) fs.mkdirSync('./uploads');

// Настройка загрузки файлов
const storage = multer.diskStorage({
    destination: './uploads/',
    filename: (req, file, cb) => {
        cb(null, uuidv4() + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

// База данных SQLite (бесплатно, без установки)
const db = new sqlite3.Database('./messenger.db');

// Создание таблиц
db.serialize(() => {
    // Пользователи
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        email TEXT UNIQUE,
        password TEXT,
        avatar TEXT,
        status TEXT DEFAULT 'online',
        last_seen INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Сообщения
    db.run(`CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_user INTEGER,
        to_user INTEGER,
        text TEXT,
        file TEXT,
        file_type TEXT,
        read INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(from_user) REFERENCES users(id),
        FOREIGN KEY(to_user) REFERENCES users(id)
    )`);

    // Чаты
    db.run(`CREATE TABLE IF NOT EXISTS chats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user1 INTEGER,
        user2 INTEGER,
        last_message TEXT,
        last_message_time DATETIME,
        UNIQUE(user1, user2)
    )`);

    // Онлайн-соединения WebSocket
    db.run(`CREATE TABLE IF NOT EXISTS ws_connections (
        user_id INTEGER PRIMARY KEY,
        ws_id TEXT,
        last_ping INTEGER
    )`);
});

// JWT секрет
const JWT_SECRET = 'your-secret-key-change-this-2024';

// Хранилище WebSocket соединений
const connections = new Map();

// WebSocket сервер
wss.on('connection', (ws, req) => {
    let userId = null;

    ws.on('message', async (data) => {
        try {
            const message = JSON.parse(data);
            
            switch(message.type) {
                case 'auth':
                    const token = message.token;
                    try {
                        const decoded = jwt.verify(token, JWT_SECRET);
                        userId = decoded.userId;
                        connections.set(userId, ws);
                        
                        // Обновляем статус
                        db.run('UPDATE users SET status = ?, last_seen = ? WHERE id = ?', 
                            ['online', Date.now(), userId]);
                        
                        // Отправляем подтверждение
                        ws.send(JSON.stringify({ type: 'auth_success', userId }));
                        
                        // Рассылаем обновление статуса
                        broadcastStatus(userId, 'online');
                        
                        // Загружаем непрочитанные сообщения
                        loadUnreadMessages(userId, ws);
                    } catch(e) {
                        ws.send(JSON.stringify({ type: 'auth_failed', error: 'Invalid token' }));
                    }
                    break;
                    
                case 'message':
                    if (!userId) return;
                    
                    const { to, text, file, fileType } = message;
                    
                    // Сохраняем в БД
                    const stmt = db.prepare(
                        'INSERT INTO messages (from_user, to_user, text, file, file_type, read) VALUES (?, ?, ?, ?, ?, ?)'
                    );
                    stmt.run(userId, to, text || '', file || null, fileType || null, 0);
                    stmt.finalize();
                    
                    // Обновляем последнее сообщение в чате
                    updateLastChat(userId, to, text || '[Файл]');
                    
                    // Отправляем получателю если онлайн
                    const recipientWs = connections.get(to);
                    if (recipientWs && recipientWs.readyState === WebSocket.OPEN) {
                        recipientWs.send(JSON.stringify({
                            type: 'new_message',
                            from: userId,
                            text,
                            file,
                            fileType,
                            time: Date.now()
                        }));
                    }
                    
                    // Подтверждение отправителю
                    ws.send(JSON.stringify({ type: 'message_sent', to, text }));
                    break;
                    
                case 'typing':
                    const typingTo = message.to;
                    const typingWs = connections.get(typingTo);
                    if (typingWs && typingWs.readyState === WebSocket.OPEN) {
                        typingWs.send(JSON.stringify({
                            type: 'typing',
                            from: userId
                        }));
                    }
                    break;
                    
                case 'read':
                    const readFrom = message.from;
                    db.run('UPDATE messages SET read = 1 WHERE from_user = ? AND to_user = ? AND read = 0',
                        [readFrom, userId]);
                    break;
            }
        } catch(e) {
            console.error('WebSocket error:', e);
        }
    });
    
    ws.on('close', () => {
        if (userId) {
            connections.delete(userId);
            db.run('UPDATE users SET status = ?, last_seen = ? WHERE id = ?', 
                ['offline', Date.now(), userId]);
            broadcastStatus(userId, 'offline');
        }
    });
});

// Функции
async function broadcastStatus(userId, status) {
    const message = JSON.stringify({ type: 'status', userId, status });
    for (const [_, conn] of connections) {
        if (conn.readyState === WebSocket.OPEN) {
            conn.send(message);
        }
    }
}

async function loadUnreadMessages(userId, ws) {
    db.all(`
        SELECT m.*, u.username as from_name, u.avatar as from_avatar
        FROM messages m
        JOIN users u ON u.id = m.from_user
        WHERE m.to_user = ? AND m.read = 0
        ORDER BY m.created_at ASC
    `, [userId], (err, messages) => {
        if (!err && messages) {
            ws.send(JSON.stringify({ type: 'unread_messages', messages }));
            // Отмечаем как прочитанные
            db.run('UPDATE messages SET read = 1 WHERE to_user = ?', [userId]);
        }
    });
}

async function updateLastChat(user1, user2, lastMessage) {
    db.run(`
        INSERT INTO chats (user1, user2, last_message, last_message_time)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(user1, user2) DO UPDATE SET
        last_message = ?, last_message_time = ?
    `, [Math.min(user1, user2), Math.max(user1, user2), lastMessage, Date.now(), lastMessage, Date.now()]);
}

// REST API
app.post('/api/register', async (req, res) => {
    const { username, email, password } = req.body;
    
    if (!username || !email || !password) {
        return res.status(400).json({ error: 'All fields required' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    db.run('INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
        [username, email, hashedPassword],
        function(err) {
            if (err) {
                return res.status(400).json({ error: 'Username or email exists' });
            }
            
            const token = jwt.sign({ userId: this.lastID }, JWT_SECRET, { expiresIn: '7d' });
            res.json({ token, userId: this.lastID, username });
        }
    );
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    
    db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
        if (err || !user) {
            return res.status(400).json({ error: 'User not found' });
        }
        
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) {
            return res.status(400).json({ error: 'Invalid password' });
        }
        
        const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, userId: user.id, username: user.username, avatar: user.avatar });
    });
});

app.get('/api/users', (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        db.all('SELECT id, username, avatar, status, last_seen FROM users WHERE id != ?', 
            [decoded.userId], (err, users) => {
            res.json(users);
        });
    } catch(e) {
        res.status(401).json({ error: 'Invalid token' });
    }
});

app.get('/api/messages/:userId', (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const otherId = req.params.userId;
        
        db.all(`
            SELECT * FROM messages 
            WHERE (from_user = ? AND to_user = ?) OR (from_user = ? AND to_user = ?)
            ORDER BY created_at ASC LIMIT 100
        `, [decoded.userId, otherId, otherId, decoded.userId], (err, messages) => {
            res.json(messages);
        });
    } catch(e) {
        res.status(401).json({ error: 'Invalid token' });
    }
});

app.post('/api/upload', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file' });
    res.json({ filename: req.file.filename, path: `/uploads/${req.file.filename}` });
});

// Запуск сервера
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📡 WebSocket on ws://localhost:${PORT}`);
});