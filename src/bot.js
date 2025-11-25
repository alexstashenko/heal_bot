import { Telegraf, Markup } from 'telegraf';
import express from 'express';
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

// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================

/**
 * Отправляет шаг H (Having)
 */
async function sendStepH(ctx) {
    await ctx.reply(
        `🌟 Шаг H (Having): Осознай опыт\n\n` +
        `Прямо сейчас настройся на свое тело и окружение.\n\n` +
        `Обрати внимание:\n` +
        `• Как ты дышишь - воздуха хватает\n` +
        `• Пульс стабилен, сердце работает\n` +
        `• Твое тело живое и функционирует\n` +
        `• Вокруг безопасно, никто не угрожает\n\n` +
        `Опиши что ты чувствуешь прямо сейчас 👇`,
        Markup.keyboard([
            ['❌ Отменить практику']
        ]).resize()
    );
}

/**
 * Отправляет шаг E (Enriching)
 */
async function sendStepE(ctx) {
    await ctx.reply(
        `✨ Шаг E (Enriching): Обогати ощущение\n\n` +
        `Теперь усиль это ощущение ОК-ности:\n` +
        `• Почувствуй благодарность телу за его работу\n` +
        `• Отметь любые приятные ощущения\n` +
        `• Замечай детали этого момента покоя\n\n` +
        `Что ты замечаешь? Как меняются ощущения? 👇`,
        Markup.keyboard([
            ['❌ Отменить практику']
        ]).resize()
    );
}

/**
 * Отправляет шаг A (Absorbing)
 */
async function sendStepA(ctx) {
    await ctx.reply(
        `💫 Шаг A (Absorbing): Впитай в себя\n\n` +
        `Позволь этому состоянию стать частью тебя:\n` +
        `• Удерживай внимание на чувстве, что все в порядке\n` +
        `• Дай себе время прочувствовать это\n` +
        `• Впусти это ощущение глубже\n\n` +
        `Как это ощущается внутри? 👇`,
        Markup.keyboard([
            ['❌ Отменить практику']
        ]).resize()
    );
}

/**
 * Отправляет шаг L (Linking)
 */
async function sendStepL(ctx) {
    await ctx.reply(
        `🔗 Шаг L (Linking): Создай связь\n\n` +
        `Осознай как это состояние ОК-ности может помочь:\n` +
        `• Когда возникает тревога - можешь вернуться к этому\n` +
        `• Это становится ресурсом, к которому ты имеешь доступ\n` +
        `• Запомни это чувство\n\n` +
        `Что важного ты унесешь из этой практики? 👇`,
        Markup.keyboard([
            ['❌ Отменить практику']
        ]).resize()
    );
}

/**
 * Обрабатывает ввод пользователя на текущем шаге
 */
async function handleStepInput(ctx, state) {
    const userText = ctx.message.text;
    const userId = ctx.from.id;

    // Проверка на минимальную длину
    if (userText.length < 10) {
        await ctx.reply('Попробуй описать чуть подробнее - хотя бы пару предложений 😊');
        return;
    }

    await ctx.sendChatAction('typing');

    try {
        console.log(`🎯 Обработка шага ${state.currentStep} для пользователя ${ctx.from.username}`);

        // Анализируем через Gemini
        const analysis = await gemini.analyzeHealStep(
            state.currentStep,
            userText,
            state.history
        );

        // Проверяем на дистресс (care-ответ)
        if (analysis.includes('Я слышу, что сейчас тебе непросто')) {
            await ctx.reply(
                analysis,
                Markup.keyboard([
                    ['✅ Практика ОК-ности'],
                    ['❓ Помощь']
                ]).resize()
            );
            userStates.delete(userId);
            return;
        }

        // Сохраняем ответ пользователя и AI в историю
        state.history[state.currentStep] = {
            userText: userText,
            aiResponse: analysis
        };

        // Отправляем отражение
        await ctx.reply(`💭 ${analysis}`);

        // Определяем следующий шаг
        const stepOrder = ['H', 'E', 'A', 'L'];
        const currentIndex = stepOrder.indexOf(state.currentStep);

        if (currentIndex < 3) {
            // Есть еще шаги - предлагаем продолжить
            await ctx.reply(
                'Готов перейти к следующему шагу?',
                Markup.keyboard([
                    ['➡️ Продолжить'],
                    ['❓ Есть вопрос'],
                    ['❌ Отменить практику']
                ]).resize()
            );
            state.waitingFor = 'navigation';
        } else {
            // Это был последний шаг L - предлагаем завершить
            await ctx.reply(
                'Это был последний шаг практики HEAL!',
                Markup.keyboard([
                    ['✅ Завершить практику'],
                    ['❓ Есть вопрос']
                ]).resize()
            );
            state.waitingFor = 'completion';
        }

    } catch (error) {
        console.error(`❌ Ошибка обработки шага ${state.currentStep}:`, error);
        await ctx.reply(
            '😔 Произошла ошибка. Попробуй ещё раз или начни заново через /practice',
            Markup.keyboard([
                ['✅ Практика ОК-ности'],
                ['❓ Помощь']
            ]).resize()
        );
        userStates.delete(userId);
    }
}

/**
 * Обрабатывает вопрос пользователя
 */
async function handleQuestionInput(ctx, state) {
    const question = ctx.message.text;

    await ctx.sendChatAction('typing');

    try {
        console.log(`💬 Вопрос на шаге ${state.currentStep}: ${question.substring(0, 50)}...`);

        const answer = await gemini.answerHealQuestion(
            state.currentStep,
            question,
            state.history
        );

        await ctx.reply(`💡 ${answer}`);

        // Возвращаемся к навигации/завершению
        const stepOrder = ['H', 'E', 'A', 'L'];
        const currentIndex = stepOrder.indexOf(state.currentStep);

        if (currentIndex < 3) {
            await ctx.reply(
                'Готов продолжить практику?',
                Markup.keyboard([
                    ['➡️ Продолжить'],
                    ['❓ Еще вопрос'],
                    ['❌ Отменить практику']
                ]).resize()
            );
            state.waitingFor = 'navigation';
        } else {
            await ctx.reply(
                'Готов завершить практику?',
                Markup.keyboard([
                    ['✅ Завершить практику'],
                    ['❓ Еще вопрос']
                ]).resize()
            );
            state.waitingFor = 'completion';
        }

    } catch (error) {
        console.error('❌ Ошибка при ответе на вопрос:', error);
        await ctx.reply('Извини, не смог обработать вопрос. Давай продолжим практику? 🤍');
    }
}

// ==================== КОМАНДЫ ====================

bot.command('start', async (ctx) => {
    const firstName = ctx.from.first_name || 'друг';

    await ctx.reply(
        `Привет, ${firstName}! 👋\n\n` +
        `Я HEAL Wellness Бот - помогаю практиковать осознанность через 4-шаговую практику HEAL.\n\n` +
        `💡 Это инструмент самопомощи, не медицинский сервис.\n\n` +
        `Команды:\n` +
        `/practice - Начать практику HEAL\n` +
        `/help - Справка\n\n` +
        `Готов начать? Нажми /practice`,
        Markup.keyboard([
            ['✅ Практика ОК-ности'],
            ['❓ Помощь']
        ]).resize()
    );
});

bot.command('help', async (ctx) => {
    await ctx.reply(
        `📖 Практика HEAL:\n\n` +
        `H - Having: Осознай опыт (что ты чувствуешь прямо сейчас)\n` +
        `E - Enriching: Обогати ощущение (углуби внимание)\n` +
        `A - Absorbing: Впитай в себя (интегрируй опыт)\n` +
        `L - Linking: Создай связь (закрепи как ресурс)\n\n` +
        `На каждом шаге ты можешь:\n` +
        `• Задать вопрос\n` +
        `• Продолжить к следующему шагу\n` +
        `• Отменить практику\n\n` +
        `💡 Это не терапия, а практика осознанности.\n` +
        `Для серьёзных проблем обратись к специалисту.\n\n` +
        `📞 Кризисная помощь:\n` +
        `Телефон доверия: 8-800-2000-122 (24/7, бесплатно)`
    );
});

bot.command('practice', async (ctx) => {
    const userId = ctx.from.id;

    // Инициализируем состояние для новой практики
    userStates.set(userId, {
        mode: 'heal_practice',
        currentStep: 'H',
        history: {},
        waitingFor: 'step_input'
    });

    console.log(`🌟 Новая HEAL практика начата пользователем ${ctx.from.username}`);
    await sendStepH(ctx);
});

// ==================== ОБРАБОТКА КНОПОК ====================

bot.hears('✅ Практика ОК-ности', async (ctx) => {
    const userId = ctx.from.id;

    userStates.set(userId, {
        mode: 'heal_practice',
        currentStep: 'H',
        history: {},
        waitingFor: 'step_input'
    });

    console.log(`🌟 HEAL практика начата через кнопку: ${ctx.from.username}`);
    await sendStepH(ctx);
});

bot.hears('❓ Помощь', async (ctx) => {
    await ctx.reply(
        `📖 Практика HEAL:\n\n` +
        `H - Having: Осознай опыт\n` +
        `E - Enriching: Обогати ощущение\n` +
        `A - Absorbing: Впитай в себя\n` +
        `L - Linking: Создай связь\n\n` +
        `На каждом шаге можешь задать вопрос или продолжить.\n\n` +
        `💡 Это практика осознанности, не терапия.\n\n` +
        `📞 Кризисная помощь:\n` +
        `Телефон доверия: 8-800-2000-122 (24/7, бесплатно)`
    );
});

bot.hears(['❓ Есть вопрос', '❓ Еще вопрос'], async (ctx) => {
    const userId = ctx.from.id;
    const state = userStates.get(userId);

    if (!state || state.mode !== 'heal_practice') {
        await ctx.reply('Используй /practice чтобы начать практику HEAL ✨');
        return;
    }

    state.waitingFor = 'question';
    await ctx.reply(
        'Задай свой вопрос, я отвечу в контексте текущей практики 💭',
        Markup.keyboard([
            ['⬅️ Назад к практике']
        ]).resize()
    );
});

bot.hears('⬅️ Назад к практике', async (ctx) => {
    const userId = ctx.from.id;
    const state = userStates.get(userId);

    if (!state || state.mode !== 'heal_practice') {
        return;
    }

    // Возвращаемся к навигации
    const stepOrder = ['H', 'E', 'A', 'L'];
    const currentIndex = stepOrder.indexOf(state.currentStep);

    if (currentIndex < 3) {
        await ctx.reply(
            'Продолжаем практику!',
            Markup.keyboard([
                ['➡️ Продолжить'],
                ['❓ Есть вопрос'],
                ['❌ Отменить практику']
            ]).resize()
        );
        state.waitingFor = 'navigation';
    } else {
        await ctx.reply(
            'Продолжаем!',
            Markup.keyboard([
                ['✅ Завершить практику'],
                ['❓ Есть вопрос']
            ]).resize()
        );
        state.waitingFor = 'completion';
    }
});

bot.hears('➡️ Продолжить', async (ctx) => {
    const userId = ctx.from.id;
    const state = userStates.get(userId);

    if (!state || state.mode !== 'heal_practice' || state.waitingFor !== 'navigation') {
        return;
    }

    // Переходим к следующему шагу
    const stepOrder = ['H', 'E', 'A', 'L'];
    const currentIndex = stepOrder.indexOf(state.currentStep);
    const nextStep = stepOrder[currentIndex + 1];

    state.currentStep = nextStep;
    state.waitingFor = 'step_input';

    console.log(`➡️ Переход к шагу ${nextStep}`);

    if (nextStep === 'E') {
        await sendStepE(ctx);
    } else if (nextStep === 'A') {
        await sendStepA(ctx);
    } else if (nextStep === 'L') {
        await sendStepL(ctx);
    }
});

bot.hears('✅ Завершить практику', async (ctx) => {
    const userId = ctx.from.id;
    const state = userStates.get(userId);

    if (!state || state.mode !== 'heal_practice') {
        return;
    }

    await ctx.sendChatAction('typing');

    try {
        console.log('🎊 Генерация финального summary');

        // Генерируем итоговое отражение
        const summary = await gemini.generateFinalSummary(state.history);

        await ctx.reply(
            `🎉 Практика HEAL завершена!\n\n` +
            `💫 Итоговое отражение:\n${summary}\n\n` +
            `Прекрасная работа! Прямо сейчас с тобой все в порядке. ✨`,
            Markup.keyboard([
                ['✅ Практика ОК-ности'],
                ['❓ Помощь']
            ]).resize()
        );

        // Очищаем состояние
        userStates.delete(userId);
        console.log('✅ HEAL практика успешно завершена');

    } catch (error) {
        console.error('❌ Ошибка при завершении практики:', error);
        await ctx.reply(
            `🎉 Практика HEAL завершена!\n\n` +
            `Прекрасная работа! Ты прошёл через все 4 шага и создал для себя ресурс внутреннего покоя. 🌟`,
            Markup.keyboard([
                ['✅ Практика ОК-ности'],
                ['❓ Помощь']
            ]).resize()
        );
        userStates.delete(userId);
    }
});

bot.hears('❌ Отменить практику', async (ctx) => {
    const userId = ctx.from.id;
    userStates.delete(userId);

    await ctx.reply(
        'Практика отменена. Возвращайся когда будешь готов! 😊',
        Markup.keyboard([
            ['✅ Практика ОК-ности'],
            ['❓ Помощь']
        ]).resize()
    );
});

// ==================== ОБРАБОТКА ТЕКСТОВЫХ СООБЩЕНИЙ ====================

bot.on('text', async (ctx) => {
    const userId = ctx.from.id;
    const state = userStates.get(userId);

    // Если пользователь не в практике
    if (!state || state.mode !== 'heal_practice') {
        await ctx.reply('Используй /practice чтобы начать практику HEAL ✨');
        return;
    }

    // Обрабатываем в зависимости от того, что ожидаем
    if (state.waitingFor === 'step_input') {
        await handleStepInput(ctx, state);
    } else if (state.waitingFor === 'question') {
        await handleQuestionInput(ctx, state);
    } else {
        // Состояние navigation или completion - ждём кнопку
        await ctx.reply('Используй кнопки для навигации 👇');
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

            // Создаем Express приложение
            const app = express();

            // Health check endpoint
            app.get('/', (req, res) => {
                res.json({ status: 'ok', bot: botInfo.username });
            });

            // Webhook endpoint
            app.use(bot.webhookCallback(webhookPath));

            // Запускаем сервер
            const server = app.listen(PORT, async () => {
                // Удаляем старый webhook
                await bot.telegram.deleteWebhook();

                // Устанавливаем новый webhook
                await bot.telegram.setWebhook(webhookUrl);
                console.log(`📡 Webhook установлен: ${webhookUrl}`);

                console.log('✅ Бот запущен успешно!');
                console.log(`📱 Бот: @${botInfo.username}`);
                console.log(`🌍 Режим: webhook`);
                console.log(`🔌 Порт: ${PORT}`);
                console.log(`🏥 Health check: ${WEBHOOK_DOMAIN}/`);
            });

            // Graceful shutdown для webhook
            process.once('SIGINT', () => {
                console.log('\n🛑 Остановка сервера...');
                server.close(() => {
                    console.log('Сервер остановлен');
                    process.exit(0);
                });
            });

            process.once('SIGTERM', () => {
                console.log('\n🛑 Остановка сервера...');
                server.close(() => {
                    console.log('Сервер остановлен');
                    process.exit(0);
                });
            });

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

// Graceful shutdown для polling режима
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
