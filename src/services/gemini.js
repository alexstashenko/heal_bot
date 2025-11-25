import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Сервис для работы с Gemini Flash API
 */
class GeminiService {
    constructor(apiKey) {
        this.genAI = new GoogleGenerativeAI(apiKey);
        this.model = this.genAI.getGenerativeModel({
            model: 'gemini-2.5-flash',
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 500,
            }
        });
    }

    /**
     * Анализирует практику благодарности/ок-ности пользователя
     * @param {string} userText - Текст от пользователя
     * @returns {Promise<string>} - Анализ от Gemini
     */
    async analyzeGratitude(userText) {
        try {
            const prompt = `Ты - помощник для wellness-практик, помогаешь людям развивать благодарность и позитивное мышление.

Пользователь поделился следующим:
"${userText}"

Твоя задача:
1. Отметь что именно ценного в этом опыте
2. Дай короткий инсайт (1-2 предложения)
3. Будь теплым и поддерживающим

ВАЖНО: 
- Это НЕ терапия, а практика самопомощи
- Не используй клинические термины
- Отвечай на русском языке
- Максимум 2-3 предложения

Ответ:`;

            console.log('📤 Отправка запроса в Gemini...');
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            console.log('✅ Получен ответ от Gemini');
            return text.trim();
        } catch (error) {
            console.error('❌ Ошибка Gemini API:');
            console.error('Тип ошибки:', error.name);
            console.error('Сообщение:', error.message);
            if (error.response) {
                console.error('Детали ответа:', error.response);
            }
            if (error.status) {
                console.error('HTTP статус:', error.status);
            }
            throw new Error('Не удалось получить ответ от AI. Попробуйте позже.');
        }
    }

    /**
     * Проверка работоспособности API с таймаутом
     * @returns {Promise<boolean>}
     */
    async healthCheck() {
        try {
            console.log('Тестовый запрос к Gemini API...');

            // Таймаут 10 секунд
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Timeout')), 10000)
            );

            const checkPromise = this.model.generateContent('Test');

            await Promise.race([checkPromise, timeoutPromise]);

            console.log('✅ Gemini API отвечает');
            return true;
        } catch (error) {
            console.error('⚠️  Gemini API недоступен:', error.message);
            if (error.status) {
                console.error('HTTP статус:', error.status);
            }
            return false;
        }
    }
}

export default GeminiService;
