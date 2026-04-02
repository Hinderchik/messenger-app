const API_URL = '';
let currentUserId = null;
let currentChatId = null;
let currentChatType = null;
let currentChatName = null;
let messagePolling = null;
let allUsers = [];

// Инициализация
document.addEventListener('DOMContentLoaded', async () => {
    currentUserId = localStorage.getItem('userId');
    const username = localStorage.getItem('username');
    
    if (!currentUserId && !window.location.pathname.includes('login') && !window.location.pathname.includes('register')) {
        window.location.href = '/login.html';
        return;
    }
    
    if (currentUserId && (window.location.pathname.includes('login') || window.location.pathname.includes('register'))) {
        window.location.href = '/chat.html';
        return;
    }
    
    if (window.location.pathname.includes('chat.html') && currentUserId) {
        document.getElementById('username').innerText = username || 'User';
        document.getElementById('userAvatar').innerText = (username || 'U')[0].toUpperCase();
        await loadChats();
        await loadContacts();
        setupEventListeners();
        startMessagePolling();
    }
});

// Загрузка чатов
async function loadChats() {
    try {
        const res = await fetch(`${API_URL}/api/chats?userId=${currentUserId}`);
        const chats = await res.json();
        const container = document.getElementById('chatsList');
        
        if (container && Array.isArray(chats)) {
            if (chats.length === 0) {
                container.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--tg-text-secondary);">Нет чатов. Начните диалог с контакта</div>';
            } else {
                container.innerHTML = chats.map(chat => `
                    <div class="chat-item" data-id="${chat.id}" data-type="${chat.type}" data-name="${chat.name || getChatName(chat)}">
                        <div class="chat-avatar">${(chat.name || getChatName(chat))[0].toUpperCase()}</div>
                        <div class="chat-info">
                            <div class="chat-name">${escapeHtml(chat.name || getChatName(chat))}</div>
                            <div class="chat-last-message">${escapeHtml(chat.last_message || 'Нет сообщений')}</div>
                        </div>
                        <div class="chat-time">${chat.last_message_time ? formatTime(chat.last_message_time) : ''}</div>
                    </div>
                `).join('');
                
                document.querySelectorAll('.chat-item').forEach(el => {
                    el.addEventListener('click', () => openChat(el.dataset.id, el.dataset.type, el.dataset.name));
                });
            }
        }
    } catch (error) {
        console.error('Load chats error:', error);
    }
}

// Загрузка контактов
async function loadContacts() {
    try {
        const res = await fetch(`${API_URL}/api/users?userId=${currentUserId}`);
        const users = await res.json();
        allUsers = users;
        const container = document.getElementById('contactsList');
        
        if (container && Array.isArray(users)) {
            if (users.length === 0) {
                container.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--tg-text-secondary);">Нет других пользователей</div>';
            } else {
                container.innerHTML = users.map(user => `
                    <div class="contact-item" data-id="${user.id}" data-name="${user.username}">
                        <div class="contact-avatar">
                            ${user.username[0].toUpperCase()}
                            <div class="online-dot" style="background: ${user.online ? 'var(--tg-online)' : '#6b7280'}"></div>
                        </div>
                        <div class="contact-info">
                            <div class="contact-name">${escapeHtml(user.username)}</div>
                            <div class="contact-status">${user.online ? 'В сети' : 'Был(а) недавно'}</div>
                        </div>
                    </div>
                `).join('');
                
                document.querySelectorAll('.contact-item').forEach(el => {
                    el.addEventListener('click', () => startPrivateChat(el.dataset.id, el.dataset.name));
                });
            }
        }
    } catch (error) {
        console.error('Load contacts error:', error);
    }
}

// Начать личный чат
async function startPrivateChat(userId, userName) {
    try {
        const res = await fetch(`${API_URL}/api/create-chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user1Id: currentUserId, user2Id: userId })
        });
        const data = await res.json();
        if (data.chatId) {
            openChat(data.chatId, 'private', userName);
            await loadChats();
        }
    } catch (error) {
        console.error('Start chat error:', error);
    }
}

// Открыть чат
async function openChat(chatId, type, name) {
    currentChatId = chatId;
    currentChatType = type;
    currentChatName = name;
    
    document.getElementById('chatName').innerText = name;
    document.getElementById('chatHeader').style.display = 'flex';
    document.getElementById('inputArea').style.display = 'flex';
    document.getElementById('messagesArea').innerHTML = '<div style="text-align: center; padding: 20px;">Загрузка сообщений...</div>';
    
    // На мобилках закрываем сайдбар
    if (window.innerWidth <= 768) {
        document.getElementById('sidebar').classList.remove('open');
    }
    
    await loadMessages(chatId);
}

// Загрузка сообщений
async function loadMessages(chatId) {
    try {
        const res = await fetch(`${API_URL}/api/messages?chatId=${chatId}&limit=50`);
        const messages = await res.json();
        const container = document.getElementById('messagesArea');
        
        if (container && Array.isArray(messages)) {
            if (messages.length === 0) {
                container.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--tg-text-secondary);">Нет сообщений. Напишите что-нибудь!</div>';
            } else {
                container.innerHTML = messages.map(msg => `
                    <div class="message ${msg.from_id === currentUserId ? 'sent' : 'received'}">
                        <div class="message-bubble">${escapeHtml(msg.text || '[Файл]')}</div>
                        <div class="message-time">${formatTime(msg.created_at)}</div>
                    </div>
                `).join('');
            }
            container.scrollTop = container.scrollHeight;
        }
    } catch (error) {
        console.error('Load messages error:', error);
    }
}

// Отправка сообщения
async function sendMessage() {
    const input = document.getElementById('messageInput');
    const text = input.value.trim();
    if (!text || !currentChatId) return;
    
    try {
        const res = await fetch(`${API_URL}/api/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chatId: currentChatId,
                fromId: currentUserId,
                text: text
            })
        });
        
        if (res.ok) {
            input.value = '';
            await loadMessages(currentChatId);
            // Обновляем список чатов для отображения последнего сообщения
            await loadChats();
        }
    } catch (error) {
        console.error('Send message error:', error);
    }
}

// Получить имя чата (для личных диалогов)
function getChatName(chat) {
    if (chat.type === 'private' && chat.members) {
        const other = chat.members.find(m => m.id !== currentUserId);
        return other ? other.username : 'Чат';
    }
    return chat.name || 'Чат';
}

// Форматирование времени
function formatTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
}

// Эскейп HTML
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Поиск
function setupSearch() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            const activeTab = document.querySelector('.tab.active').dataset.tab;
            
            if (activeTab === 'contacts') {
                const items = document.querySelectorAll('.contact-item');
                items.forEach(item => {
                    const name = item.dataset.name.toLowerCase();
                    item.style.display = name.includes(query) ? 'flex' : 'none';
                });
            }
        });
    }
}

// Табы
function setupTabs() {
    const tabs = document.querySelectorAll('.tab');
    const chatsList = document.getElementById('chatsList');
    const contactsList = document.getElementById('contactsList');
    const groupsList = document.getElementById('groupsList');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const tabName = tab.dataset.tab;
            
            if (tabName === 'chats') {
                if (chatsList) chatsList.style.display = 'block';
                if (contactsList) contactsList.style.display = 'none';
                if (groupsList) groupsList.style.display = 'none';
                loadChats();
            } else if (tabName === 'contacts') {
                if (chatsList) chatsList.style.display = 'none';
                if (contactsList) contactsList.style.display = 'block';
                if (groupsList) groupsList.style.display = 'none';
                loadContacts();
            } else if (tabName === 'groups') {
                if (chatsList) chatsList.style.display = 'none';
                if (contactsList) contactsList.style.display = 'none';
                if (groupsList) groupsList.style.display = 'block';
            }
        });
    });
}

// Мобильное меню
function setupMobileMenu() {
    const userInfo = document.querySelector('.user-info');
    const backButton = document.getElementById('backButton');
    
    if (userInfo) {
        userInfo.addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('open');
        });
    }
    
    if (backButton) {
        backButton.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                document.getElementById('sidebar').classList.add('open');
                currentChatId = null;
                document.getElementById('chatHeader').style.display = 'none';
                document.getElementById('inputArea').style.display = 'none';
                document.getElementById('messagesArea').innerHTML = '<div class="empty-chat">Выберите чат для начала общения</div>';
            }
        });
    }
}

// FAB кнопка
function setupFAB() {
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
            document.getElementById('createName').value = '';
        });
    }
}

// Поллинг сообщений
function startMessagePolling() {
    if (messagePolling) clearInterval(messagePolling);
    messagePolling = setInterval(() => {
        if (currentChatId) {
            loadMessages(currentChatId);
        }
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
    
    document.getElementById('usernameDisplay').textContent = username || '—';
    document.getElementById('emailDisplay').textContent = email || '—';
    document.getElementById('userIdDisplay').textContent = userId ? userId.slice(0,8)+'...' : '—';
    
    const logoutBtnFull = document.getElementById('logoutBtnFull');
    if (logoutBtnFull) {
        logoutBtnFull.addEventListener('click', () => {
            localStorage.clear();
            window.location.href = '/login.html';
        });
    }
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

// Общие обработчики
function setupEventListeners() {
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
    
    setupTabs();
    setupSearch();
    setupMobileMenu();
    setupFAB();
}

// Регистрация Service Worker для PWA
if ('serviceWorker' in navigator && !window.location.pathname.includes('login') && !window.location.pathname.includes('register')) {
    navigator.serviceWorker.register('/sw.js').catch(err => console.log('SW registration failed:', err));
}

// Регистрация Service Worker для PWA
if ('serviceWorker' in navigator && !window.location.pathname.includes('login') && !window.location.pathname.includes('register')) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => console.log('SW registered:', reg))
            .catch(err => console.log('SW registration failed:', err));
    });
}

// Запрос разрешения на уведомления
if ('Notification' in window && !window.location.pathname.includes('login') && !window.location.pathname.includes('register')) {
    if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
        setTimeout(() => {
            Notification.requestPermission();
        }, 5000);
    }
}
