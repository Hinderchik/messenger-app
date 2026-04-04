const API_URL = "";

// Регистрация
if (document.getElementById('registerForm')) {
    document.getElementById('registerForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const email = document.getElementById('email').value || null;
        const password = document.getElementById('password').value;
        
        const msgDiv = document.getElementById('errorMsg');
        msgDiv.innerHTML = '⏳ Регистрация...';
        
        try {
            const res = await fetch(`${API_URL}/api/auth?action=register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, password })
            });
            const data = await res.json();
            
            if (!res.ok) throw new Error(data.error);
            
            msgDiv.innerHTML = '✅ Регистрация успешна! Теперь войдите.';
            msgDiv.className = 'success';
            setTimeout(() => window.location.href = '/login.html', 1500);
        } catch (error) {
            msgDiv.innerHTML = '❌ ' + error.message;
            msgDiv.className = 'error';
        }
    });
}

// Вход
if (document.getElementById('loginForm')) {
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const login = document.getElementById('login').value;
        const password = document.getElementById('password').value;
        
        const msgDiv = document.getElementById('message');
        msgDiv.innerHTML = '⏳ Вход...';
        
        try {
            const res = await fetch(`${API_URL}/api/auth?action=login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ login, password })
            });
            const data = await res.json();
            
            if (!res.ok) throw new Error(data.error);
            
            localStorage.setItem('userId', data.id);
            localStorage.setItem('username', data.username);
            localStorage.setItem('email', data.email || '');
            localStorage.setItem('emailVerified', data.emailVerified || false);
            window.location.href = '/chat.html';
        } catch (error) {
            msgDiv.innerHTML = '❌ ' + error.message;
            if (error.message.includes('verify email')) {
                document.getElementById('resendLink').style.display = 'block';
                document.getElementById('resendLink').onclick = async () => {
                    const res = await fetch(`${API_URL}/api/resend-verification`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ login })
                    });
                    const data = await res.json();
                    msgDiv.innerHTML = data.message || 'Письмо отправлено';
                };
            }
        }
    });
}

// Чат
if (window.location.pathname.includes('chat.html')) {
    let currentUserId = localStorage.getItem('userId');
    let currentUsername = localStorage.getItem('username');
    let currentUserVerified = localStorage.getItem('emailVerified') === 'true';
    let currentChatId = null;
    
    if (!currentUserId) window.location.href = '/login.html';
    
    document.getElementById('username').innerText = currentUsername || 'User';
    document.getElementById('userAvatar').innerText = (currentUsername || 'U')[0].toUpperCase();
    
    function updateRestrictedUI() {
        const warning = document.getElementById('restrictedWarning');
        if (warning) {
            warning.style.display = currentUserVerified ? 'none' : 'block';
        }
    }
    updateRestrictedUI();
    
    document.getElementById('openSettings').onclick = () => { window.location.href = '/settings.html'; };
    document.getElementById('settingsBtn').onclick = () => { window.location.href = '/settings.html'; };
    
    function openChat(chatId, name) {
        currentChatId = chatId;
        document.getElementById('chatName').innerText = name;
        document.getElementById('chatScreen').classList.add('open');
        loadMessages();
    }
    
    document.getElementById('backBtn').onclick = () => {
        document.getElementById('chatScreen').classList.remove('open');
        currentChatId = null;
    };
    
    document.getElementById('callBtn').onclick = () => { alert('Звонок в разработке'); };
    document.getElementById('infoBtn').onclick = () => { alert('Информация о чате'); };
    
    async function loadChats() {
        try {
            const res = await fetch(`${API_URL}/api/chats?userId=${currentUserId}`);
            const chats = await res.json();
            const container = document.getElementById('chatsList');
            if (container) {
                if (chats.length === 0) {
                    container.innerHTML = '<div style="padding: 20px; text-align: center; color: #8e9eae;">Нет чатов</div>';
                } else {
                    container.innerHTML = chats.map(chat => {
                        let name = chat.name;
                        if (chat.type === 'private' && chat.members) {
                            const other = chat.members.find(m => m.id !== currentUserId);
                            name = other ? other.username : 'Чат';
                        }
                        return `<div class="chat-item" onclick="openChat('${chat.id}', '${escapeHtml(name)}')">
                            <div class="chat-avatar">${(name || 'C')[0].toUpperCase()}</div>
                            <div class="chat-info">
                                <div class="chat-name">${escapeHtml(name)}</div>
                                <div class="chat-message">${escapeHtml(chat.last_message || 'Нет сообщений')}</div>
                            </div>
                        </div>`;
                    }).join('');
                }
            }
        } catch(e) { console.error(e); }
    }
    
    async function loadContacts() {
        try {
            const res = await fetch(`${API_URL}/api/users?userId=${currentUserId}`);
            const users = await res.json();
            const container = document.getElementById('contactsList');
            if (container) {
                if (users.length === 0) {
                    container.innerHTML = '<div style="padding: 20px; text-align: center; color: #8e9eae;">Нет других пользователей</div>';
                } else {
                    container.innerHTML = users.map(user => `<div class="contact-item" onclick="startChat('${user.id}', '${user.username}')">
                        <div class="contact-avatar">
                            ${user.username[0].toUpperCase()}
                            <div class="online-dot" style="background: ${user.online ? '#4ade80' : '#6b7280'}"></div>
                        </div>
                        <div class="contact-info">
                            <div class="contact-name">${escapeHtml(user.username)}</div>
                            <div class="contact-status">${user.online ? 'В сети' : 'Был недавно'}</div>
                        </div>
                    </div>`).join('');
                }
            }
        } catch(e) { console.error(e); }
    }
    
    async function startChat(userId, userName) {
        if (!currentUserVerified) {
            alert('Для создания чата необходимо подтвердить email. Перейдите в настройки.');
            return;
        }
        
        try {
            const res = await fetch(`${API_URL}/api/create-chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user1Id: currentUserId, user2Id: userId })
            });
            const data = await res.json();
            if (data.chatId) openChat(data.chatId, userName);
            loadChats();
        } catch(e) { console.error(e); }
    }
    
    async function loadMessages() {
        if (!currentChatId) return;
        try {
            const res = await fetch(`${API_URL}/api/messages?chatId=${currentChatId}&limit=50`);
            const messages = await res.json();
            const container = document.getElementById('messages');
            if (container) {
                if (messages.length === 0) {
                    container.innerHTML = '<div class="empty-chat">Нет сообщений</div>';
                } else {
                    container.innerHTML = messages.map(msg => `<div class="message ${msg.from_id === currentUserId ? 'sent' : 'received'}">
                        <div class="bubble">${escapeHtml(msg.text || '[Файл]')}</div>
                        <div class="time">${formatTime(msg.created_at)}</div>
                    </div>`).join('');
                    container.scrollTop = container.scrollHeight;
                }
            }
        } catch(e) { console.error(e); }
    }
    
    async function sendMessage() {
        const input = document.getElementById('messageInput');
        const text = input.value.trim();
        if (!text || !currentChatId) return;
        
        try {
            const res = await fetch(`${API_URL}/api/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chatId: currentChatId, fromId: currentUserId, text })
            });
            if (res.ok) {
                input.value = '';
                await loadMessages();
                loadChats();
            }
        } catch(e) { console.error(e); }
    }
    
    function escapeHtml(text) { if (!text) return ''; const div = document.createElement('div'); div.textContent = text; return div.innerHTML; }
    function formatTime(t) { if (!t) return ''; return new Date(t).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }); }
    
    function setupTabs() {
        const tabs = document.querySelectorAll('.tab');
        const chatsList = document.getElementById('chatsList');
        const contactsList = document.getElementById('contactsList');
        tabs.forEach(tab => {
            tab.onclick = () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                if (tab.dataset.tab === 'chats') {
                    chatsList.style.display = 'block';
                    contactsList.style.display = 'none';
                    loadChats();
                } else {
                    chatsList.style.display = 'none';
                    contactsList.style.display = 'block';
                    loadContacts();
                }
            };
        });
    }
    
    document.getElementById('sendBtn').onclick = sendMessage;
    document.getElementById('messageInput').onkeypress = (e) => { if (e.key === 'Enter') sendMessage(); };
    
    setupTabs();
    loadChats();
    setInterval(() => { if (currentChatId) loadMessages(); loadChats(); }, 3000);
}

// Настройки
if (window.location.pathname.includes('settings.html')) {
    const userId = localStorage.getItem('userId');
    let userEmail = localStorage.getItem('email');
    let userEmailVerified = localStorage.getItem('emailVerified') === 'true';
    
    document.getElementById('userIdDisplay').textContent = userId ? userId.slice(0,8)+'...' : '—';
    document.getElementById('emailDisplay').textContent = userEmail || 'Не указан';
    
    function updateEmailUI() {
        const verifyItem = document.getElementById('verifyItem');
        const resendItem = document.getElementById('resendItem');
        const emailStatus = document.getElementById('emailStatus');
        
        if (userEmail) {
            if (userEmailVerified) {
                emailStatus.textContent = '✓ Подтверждён';
                emailStatus.className = 'email-status email-verified';
                if (resendItem) resendItem.style.display = 'none';
            } else {
                emailStatus.textContent = '⚠ Не подтверждён';
                emailStatus.className = 'email-status email-unverified';
                if (resendItem) resendItem.style.display = 'flex';
            }
            if (verifyItem) verifyItem.style.display = 'flex';
        } else {
            if (verifyItem) verifyItem.style.display = 'flex';
            if (resendItem) resendItem.style.display = 'none';
            emailStatus.textContent = 'Не указан';
            emailStatus.className = 'email-status email-unverified';
        }
    }
    
    async function fetchUserStatus() {
        try {
            const res = await fetch(`${API_URL}/api/user-status?userId=${userId}`);
            const data = await res.json();
            userEmail = data.email;
            userEmailVerified = data.email_verified;
            localStorage.setItem('email', userEmail || '');
            localStorage.setItem('emailVerified', userEmailVerified);
            document.getElementById('emailDisplay').textContent = userEmail || 'Не указан';
            updateEmailUI();
        } catch(e) { console.error(e); }
    }
    
    document.getElementById('emailItem').onclick = () => {
        document.getElementById('emailModal').classList.add('active');
        document.getElementById('modalEmail').value = userEmail || '';
    };
    
    document.getElementById('cancelModal').onclick = () => {
        document.getElementById('emailModal').classList.remove('active');
    };
    
    document.getElementById('confirmModal').onclick = async () => {
        const newEmail = document.getElementById('modalEmail').value.trim();
        if (!newEmail || !newEmail.includes('@')) {
            alert('Введите корректный email');
            return;
        }
        
        const btn = document.getElementById('confirmModal');
        btn.textContent = 'Отправка...';
        btn.disabled = true;
        
        try {
            const res = await fetch(`${API_URL}/api/add-email`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, email: newEmail })
            });
            const data = await res.json();
            
            if (res.ok) {
                alert('✅ Письмо отправлено! Проверьте почту для подтверждения.');
                document.getElementById('emailModal').classList.remove('active');
                await fetchUserStatus();
            } else {
                alert('❌ ' + (data.error || 'Ошибка'));
            }
        } catch(e) {
            alert('❌ Ошибка соединения');
        } finally {
            btn.textContent = 'Отправить';
            btn.disabled = false;
        }
    };
    
    document.getElementById('resendBtn').onclick = async () => {
        const btn = document.getElementById('resendBtn');
        btn.textContent = 'Отправка...';
        btn.disabled = true;
        
        try {
            const res = await fetch(`${API_URL}/api/resend-verification`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ login: userId })
            });
            const data = await res.json();
            alert(data.message || 'Письмо отправлено');
        } catch(e) {
            alert('Ошибка отправки');
        } finally {
            btn.textContent = '📧 Отправить письмо повторно';
            btn.disabled = false;
        }
    };
    
    const themeSwitch = document.getElementById('themeSwitch');
    const body = document.body;
    const savedTheme = localStorage.getItem('theme') || 'dark';
    body.classList.add(savedTheme);
    if (savedTheme === 'dark') themeSwitch.classList.add('active');
    
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
    
    document.getElementById('logoutBtn').onclick = () => {
        localStorage.clear();
        window.location.href = '/login.html';
    };
    
    fetchUserStatus();
    updateEmailUI();
}
