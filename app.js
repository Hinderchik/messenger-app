// Регистрация
if (document.getElementById('registerForm')) {
    document.getElementById('registerForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        
        try {
            const res = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, password })
            });
            
            const data = await res.json();
            
            if (!res.ok) throw new Error(data.error);
            
            document.getElementById('errorMsg').innerHTML = '<p style="color: green;">✅ Регистрация успешна! Войдите.</p>';
            setTimeout(() => window.location.href = 'login.html', 1500);
        } catch (error) {
            document.getElementById('errorMsg').innerHTML = '❌ ' + error.message;
        }
    });
}

// Вход
if (document.getElementById('loginForm')) {
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        
        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            
            const data = await res.json();
            
            if (!res.ok) throw new Error(data.error);
            
            localStorage.setItem('userId', data.id);
            localStorage.setItem('username', data.username);
            localStorage.setItem('email', user.email);
            window.location.href = 'chat.html';
        } catch (error) {
            document.getElementById('errorMsg').innerHTML = '❌ ' + error.message;
        }
    });
}

// Чат
if (window.location.pathname.includes('chat.html')) {
    let currentUserId = localStorage.getItem('userId');
    let currentChat = null;
    
    if (!currentUserId) {
        window.location.href = 'login.html';
    }
    
    document.getElementById('username').innerText = localStorage.getItem('username');
    document.getElementById('userAvatar').innerText = localStorage.getItem('username')[0].toUpperCase();
    
    async function loadUsers() {
        const res = await fetch(`/api/users?userId=${currentUserId}`);
        const users = await res.json();
        
        const usersList = document.getElementById('usersList');
        usersList.innerHTML = users.map(user => `
            <div class="user-item" data-id="${user.id}">
                <div class="user-avatar">${user.username[0].toUpperCase()}</div>
                <div class="user-name">${user.username}</div>
                <div class="online-dot" style="background: ${user.online ? '#4ade80' : '#ccc'}"></div>
            </div>
        `).join('');
        
        document.querySelectorAll('.user-item').forEach(el => {
            el.addEventListener('click', () => selectChat(el.dataset.id));
        });
    }
    
    async function selectChat(userId) {
        currentChat = userId;
        const userName = document.querySelector(`.user-item[data-id="${userId}"] .user-name`).innerText;
        document.getElementById('chatUserName').innerText = userName;
        document.getElementById('chatHeader').style.display = 'block';
        document.getElementById('inputArea').style.display = 'flex';
        document.getElementById('messagesArea').innerHTML = '';
        document.getElementById('chatAvatar').innerText = userName[0].toUpperCase();
        
        await loadMessages(userId);
    }
    
    async function loadMessages(chatId) {
        const res = await fetch(`/api/messages?userId=${currentUserId}&chatId=${chatId}`);
        const messages = await res.json();
        
        const messagesArea = document.getElementById('messagesArea');
        messagesArea.innerHTML = messages.map(msg => `
            <div class="message ${msg.from_id === currentUserId ? 'sent' : 'received'}">
                <div class="message-bubble">${escapeHtml(msg.text)}</div>
                <div class="message-time">${new Date(msg.created_at).toLocaleTimeString()}</div>
            </div>
        `).join('');
        
        messagesArea.scrollTop = messagesArea.scrollHeight;
    }
    
    async function sendMessage() {
        const input = document.getElementById('messageInput');
        const text = input.value.trim();
        if (!text || !currentChat) return;
        
        const res = await fetch('/api/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fromId: currentUserId,
                toId: currentChat,
                text: text
            })
        });
        
        if (res.ok) {
            input.value = '';
            await loadMessages(currentChat);
        }
    }
    
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    document.getElementById('sendBtn').addEventListener('click', sendMessage);
    document.getElementById('messageInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
    
    document.getElementById('logoutBtn').addEventListener('click', () => {
        localStorage.clear();
        window.location.href = 'login.html';
    });
    
    loadUsers();
    
    // Polling для обновления сообщений (проще чем WebSocket)
    setInterval(() => {
        if (currentChat) loadMessages(currentChat);
    }, 2000);
}
