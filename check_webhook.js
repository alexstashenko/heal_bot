import dotenv from 'dotenv';
dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN;

console.log('Проверяем токен:', BOT_TOKEN ? `${BOT_TOKEN.substring(0, 10)}...` : 'НЕ НАЙДЕН');

// Проверка webhook статуса
async function checkWebhook() {
    try {
        const url = `https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`;
        console.log('URL:', url);

        const response = await fetch(url);
        const data = await response.json();

        console.log('\n📊 Статус Webhook:');
        console.log(JSON.stringify(data, null, 2));

        if (data.ok && data.result) {
            if (data.result.last_error_message) {
                console.error('\n❌ Последняя ошибка:', data.result.last_error_message);
                console.error('Время ошибки:', new Date(data.result.last_error_date * 1000));
            }

            if (data.result.pending_update_count > 0) {
                console.warn(`\n⚠️  Pending updates: ${data.result.pending_update_count}`);
            }

            console.log('\n📍 Текущий webhook URL:', data.result.url || 'НЕ УСТАНОВЛЕН');
        } else {
            console.error('\n❌ Ошибка API Telegram:', data.description);
        }

    } catch (error) {
        console.error('Ошибка проверки:', error.message);
    }
}

checkWebhook();
