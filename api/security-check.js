// Эндпоинт для проверки безопасности (не даёт информации)
export default function handler(req, res) {
    // Возвращаем минимальную информацию
    res.status(200).json({
        status: 'ok',
        timestamp: Date.now(),
        message: 'Service is running'
    });
}
