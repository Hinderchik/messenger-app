// Определяем API URL в зависимости от окружения
const isElectron = typeof window !== 'undefined' && window.process && window.process.type === 'renderer';
const isCapacitor = typeof window !== 'undefined' && window.hasOwnProperty('Capacitor');

let API_URL = '';

if (isElectron || isCapacitor) {
    // Для нативных приложений — полный URL
    API_URL = 'https://messenger-app-roan-two.vercel.app';
} else {
    // Для веб-версии — относительный путь
    API_URL = '';
}

// Регистрация
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

// Вход
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

// Чат
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
            if (container && Array.isArray(users) && users.length > 0) {
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
            } else if (container && (!users || users.length === 0)) {
                container.innerHTML = '<div style="padding: 20px; text-align: center; color: #8e9eae;">Нет других пользователей</div>';
            }
        } catch (error) {
            console.error('Load users error:', error);
        }
    }
    
    async function selectChat(userId) {
        currentChat = userId;
        const userItem = document.querySelector(`.user-item[data-id="${userId}"]`);
        const userName = userItem ? userItem.querySelector('.user-name').innerText : 'Пользователь';
        document.getElementById('chatUserName').innerText = userName;
        document.getElementById('chatHeader').style.display = 'flex';
        document.getElementById('inputArea').style.display = 'flex';
        document.getElementById('messagesArea').innerHTML = '<div style="text-align: center; padding: 20px;">Загрузка сообщений...</div>';
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
                if (messages.length === 0) {
                    container.innerHTML = '<div style="text-align: center; padding: 20px; color: #8e9eae;">Нет сообщений. Напишите что-нибудь!</div>';
                } else {
                    container.innerHTML = messages.map(msg => `
                        <div class="message ${msg.from_id === currentUserId ? 'sent' : 'received'}">
                            <div class="message-bubble">${escapeHtml(msg.text)}</div>
                            <div class="message-time">${new Date(msg.created_at).toLocaleTimeString()}</div>
                        </div>
                    `).join('');
                }
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
    
    const backButton = document.getElementById('backButton');
    if (backButton) {
        backButton.addEventListener('click', () => {
            document.getElementById('sidebar').classList.remove('open');
        });
    }
    
    const userInfo = document.querySelector('.user-info');
    if (userInfo) {
        userInfo.addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('open');
        });
    }
    
    const fabBtn = document.getElementById('fabBtn');
    if (fabBtn) {
        fabBtn.addEventListener('click', () => {
            document.getElementById('createModal').classList.add('active');
        });
    }
    
    const cancelModal = document.getElementById('cancelModal');
    if (cancelModal) {
        cancelModal.addEventListener('click', () => {
            document.getElementById('createModal').classList.remove('active');
        });
    }
    
    const confirmCreate = document.getElementById('confirmCreate');
    if (confirmCreate) {
        confirmCreate.addEventListener('click', async () => {
            const type = document.getElementById('createType').value;
            const name = document.getElementById('createName').value;
            if (!name) {
                alert('Введите название');
                return;
            }
            alert(`Создание ${type === 'group' ? 'группы' : 'канала'} "${name}" пока в разработке`);
            document.getElementById('createModal').classList.remove('active');
        });
    }
    
    const tabs = document.querySelectorAll('.tab');
    const chatsList = document.getElementById('chatsList');
    const usersList = document.getElementById('usersList');
    const channelsList = document.getElementById('channelsList');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const tabName = tab.dataset.tab;
            if (tabName === 'chats') {
                if (chatsList) chatsList.style.display = 'block';
                if (usersList) usersList.style.display = 'none';
                if (channelsList) channelsList.style.display = 'none';
            } else if (tabName === 'users') {
                if (chatsList) chatsList.style.display = 'none';
                if (usersList) usersList.style.display = 'block';
                if (channelsList) channelsList.style.display = 'none';
                loadUsers();
            } else if (tabName === 'channels') {
                if (chatsList) chatsList.style.display = 'none';
                if (usersList) usersList.style.display = 'none';
                if (channelsList) channelsList.style.display = 'block';
            }
        });
    });
    
    loadUsers();
    
    setInterval(() => {
        if (currentChat) loadMessages(currentChat);
    }, 3000);
}

// Настройки
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
