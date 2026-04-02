const API_URL = '';

if (document.getElementById('registerForm')) {
    document.getElementById('registerForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        try {
            const res = await fetch(`${API_URL}/api/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, password })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            document.getElementById('errorMsg').innerHTML = '<p style="color: #4ade80;">✅ Регистрация успешна! Войдите.</p>';
            setTimeout(() => window.location.href = '/login.html', 1500);
        } catch (error) {
            document.getElementById('errorMsg').innerHTML = '❌ ' + error.message;
        }
    });
}

if (document.getElementById('loginForm')) {
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        try {
            const res = await fetch(`${API_URL}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            localStorage.setItem('userId', data.id);
            localStorage.setItem('username', data.username);
            window.location.href = '/chat.html';
        } catch (error) {
            document.getElementById('errorMsg').innerHTML = '❌ ' + error.message;
        }
    });
}

if (window.location.pathname.includes('chat.html')) {
    let currentUserId = localStorage.getItem('userId');
    let currentChat = null;
    
    if (!currentUserId) {
        window.location.href = '/login.html';
    }
    
    document.getElementById('username').innerText = localStorage.getItem('username');
    const avatar = document.getElementById('userAvatar');
    if (avatar) {
        avatar.innerText = (localStorage.getItem('username') || 'U')[0].toUpperCase();
    }
    
    async function loadUsers() {
        try {
            const res = await fetch(`${API_URL}/api/users?userId=${currentUserId}`);
            const users = await res.json();
            const container = document.getElementById('usersList');
            if (container && Array.isArray(users)) {
                container.innerHTML = users.map(user => `
                    <div class="user-item" data-id="${user.id}">
                        <div class="user-avatar">${(user.username || 'U')[0].toUpperCase()}</div>
                        <div class="user-name">${user.username}</div>
                        <div class="online-dot" style="background: ${user.online ? '#4ade80' : '#6b7280'}"></div>
                    </div>
                `).join('');
                document.querySelectorAll('.user-item').forEach(el => {
                    el.addEventListener('click', () => selectChat(el.dataset.id));
                });
            }
        } catch (error) {
            console.error('Load users error:', error);
        }
    }
    
    async function selectChat(userId) {
        currentChat = userId;
        const userName = document.querySelector(`.user-item[data-id="${userId}"] .user-name`).innerText;
        document.getElementById('chatUserName').innerText = userName;
        document.getElementById('chatHeader').style.display = 'flex';
        document.getElementById('inputArea').style.display = 'flex';
        document.getElementById('messagesArea').innerHTML = '';
        const chatAvatar = document.getElementById('chatAvatar');
        if (chatAvatar) {
            chatAvatar.innerText = userName[0].toUpperCase();
        }
        await loadMessages(userId);
    }
    
    async function loadMessages(chatId) {
        try {
            const res = await fetch(`${API_URL}/api/messages?userId=${currentUserId}&chatId=${chatId}`);
            const messages = await res.json();
            const container = document.getElementById('messagesArea');
            if (container && Array.isArray(messages)) {
                container.innerHTML = messages.map(msg => `
                    <div class="message ${msg.from_id === currentUserId ? 'sent' : 'received'}">
                        <div class="message-bubble">${escapeHtml(msg.text)}</div>
                        <div class="message-time">${new Date(msg.created_at).toLocaleTimeString()}</div>
                    </div>
                `).join('');
                container.scrollTop = container.scrollHeight;
            }
        } catch (error) {
            console.error('Load messages error:', error);
        }
    }
    
    async function sendMessage() {
        const input = document.getElementById('messageInput');
        const text = input.value.trim();
        if (!text || !currentChat) return;
        try {
            const res = await fetch(`${API_URL}/api/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fromId: currentUserId, toId: currentChat, text })
            });
            if (res.ok) {
                input.value = '';
                await loadMessages(currentChat);
            }
        } catch (error) {
            console.error('Send message error:', error);
        }
    }
    
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    const sendBtn = document.getElementById('sendBtn');
    if (sendBtn) sendBtn.addEventListener('click', sendMessage);
    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });
    }
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.clear();
            window.location.href = '/login.html';
        });
    }
    
    loadUsers();
    setInterval(() => {
        if (currentChat) loadMessages(currentChat);
    }, 3000);
}

if (window.location.pathname.includes('settings.html')) {
    const themeSwitch = document.getElementById('themeSwitch');
    const body = document.body;
    const savedTheme = localStorage.getItem('theme') || 'dark';
    body.classList.add(savedTheme);
    if (savedTheme === 'dark' && themeSwitch) themeSwitch.classList.add('active');
    if (themeSwitch) {
        themeSwitch.addEventListener('click', () => {
            if (body.classList.contains('dark')) {
                body.classList.remove('dark');
                body.classList.add('light');
                localStorage.setItem('theme', 'light');
                themeSwitch.classList.remove('active');
            } else {
                body.classList.remove('light');
                body.classList.add('dark');
                localStorage.setItem('theme', 'dark');
                themeSwitch.classList.add('active');
            }
        });
    }
    const userId = localStorage.getItem('userId');
    const username = localStorage.getItem('username');
    const email = localStorage.getItem('email');
    const usernameDisplay = document.getElementById('usernameDisplay');
    if (usernameDisplay) usernameDisplay.textContent = username || '—';
    const emailDisplay = document.getElementById('emailDisplay');
    if (emailDisplay) emailDisplay.textContent = email || '—';
    const userIdDisplay = document.getElementById('userIdDisplay');
    if (userIdDisplay) userIdDisplay.textContent = userId ? userId.slice(0,8)+'...' : '—';
    const logoutBtnFull = document.getElementById('logoutBtnFull');
    if (logoutBtnFull) {
        logoutBtnFull.addEventListener('click', () => {
            localStorage.clear();
            window.location.href = '/login.html';
        });
    }
}

async function checkAuth() {
    const session = localStorage.getItem('userId');
    const path = window.location.pathname;
    if (!session && !path.includes('login') && !path.includes('register')) {
        window.location.href = '/login.html';
    }
    if (session && (path.includes('login') || path.includes('register'))) {
        window.location.href = '/chat.html';
    }
}
checkAuth();
