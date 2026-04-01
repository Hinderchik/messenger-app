CREATE TABLE IF NOT EXISTS users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    salt TEXT NOT NULL,
    session TEXT,
    online INTEGER DEFAULT 0,
    in_call INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS messages (
    id BIGSERIAL PRIMARY KEY,
    from_id UUID REFERENCES users(id) ON DELETE CASCADE,
    to_id UUID REFERENCES users(id) ON DELETE CASCADE,
    text TEXT,
    time BIGINT,
    type TEXT DEFAULT 'text',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_from_to ON messages(from_id, to_id);
CREATE INDEX idx_messages_time ON messages(time DESC);

ALTER TABLE users REPLICA IDENTITY FULL;
ALTER TABLE messages REPLICA IDENTITY FULL;

CREATE OR REPLACE FUNCTION login(username TEXT, password TEXT)
RETURNS JSON AS $$
DECLARE
    user_record RECORD;
    session_id TEXT;
BEGIN
    SELECT * INTO user_record FROM users WHERE users.username = login.username;
    
    IF user_record.id IS NULL THEN
        RETURN json_build_object('error', 'User not found');
    END IF;
    
    IF user_record.password != encode(sha256(login.password || user_record.salt), 'hex') THEN
        RETURN json_build_object('error', 'Invalid password');
    END IF;
    
    session_id := encode(gen_random_bytes(32), 'hex');
    
    UPDATE users SET session = session_id, online = 1 WHERE id = user_record.id;
    
    RETURN json_build_object('session', session_id, 'id', user_record.id, 'username', user_record.username);
END;
$$ LANGUAGE plpgsql;