import { Telegraf, Markup } from 'telegraf';
import express from 'express';
import dotenv from 'dotenv';
import { GeminiService } from './services/gemini.js';
import { StateManager } from './services/stateManager.js';  // NEW: Redis state management

dotenv.config();

// Конфигурация
const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBHOOK_DOMAIN = process.env.WEBHOOK_DOMAIN;
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

if (!BOT_TOKEN) { // GEMINI_API_KEY is now handled within GeminiService
    console.error('❌ Ошибка: BOT_TOKEN должен быть указан в .env файле');
    process.exit(1);
}

// Инициализация бота и сервисов
const bot = new Telegraf(BOT_TOKEN);
const gemini = new GeminiService();

// NOTE: userStates Map удалён - теперь используем Redis через StateManager

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

// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================

/**
 * Отправляет шаг H1 - Тело и окружение
 */
async function sendStepH1(ctx) {
    await ctx.reply(
        `🌟 Шаг H (Having): Осознайте свое состояние\n` +
        `Часть 1 из 3\n\n` +
        `📍 Настройтесь на ТЕЛО и ОКРУЖЕНИЕ:\n` +
        `• Как вы дышите - воздуха хватает\n` +
        `• Пульс стабилен, сердце работает\n` +
        `• Ваше тело живое и функционирует\n` +
        `• Вокруг безопасно, никто не угрожает\n\n` +
        `Что вы замечаете в своём теле и вокруг себя? 👇`
    );
}

/**
 * Отправляет шаг H2 - Мысли и эмоции
 */
async function sendStepH2(ctx) {
    await ctx.reply(
        `🌟 Шаг H (Having): Осознайте свое состояние\n` +
        `Часть 2 из 3\n\n` +
        `🧠 Настройтесь на МЫСЛИ и ЭМОЦИИ:\n` +
        `• Какие мысли крутятся в голове\n` +
        `• Какие чувства и эмоции присутствуют\n` +
        `• Есть ли тревога, сомнения или напряжение\n\n` +
        `Что вы замечаете в своих мыслях и эмоциях? 👇`
    );
}

/**
 * Отправляет шаг H3 - Финальная оценка
 */
async function sendStepH3(ctx) {
    await ctx.reply(
        `🌟 Шаг H (Having): Осознайте свое состояние\n` +
        `Часть 3 из 3\n\n` +
        `❓ Теперь честно ответьте - как вы себя чувствуете:\n` +
        `• ОК (всё в порядке)\n` +
        `• НЕ ОК (нужна забота)\n` +
        `• И ТО, И ДРУГОЕ (смешанное)\n\n` +
        `Опишите общее состояние 👇`,
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
        `✨ Шаг E (Enriching): Обогатите ощущение\n\n` +
        `Теперь усильте это ощущение ОК-ности, 10-20 секунд:\n` +
        `• Почувствуйте благодарность телу за его работу\n` +
        `• Отметьте любые приятные ощущения\n` +
        `• Замечайте детали этого момента покоя\n\n` +
        `Что вы замечаете? Как меняются ощущения? 👇`,
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
        `💫 Шаг A (Absorbing): Впитайте в себя\n\n` +
        `Позвольте этому состоянию стать частью вас, 10-20 секунд:\n` +
        `• Удерживайте внимание на чувстве, что все в порядке\n` +
        `• Дайте себе время прочувствовать это\n` +
        `• Впустите это ощущение глубже\n\n` +
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
        `🔗 Шаг L (Linking): Создайте связь\n\n` +
        `Осознайте, как это состояние ОК-ности может помочь:\n` +
        `• Когда возникает тревога - можете вернуться к этому\n` +
        `• Это становится ресурсом, к которому вы имеете доступ\n` +
        `• Запомните это чувство\n\n` +
        `Что важного вы унесете из этой практики? 👇`,
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

    await ctx.sendChatAction('typing');

    try {
        console.log(`🎯 Обработка шага ${state.currentStep} для пользователя ${ctx.from.username}`);

        // ═══════════════════════════════════════════════════════════
        // СПЕЦИАЛЬНАЯ ОБРАБОТКА ДЛЯ ШАГА H (трёхэтапная логика)
        // ═══════════════════════════════════════════════════════════
        if (state.currentStep === 'H') {
            // Инициализация history.H если не существует
            if (!state.history.H) {
                state.history.H = {};
            }

            // -------------------------------------------------------
            // H1: Тело и окружение
            // -------------------------------------------------------
            if (state.substep === 'H1') {
                console.log('📍 H1 (тело) → H2 (мысли)');
                state.history.H.H1_body = userText;
                state.substep = 'H2';
                await sendStepH2(ctx);
                return;
            }

            // -------------------------------------------------------
            // H2: Мысли и эмоции
            // -------------------------------------------------------
            if (state.substep === 'H2') {
                console.log('🧠 H2 (мысли) → H3 (оценка)');
                state.history.H.H2_mind = userText;
                state.substep = 'H3';
                await sendStepH3(ctx);
                return;
            }

            // -------------------------------------------------------
            // H3: Финальная оценка и AI анализ
            // -------------------------------------------------------
            if (state.substep === 'H3') {
                console.log('❓ H3 (оценка) → AI анализ');
                state.history.H.H3_final = userText;

                // AI анализирует ВСЕ ТРИ ответа
                const analysis = await gemini.analyzeHealStepH(
                    state.history.H.H1_body,
                    state.history.H.H2_mind,
                    state.history.H.H3_final
                );

                // Сохраняем AI ответ
                state.history.H.aiResponse = analysis;

                // Scenario 1: NOT OK - прерываем практику
                if (analysis.includes('СТАТУС:NOT_OK')) {
                    const cleanAnalysis = analysis.replace('СТАТУС:NOT_OK\n', '').trim();
                    await ctx.reply(
                        cleanAnalysis,
                        Markup.keyboard([
                            ['✅ Практика ОК-ности'],
                            ['❓ Помощь']
                        ]).resize()
                    );
                    await StateManager.delete(userId);
                    return;
                }

                // Scenario 2: MIXED - предлагаем выбор
                if (analysis.includes('СТАТУС:MIXED')) {
                    const cleanAnalysis = analysis.replace('СТАТУС:MIXED\n', '').trim();

                    await ctx.reply(
                        `💭 ${cleanAnalysis}`,
                        Markup.keyboard([
                            ['✅ Продолжить практику'],
                            ['🤍 Позаботиться о себе'],
                            ['❌ Отменить']
                        ]).resize()
                    );
                    state.waitingFor = 'mixed_choice';
                    return;
                }

                // Scenario 3: OK - продолжаем как обычно
                if (analysis.includes('СТАТУС:OK')) {
                    const cleanAnalysis = analysis.replace('СТАТУС:OK\n', '').trim();

                    await ctx.reply(`💭 ${cleanAnalysis}`);
                    await ctx.reply(
                        'Готовы перейти к следующему шагу?',
                        Markup.keyboard([
                            ['➡️ Продолжить'],
                            ['❓ Есть вопрос'],
                            ['❌ Отменить практику']
                        ]).resize()
                    );
                    state.waitingFor = 'navigation';
                    return;
                }

                // Fallback если статус не найден
                console.warn('⚠️ Статус не найден в ответе AI для шага H');
            }
        }

        // ═══════════════════════════════════════════════════════════
        // ОБЫЧНАЯ ОБРАБОТКА ДЛЯ ШАГОВ E, A, L
        // ═══════════════════════════════════════════════════════════

        // Анализируем через Gemini
        const analysis = await gemini.analyzeHealStep(
            state.currentStep,
            userText,
            state.history
        );

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
                'Готовы перейти к следующему шагу?',
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
            '😔 Произошла ошибка. Попробуйте ещё раз или начните заново через /practice',
            Markup.keyboard([
                ['✅ Практика ОК-ности'],
                ['❓ Помощь']
            ]).resize()
        );
        await StateManager.delete(userId);
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
                'Готовы продолжить практику?',
                Markup.keyboard([
                    ['➡️ Продолжить'],
                    ['❓ Еще вопрос'],
                    ['❌ Отменить практику']
                ]).resize()
            );
            state.waitingFor = 'navigation';
        } else {
            await ctx.reply(
                'Готовы завершить практику?',
                Markup.keyboard([
                    ['✅ Завершить практику'],
                    ['❓ Еще вопрос']
                ]).resize()
            );
            state.waitingFor = 'completion';
        }

    } catch (error) {
        console.error('❌ Ошибка при ответе на вопрос:', error);
        await ctx.reply('Извините, не смог обработать вопрос. Давайте продолжим практику? 🤍');
    }
}

// ==================== КОМАНДЫ ====================

bot.command('start', async (ctx) => {
    const firstName = ctx.from.first_name || 'друг';

    await ctx.reply(
        `Привет, ${firstName}! 👋\n\n` +
        `Я HEAL бот - помогаю практиковать осознанность через 4-шаговую практику HEAL.\n\n` +
        `💡 Это инструмент самопомощи, не медицинский сервис.\n\n` +
        `Команды:\n` +
        `/practice - Начать практику HEAL\n` +
        `/help - Справка\n\n` +
        `Готовы начать? Нажмите /practice`,
        Markup.keyboard([
            ['✅ Практика ОК-ности'],
            ['❓ Помощь']
        ]).resize()
    );
});

bot.command('help', async (ctx) => {
    await ctx.reply(
        `📖 Практика HEAL:\n\n` +
        `H - Having: Осознайте опыт (что вы чувствуете прямо сейчас)\n` +
        `E - Enriching: Обогатите ощущение (углубите внимание)\n` +
        `A - Absorbing: Впитайте в себя (интегрируйте опыт)\n` +
        `L - Linking: Создайте связь (закрепите как ресурс)\n\n` +
        `На каждом шаге вы можете:\n` +
        `• Задать вопрос\n` +
        `• Продолжить к следующему шагу\n` +
        `• Отменить практику\n\n` +
        `💡 Это не терапия, а практика осознанности.\n` +
        `Для серьёзных проблем обратитесь к специалисту.\n\n` +
        `📞 Кризисная помощь:\n` +
        `Телефон доверия: 8-800-2000-122 (24/7, бесплатно)`
    );
});

bot.command('practice', async (ctx) => {
    const userId = ctx.from.id;

    // Инициализируем состояние для новой практики
    await StateManager.set(userId, {
        mode: 'heal_practice',
        currentStep: 'H',
        substep: 'H1',  // Track H1/H2/H3
        history: {},
        waitingFor: 'step_input'
    });

    console.log(`🌟 Новая HEAL практика начата пользователем ${ctx.from.username}`);
    await sendStepH1(ctx);
});

// ==================== ОБРАБОТКА КНОПОК ====================

bot.hears('✅ Практика ОК-ности', async (ctx) => {
    const userId = ctx.from.id;

    await StateManager.set(userId, {
        mode: 'heal_practice',
        currentStep: 'H',
        substep: 'H1',  // Track H1/H2/H3
        history: {},
        waitingFor: 'step_input'
    });

    console.log(`🌟 HEAL практика начата через кнопку: ${ctx.from.username}`);
    await sendStepH1(ctx);
});

bot.hears('❓ Помощь', async (ctx) => {
    await ctx.reply(
        `📖 Практика HEAL:\n\n` +
        `H - Having: Осознайте опыт\n` +
        `E - Enriching: Обогатите ощущение\n` +
        `A - Absorbing: Впитайте в себя\n` +
        `L - Linking: Создайте связь\n\n` +
        `На каждом шаге можно задать вопрос или продолжить.\n\n` +
        `💡 Это практика осознанности, не терапия.\n\n` +
        `📞 Кризисная помощь:\n` +
        `Телефон доверия: 8-800-2000-122 (24/7, бесплатно)`
    );
});

bot.hears(['❓ Есть вопрос', '❓ Еще вопрос'], async (ctx) => {
    const userId = ctx.from.id;
    const state = await StateManager.get(userId);

    if (!state || state.mode !== 'heal_practice') {
        await ctx.reply('Используйте /practice чтобы начать практику HEAL ✨');
        return;
    }

    state.waitingFor = 'question';
    await ctx.reply(
        'Задайте свой вопрос, я отвечу в контексте текущей практики 💭',
        Markup.keyboard([
            ['⬅️ Назад к практике']
        ]).resize()
    );
});

bot.hears('⬅️ Назад к практике', async (ctx) => {
    const userId = ctx.from.id;
    const state = await StateManager.get(userId);

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
    const state = await StateManager.get(userId);

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
    const state = await StateManager.get(userId);

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
            `Прекрасная работа! Прямо сейчас с вами все в порядке. ✨`,
            Markup.keyboard([
                ['✅ Практика ОК-ности'],
                ['❓ Помощь']
            ]).resize()
        );

        // Очищаем состояние
        await StateManager.delete(userId);
        console.log('✅ HEAL практика успешно завершена');

    } catch (error) {
        console.error('❌ Ошибка при завершении практики:', error);
        await ctx.reply(
            `🎉 Практика HEAL завершена!\n\n` +
            `Прекрасная работа! Вы прошли через все 4 шага и создали для себя ресурс внутреннего покоя. 🌟`,
            Markup.keyboard([
                ['✅ Практика ОК-ности'],
                ['❓ Помощь']
            ]).resize()
        );
        await StateManager.delete(userId);
    }
});

// ==================== ОБРАБОТКА MIXED СОСТОЯНИЯ ====================

bot.hears('✅ Продолжить практику', async (ctx) => {
    const userId = ctx.from.id;
    const state = await StateManager.get(userId);

    if (!state || state.waitingFor !== 'mixed_choice') {
        return;
    }

    console.log(`✅ Пользователь ${ctx.from.username} выбрал продолжить из MIXED состояния`);

    // Пользователь выбрал продолжить практику
    await ctx.reply('Отлично! Продолжаем практику. 💪');
    await ctx.reply(
        'Готовы перейти к следующему шагу?',
        Markup.keyboard([
            ['➡️ Продолжить'],
            ['❓ Есть вопрос'],
            ['❌ Отменить практику']
        ]).resize()
    );
    state.waitingFor = 'navigation';
});

bot.hears('🤍 Позаботиться о себе', async (ctx) => {
    const userId = ctx.from.id;
    const state = await StateManager.get(userId);

    if (!state || state.waitingFor !== 'mixed_choice') {
        return;
    }

    console.log(`🤍 Пользователь ${ctx.from.username} выбрал заботу о себе из MIXED состояния`);

    // Пользователь выбрал позаботиться о себе
    await ctx.reply(
        'Вы сделали правильный выбор - позаботиться о себе. 🤍\n\n' +
        'Вот что может помочь:\n' +
        '• Отдохните, выпейте чай или воды\n' +
        '• Прогуляйтесь на свежем воздухе\n' +
        '• Поговорите с близким человеком\n' +
        '• Сделайте что-то приятное для себя\n' +
        '• Послушайте спокойную музыку\n\n' +
        'Возвращайтесь к практике когда почувствуете, что готовы. 🌸',
        Markup.keyboard([
            ['✅ Практика ОК-ности'],
            ['❓ Помощь']
        ]).resize()
    );
    await StateManager.delete(userId);
});

bot.hears('❌ Отменить', async (ctx) => {
    const userId = ctx.from.id;
    const state = await StateManager.get(userId);

    // Обработка отмены из MIXED состояния
    if (state && state.waitingFor === 'mixed_choice') {
        await StateManager.delete(userId);
        await ctx.reply(
            'Практика отменена. Возвращайтесь когда будете готовы! 😊',
            Markup.keyboard([
                ['✅ Практика ОК-ности'],
                ['❓ Помощь']
            ]).resize()
        );
    }
});

bot.hears('❌ Отменить практику', async (ctx) => {
    const userId = ctx.from.id;
    await StateManager.delete(userId);

    await ctx.reply(
        'Практика отменена. Возвращайтесь когда будете готовы! 😊',
        Markup.keyboard([
            ['✅ Практика ОК-ности'],
            ['❓ Помощь']
        ]).resize()
    );
});

// ==================== ОБРАБОТКА ТЕКСТОВЫХ СООБЩЕНИЙ ====================

bot.on('text', async (ctx) => {
    const userId = ctx.from.id;
    const state = await StateManager.get(userId);

    // Если пользователь не в практике
    if (!state || state.mode !== 'heal_practice') {
        await ctx.reply('Используйте /practice чтобы начать практику HEAL ✨');
        return;
    }

    // Обрабатываем в зависимости от того, что ожидаем
    if (state.waitingFor === 'step_input') {
        await handleStepInput(ctx, state);
    } else if (state.waitingFor === 'question') {
        await handleQuestionInput(ctx, state);
    } else {
        // Состояние navigation или completion - ждём кнопку
        await ctx.reply('Используйте кнопки для навигации 👇');
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
// ==================== VERCEL SERVERLESS EXPORT ====================
// Для Vercel экспортируем Express app как serverless function
// Webhook устанавливается вручную после деплоя через Telegram API

export default app;

// NOTE: В Vercel webhook устанавливается командой:
// curl -F "url=https://<your-vercel-url>/webhook/<BOT_TOKEN>" \
//      https://api.telegram.org/bot<BOT_TOKEN>/setWebhook
