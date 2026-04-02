const API_URL = '';

if (document.getElementById('registerForm')) {
    document.getElementById('registerForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        try {
            const res = await fetch(`${API_URL}/api/register`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
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
                method: 'POST', headers: { 'Content-Type': 'application/json' },
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
    if (!currentUserId) window.location.href = '/login.html';
    document.getElementById('username').innerText = localStorage.getItem('username');
    document.getElementById('userAvatar').innerText = (localStorage.getItem('username') || 'U')[0].toUpperCase();
    
    async function loadUsers() {
        const res = await fetch(`${API_URL}/api/users?userId=${currentUserId}`);
        const users = await res.json();
        const container = document.getElementById('usersList');
        if (container) {
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
    }
    
    async function selectChat(userId) {
        currentChat = userId;
        const userName = document.querySelector(`.user-item[data-id="${userId}"] .user-name`).innerText;
        document.getElementById('chatUserName').innerText = userName;
        document.getElementById('chatHeader').style.display = 'flex';
        document.getElementById('inputArea').style.display = 'flex';
        document.getElementById('messagesArea').innerHTML = '';
        document.getElementById('chatAvatar').innerText = userName[0].toUpperCase();
        await loadMessages(userId);
    }
    
    async function loadMessages(chatId) {
        const res = await fetch(`${API_URL}/api/messages?userId=${currentUserId}&chatId=${chatId}`);
        const messages = await res.json();
        const container = document.getElementById('messagesArea');
        if (container) {
            container.innerHTML = messages.map(msg => `
                <div class="message ${msg.from_id === currentUserId ? 'sent' : 'received'}">
                    <div class="message-bubble">${escapeHtml(msg.text)}</div>
                    <div class="message-time">${new Date(msg.created_at).toLocaleTimeString()}</div>
                </div>
            `).join('');
            container.scrollTop = container.scrollHeight;
        }
    }
    
    async function sendMessage() {
        const input = document.getElementById('messageInput');
        const text = input.value.trim();
        if (!text || !currentChat) return;
        const res = await fetch(`${API_URL}/api/messages`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fromId: currentUserId, toId: currentChat, text })
        });
        if (res.ok) { input.value = ''; await loadMessages(currentChat); }
    }
    
    function escapeHtml(text) { const div = document.createElement('div'); div.textContent = text; return div.innerHTML; }
    
    document.getElementById('sendBtn')?.addEventListener('click', sendMessage);
    document.getElementById('messageInput')?.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });
    document.getElementById('logoutBtn')?.addEventListener('click', () => { localStorage.clear(); window.location.href = '/login.html'; });
    
    loadUsers();
    setInterval(() => { if (currentChat) loadMessages(currentChat); }, 3000);
}

if (window.location.pathname.includes('settings.html')) {
    const themeSwitch = document.getElementById('themeSwitch');
    const body = document.body;
    const savedTheme = localStorage.getItem('theme') || 'dark';
    body.classList.add(savedTheme);
    if (savedTheme === 'dark') themeSwitch?.classList.add('active');
    themeSwitch?.addEventListener('click', () => {
        if (body.classList.contains('dark')) {
            body.classList.remove('dark'); body.classList.add('light');
            localStorage.setItem('theme', 'light'); themeSwitch.classList.remove('active');
        } else {
            body.classList.remove('light'); body.classList.add('dark');
            localStorage.setItem('theme', 'dark'); themeSwitch.classList.add('active');
        }
    });
    const userId = localStorage.getItem('userId'), username = localStorage.getItem('username'), email = localStorage.getItem('email');
    document.getElementById('usernameDisplay').textContent = username || '—';
    document.getElementById('emailDisplay').textContent = email || '—';
    document.getElementById('userIdDisplay').textContent = userId ? userId.slice(0,8)+'...' : '—';
    document.getElementById('logoutBtnFull')?.addEventListener('click', () => { localStorage.clear(); window.location.href = '/login.html'; });
}

async function checkAuth() {
    const session = localStorage.getItem('userId');
    const path = window.location.pathname;
    if (!session && !path.includes('login') && !path.includes('register')) window.location.href = '/login.html';
    if (session && (path.includes('login') || path.includes('register'))) window.location.href = '/chat.html';
}
checkAuth();
