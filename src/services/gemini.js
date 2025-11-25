import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Сервис для работы с Gemini Flash API
 */
class GeminiService {
    constructor(apiKey) {
        this.genAI = new GoogleGenerativeAI(apiKey);
        this.model = this.genAI.getGenerativeModel({
            model: 'gemini-2.0-flash-exp',
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

            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            return text.trim();
        } catch (error) {
            console.error('Ошибка Gemini API:', error);
            throw new Error('Не удалось получить ответ от AI. Попробуйте позже.');
        }
    }

    /**
     * Проверка работоспособности API
     * @returns {Promise<boolean>}
     */
    async healthCheck() {
        try {
            await this.model.generateContent('Привет');
            return true;
        } catch (error) {
            console.error('Health check failed:', error);
            return false;
        }
    }
}

export default GeminiService;
