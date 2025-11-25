import { Telegraf } from 'telegraf';
import dotenv from 'dotenv';
import GeminiService from './services/gemini.js';

// Загрузка переменных окружения
dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!BOT_TOKEN || !GEMINI_API_KEY) {
    console.error('❌ Ошибка: BOT_TOKEN и GEMINI_API_KEY должны быть указаны в .env файле');
    process.exit(1);
}

// Инициализация бота и сервисов
const bot = new Telegraf(BOT_TOKEN);
const gemini = new GeminiService(GEMINI_API_KEY);

// Middleware для логирования входящих обновлений
bot.use(async (ctx, next) => {
    console.log('📨 Входящее обновление:', {
        update_id: ctx.update.update_id,
        message: ctx.message ? {
            from: ctx.from.username,
            text: ctx.message.text
        } : 'нет сообщения',
        type: ctx.updateType
    });
    return next();
});

// Хранилище состояний пользователей (в памяти для прототипа)
const userStates = new Map();

// ==================== КОМАНДЫ ====================

/**
 * Команда /start - Приветствие
 */
bot.command('start', async (ctx) => {
    const firstName = ctx.from.first_name || 'друг';

    await ctx.reply(
        `Привет, ${firstName}! 👋\n\n` +
        `Я HEAL Wellness Бот - помогаю практиковать благодарность и развивать позитивное мышление.\n\n` +
        `💡 Это инструмент самопомощи, не медицинский сервис.\n\n` +
        `Команды:\n` +
        `/practice - Начать практику благодарности\n` +
        `/help - Справка\n\n` +
        `Готов начать? Нажми /practice`,
        {
            reply_markup: {
                keyboard: [
                    [{ text: '🧠 Практика благодарности' }],
                    [{ text: '❓ Помощь' }]
                ],
                resize_keyboard: true
            }
        }
    );
});

/**
 * Команда /help - Справка
 */
bot.command('help', async (ctx) => {
    await ctx.reply(
        `📖 Как это работает:\n\n` +
        `1. Нажми /practice или кнопку "🧠 Практика благодарности"\n` +
        `2. Опиши что-то хорошее, что произошло сегодня\n` +
        `3. Получи короткий инсайт от AI\n\n` +
        `💡 Это не терапия, а практика развития благодарности.\n` +
        `Для серьёзных проблем обратись к специалисту.\n\n` +
        `📞 Кризисная помощь:\n` +
        `Телефон доверия: 8-800-2000-122 (24/7, бесплатно)`
    );
});

/**
 * Команда /practice - Начало практики
 */
bot.command('practice', async (ctx) => {
    const userId = ctx.from.id;

    // Устанавливаем состояние ожидания ответа
    userStates.set(userId, { state: 'awaiting_gratitude' });

    await ctx.reply(
        `🌟 Практика благодарности\n\n` +
        `Вспомни что-то хорошее, что произошло сегодня или недавно.\n\n` +
        `Это может быть:\n` +
        `• Приятный момент\n` +
        `• Маленькое достижение\n` +
        `• Что-то, за что ты благодарен(на)\n\n` +
        `Опиши это своими словами 👇`,
        {
            reply_markup: {
                keyboard: [
                    [{ text: '❌ Отменить' }]
                ],
                resize_keyboard: true
            }
        }
    );
});

// ==================== ОБРАБОТКА КНОПОК ====================

bot.hears('🧠 Практика благодарности', (ctx) => ctx.command('/practice'));
bot.hears('❓ Помощь', (ctx) => ctx.command('/help'));
bot.hears('❌ Отменить', async (ctx) => {
    const userId = ctx.from.id;
    userStates.delete(userId);

    await ctx.reply(
        'Практика отменена. Возвращайся когда будешь готов! 😊',
        {
            reply_markup: {
                keyboard: [
                    [{ text: '🧠 Практика благодарности' }],
                    [{ text: '❓ Помощь' }]
                ],
                resize_keyboard: true
            }
        }
    );
});

// ==================== ОБРАБОТКА ТЕКСТОВЫХ СООБЩЕНИЙ ====================

bot.on('text', async (ctx) => {
    const userId = ctx.from.id;
    const userState = userStates.get(userId);

    // Если пользователь не в состоянии практики, игнорируем
    if (!userState || userState.state !== 'awaiting_gratitude') {
        await ctx.reply(
            'Используй /practice чтобы начать практику благодарности 🌟'
        );
        return;
    }

    const userText = ctx.message.text;

    // Проверка на слишком короткий текст
    if (userText.length < 10) {
        await ctx.reply(
            'Попробуй описать чуть подробнее - хотя бы пару предложений 😊'
        );
        return;
    }

    // Отправляем индикатор печати
    await ctx.sendChatAction('typing');

    try {
        // Анализируем через Gemini
        const analysis = await gemini.analyzeGratitude(userText);

        // Отправляем результат
        await ctx.reply(
            `✨ Твоя практика:\n\n` +
            `"${userText.length > 200 ? userText.substring(0, 200) + '...' : userText}"\n\n` +
            `💡 Инсайт:\n${analysis}\n\n` +
            `Отличная работа! 🌟`,
            {
                reply_markup: {
                    keyboard: [
                        [{ text: '🧠 Практика благодарности' }],
                        [{ text: '❓ Помощь' }]
                    ],
                    resize_keyboard: true
                }
            }
        );

        // Очищаем состояние
        userStates.delete(userId);

    } catch (error) {
        console.error('Ошибка обработки практики:', error);

        await ctx.reply(
            '😔 Произошла ошибка при анализе. Попробуй ещё раз через /practice',
            {
                reply_markup: {
                    keyboard: [
                        [{ text: '🧠 Практика благодарности' }],
                        [{ text: '❓ Помощь' }]
                    ],
                    resize_keyboard: true
                }
            }
        );

        userStates.delete(userId);
    }
});

// ==================== ЗАПУСК БОТА ====================

async function startBot() {
    try {
        console.log('🔄 Проверка подключения к Gemini...');
        const isHealthy = await gemini.healthCheck();

        if (!isHealthy) {
            console.warn('⚠️  Gemini API недоступен, но бот запустится');
        } else {
            console.log('✅ Gemini API подключен');
        }

        // Получаем информацию о боте
        const botInfo = await bot.telegram.getMe();

        // Определяем режим запуска
        const PORT = process.env.PORT || 3000;
        const WEBHOOK_DOMAIN = process.env.WEBHOOK_DOMAIN;

        if (WEBHOOK_DOMAIN) {
            // Production режим с webhook (Railway)
            console.log('🌐 Запуск в webhook режиме');

            const webhookPath = `/webhook/${BOT_TOKEN}`;
            const webhookUrl = `${WEBHOOK_DOMAIN}${webhookPath}`;

            // Удаляем старый webhook
            await bot.telegram.deleteWebhook();

            // Устанавливаем новый webhook
            await bot.telegram.setWebhook(webhookUrl);
            console.log(`📡 Webhook установлен: ${webhookUrl}`);

            // Запускаем Express сервер для webhook
            bot.startWebhook(webhookPath, null, PORT);

            console.log('✅ Бот запущен успешно!');
            console.log(`📱 Бот: @${botInfo.username}`);
            console.log(`🌍 Режим: webhook`);
            console.log(`🔌 Порт: ${PORT}`);

        } else {
            // Development режим с long polling (локально)
            console.log('💻 Запуск в polling режиме');

            await bot.launch();

            console.log('✅ Бот запущен успешно!');
            console.log(`📱 Бот: @${botInfo.username}`);
            console.log(`🌍 Режим: ${process.env.NODE_ENV || 'development'}`);
        }

    } catch (error) {
        console.error('❌ Ошибка запуска бота:', error);
        process.exit(1);
    }
}

// Graceful shutdown
process.once('SIGINT', () => {
    console.log('\n🛑 Остановка бота...');
    bot.stop('SIGINT');
});

process.once('SIGTERM', () => {
    console.log('\n🛑 Остановка бота...');
    bot.stop('SIGTERM');
});

// Запуск
startBot();
