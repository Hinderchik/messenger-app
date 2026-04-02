-- Полная база данных для мессенджера

-- Пользователи
CREATE TABLE IF NOT EXISTS users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    avatar TEXT,
    bio TEXT,
    online BOOLEAN DEFAULT false,
    last_seen TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Чаты (личные и групповые)
CREATE TABLE IF NOT EXISTS chats (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    type TEXT DEFAULT 'private', -- private, group, channel
    name TEXT,
    avatar TEXT,
    description TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Участники чатов
CREATE TABLE IF NOT EXISTS chat_members (
    chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'member', -- owner, admin, member
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (chat_id, user_id)
);

-- Сообщения
CREATE TABLE IF NOT EXISTS messages (
    id BIGSERIAL PRIMARY KEY,
    chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
    from_id UUID REFERENCES users(id) ON DELETE CASCADE,
    text TEXT,
    file_url TEXT,
    file_type TEXT,
    reply_to BIGINT REFERENCES messages(id),
    is_edited BOOLEAN DEFAULT false,
    is_deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Реакции на сообщения
CREATE TABLE IF NOT EXISTS message_reactions (
    message_id BIGINT REFERENCES messages(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    reaction TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (message_id, user_id)
);

-- Индексы
CREATE INDEX idx_messages_chat ON messages(chat_id, created_at);
CREATE INDEX idx_messages_from ON messages(from_id);
CREATE INDEX idx_chat_members_user ON chat_members(user_id);
CREATE INDEX idx_chat_members_chat ON chat_members(chat_id);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_online ON users(online);

-- Функция для создания личного чата
CREATE OR REPLACE FUNCTION create_private_chat(user1_id UUID, user2_id UUID)
RETURNS UUID AS $$
DECLARE
    chat_id UUID;
BEGIN
    -- Проверяем, существует ли уже чат между пользователями
    SELECT c.id INTO chat_id
    FROM chats c
    JOIN chat_members cm1 ON cm1.chat_id = c.id
    JOIN chat_members cm2 ON cm2.chat_id = c.id
    WHERE c.type = 'private'
      AND cm1.user_id = user1_id
      AND cm2.user_id = user2_id;
    
    IF chat_id IS NULL THEN
        -- Создаём новый чат
        INSERT INTO chats (id, type) VALUES (gen_random_uuid(), 'private')
        RETURNING id INTO chat_id;
        
        -- Добавляем участников
        INSERT INTO chat_members (chat_id, user_id, role) VALUES
            (chat_id, user1_id, 'member'),
            (chat_id, user2_id, 'member');
    END IF;
    
    RETURN chat_id;
END;
$$ LANGUAGE plpgsql;

-- Триггер для обновления last_seen
CREATE OR REPLACE FUNCTION update_last_seen()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE users SET last_seen = NOW() WHERE id = NEW.user_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_last_seen_trigger
AFTER INSERT ON messages
FOR EACH ROW
EXECUTE FUNCTION update_last_seen();
