// Защита от прямого доступа к файлам
export default function securityMiddleware(req, res, next) {
    const url = req.url;
    
    // Блокируем доступ к lib папке
    if (url.includes('/lib/') || url.includes('/password_hash.js')) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'text/html');
        res.end('<h1>404 Not Found</h1>');
        return;
    }
    
    // Блокируем доступ к .env и конфигам
    if (url.includes('.env') || url.includes('config.json') || url.includes('package.json')) {
        res.statusCode = 404;
        res.end();
        return;
    }
    
    // Блокируем доступ к .git
    if (url.includes('.git')) {
        res.statusCode = 404;
        res.end();
        return;
    }
    
    next();
}
