const RESEND_API_KEY = process.env.RESEND_API_KEY;

export async function sendVerificationEmail(email, username, token) {
    const appUrl = process.env.APP_URL || 'https://messenger-app-roan-two.vercel.app';
    const verificationUrl = `${appUrl}/verify-email?token=${token}`;
    
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Подтверждение email</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                body {
                    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    min-height: 100vh;
                    padding: 40px 20px;
                }
                .container {
                    max-width: 600px;
                    margin: 0 auto;
                    background: #ffffff;
                    border-radius: 24px;
                    overflow: hidden;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
                }
                .header {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    padding: 40px 30px;
                    text-align: center;
                }
                .logo {
                    font-size: 64px;
                    margin-bottom: 16px;
                }
                .header h1 {
                    color: white;
                    font-size: 28px;
                    font-weight: 700;
                    margin: 0;
                    letter-spacing: -0.5px;
                }
                .header p {
                    color: rgba(255,255,255,0.9);
                    margin-top: 8px;
                    font-size: 16px;
                }
                .content {
                    padding: 40px 30px;
                    background: white;
                }
                .greeting {
                    font-size: 24px;
                    font-weight: 600;
                    color: #1a1a2e;
                    margin-bottom: 16px;
                }
                .greeting span {
                    background: linear-gradient(135deg, #667eea, #764ba2);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                }
                .message {
                    color: #4a5568;
                    line-height: 1.6;
                    margin-bottom: 32px;
                    font-size: 16px;
                }
                .button-container {
                    text-align: center;
                    margin: 32px 0;
                }
                .button {
                    display: inline-block;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    text-decoration: none;
                    padding: 14px 42px;
                    border-radius: 50px;
                    font-weight: 600;
                    font-size: 16px;
                    transition: transform 0.2s, box-shadow 0.2s;
                    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
                }
                .button:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 8px 25px rgba(102, 126, 234, 0.5);
                }
                .divider {
                    text-align: center;
                    color: #a0aec0;
                    font-size: 14px;
                    margin: 24px 0;
                    position: relative;
                }
                .divider::before,
                .divider::after {
                    content: '';
                    position: absolute;
                    top: 50%;
                    width: 45%;
                    height: 1px;
                    background: #e2e8f0;
                }
                .divider::before { left: 0; }
                .divider::after { right: 0; }
                .link-box {
                    background: #f7fafc;
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    padding: 16px;
                    margin: 20px 0;
                    word-break: break-all;
                }
                .link-label {
                    font-size: 12px;
                    color: #718096;
                    margin-bottom: 8px;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                }
                .link-url {
                    font-size: 14px;
                    color: #667eea;
                    text-decoration: none;
                    word-break: break-all;
                }
                .features {
                    display: flex;
                    justify-content: space-around;
                    margin: 32px 0;
                    padding: 20px 0;
                    border-top: 1px solid #e2e8f0;
                    border-bottom: 1px solid #e2e8f0;
                }
                .feature {
                    text-align: center;
                    flex: 1;
                }
                .feature-icon {
                    font-size: 28px;
                    margin-bottom: 8px;
                }
                .feature-text {
                    font-size: 12px;
                    color: #718096;
                }
                .footer {
                    background: #f7fafc;
                    padding: 30px;
                    text-align: center;
                    border-top: 1px solid #e2e8f0;
                }
                .footer-text {
                    color: #a0aec0;
                    font-size: 12px;
                    line-height: 1.5;
                }
                .footer-text a {
                    color: #667eea;
                    text-decoration: none;
                }
                @media (max-width: 480px) {
                    .content { padding: 30px 20px; }
                    .greeting { font-size: 20px; }
                    .button { padding: 12px 32px; font-size: 14px; }
                    .features { flex-direction: column; gap: 16px; }
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo">💬</div>
                    <h1>c.c Messenger</h1>
                    <p>Безопасный и быстрый обмен сообщениями</p>
                </div>
                
                <div class="content">
                    <div class="greeting">
                        Привет, <span>${username}</span>! 👋
                    </div>
                    
                    <div class="message">
                        Рады видеть вас в <strong>c.c Messenger</strong>!<br><br>
                        Для завершения регистрации и начала общения с друзьями, 
                        пожалуйста, подтвердите ваш email адрес.
                    </div>
                    
                    <div class="button-container">
                        <a href="${verificationUrl}" class="button">✨ Подтвердить email ✨</a>
                    </div>
                    
                    <div class="divider">или</div>
                    
                    <div class="link-box">
                        <div class="link-label">📋 Скопируйте ссылку:</div>
                        <a href="${verificationUrl}" class="link-url">${verificationUrl}</a>
                    </div>
                    
                    <div class="features">
                        <div class="feature">
                            <div class="feature-icon">🔒</div>
                            <div class="feature-text">End-to-End<br>Шифрование</div>
                        </div>
                        <div class="feature">
                            <div class="feature-icon">⚡</div>
                            <div class="feature-text">Мгновенные<br>сообщения</div>
                        </div>
                        <div class="feature">
                            <div class="feature-icon">🎨</div>
                            <div class="feature-text">Современный<br>дизайн</div>
                        </div>
                    </div>
                    
                    <div class="message" style="font-size: 14px; background: #fff5f5; padding: 16px; border-radius: 12px; margin-top: 20px;">
                        💡 <strong>Не запрашивали регистрацию?</strong><br>
                        Если вы не создавали аккаунт в c.c Messenger, просто проигнорируйте это письмо.
                    </div>
                </div>
                
                <div class="footer">
                    <div class="footer-text">
                        © 2026 c.c Messenger. Все права защищены.<br>
                        Этот email был отправлен, потому что вы зарегистрировались в c.c Messenger.<br>
                        Если у вас есть вопросы, напишите нам: <a href="mailto:support@cc-messenger.com">support@cc-messenger.com</a>
                    </div>
                </div>
            </div>
        </body>
        </html>
    `;
    
    const text = `
        Добро пожаловать в c.c Messenger, ${username}!
        
        Подтвердите ваш email по ссылке: ${verificationUrl}
        
        Если вы не регистрировались, проигнорируйте это письмо.
        
        © 2026 c.c Messenger
    `;
    
    try {
        const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: 'c.c Messenger <noreply@cc-messenger.com>',
                to: email,
                subject: '✨ Подтверждение email - c.c Messenger',
                html: html,
                text: text
            })
        });
        
        const data = await res.json();
        console.log('Email sent:', data.id);
        return true;
    } catch (error) {
        console.error('Email error:', error);
        return false;
    }
}

export async function sendResetPasswordEmail(email, username, token) {
    const appUrl = process.env.APP_URL || 'https://messenger-app-roan-two.vercel.app';
    const resetUrl = `${appUrl}/reset-password?token=${token}`;
    
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Сброс пароля</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body {
                    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    min-height: 100vh;
                    padding: 40px 20px;
                }
                .container {
                    max-width: 600px;
                    margin: 0 auto;
                    background: #ffffff;
                    border-radius: 24px;
                    overflow: hidden;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
                }
                .header {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    padding: 40px 30px;
                    text-align: center;
                }
                .logo { font-size: 64px; margin-bottom: 16px; }
                .header h1 { color: white; font-size: 28px; font-weight: 700; }
                .header p { color: rgba(255,255,255,0.9); margin-top: 8px; }
                .content { padding: 40px 30px; background: white; }
                .greeting { font-size: 24px; font-weight: 600; color: #1a1a2e; margin-bottom: 16px; }
                .greeting span { background: linear-gradient(135deg, #667eea, #764ba2); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
                .message { color: #4a5568; line-height: 1.6; margin-bottom: 32px; }
                .button-container { text-align: center; margin: 32px 0; }
                .button {
                    display: inline-block;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    text-decoration: none;
                    padding: 14px 42px;
                    border-radius: 50px;
                    font-weight: 600;
                    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
                }
                .warning {
                    background: #fff5f5;
                    padding: 16px;
                    border-radius: 12px;
                    margin-top: 20px;
                    font-size: 14px;
                    color: #c53030;
                }
                .footer {
                    background: #f7fafc;
                    padding: 30px;
                    text-align: center;
                    border-top: 1px solid #e2e8f0;
                }
                .footer-text { color: #a0aec0; font-size: 12px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo">🔐</div>
                    <h1>Сброс пароля</h1>
                    <p>c.c Messenger</p>
                </div>
                <div class="content">
                    <div class="greeting">Привет, <span>${username}</span>!</div>
                    <div class="message">
                        Вы запросили сброс пароля для вашего аккаунта в c.c Messenger.<br><br>
                        Нажмите на кнопку ниже, чтобы создать новый пароль:
                    </div>
                    <div class="button-container">
                        <a href="${resetUrl}" class="button">🔄 Сбросить пароль</a>
                    </div>
                    <div class="warning">
                        ⚠️ Если вы не запрашивали сброс пароля, просто проигнорируйте это письмо.
                    </div>
                </div>
                <div class="footer">
                    <div class="footer-text">© 2026 c.c Messenger. Все права защищены.</div>
                </div>
            </div>
        </body>
        </html>
    `;
    
    try {
        const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: 'c.c Messenger <noreply@cc-messenger.com>',
                to: email,
                subject: '🔐 Сброс пароля - c.c Messenger',
                html: html
            })
        });
        
        return res.ok;
    } catch (error) {
        console.error('Reset email error:', error);
        return false;
    }
}
