import { Redis } from '@upstash/redis';

// Инициализация Redis клиента
const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

/**
 * State Manager для работы с пользовательскими состояниями в Redis
 * Заменяет in-memory Map для совместимости с Vercel Serverless
 */
export const StateManager = {
    /**
     * Получить состояние пользователя из Redis
     * @param {number|string} userId - Telegram user ID
     * @returns {Promise<Object|null>} - Состояние пользователя или null
     */
    async get(userId) {
        try {
            const state = await redis.get(`user:${userId}`);
            if (state) {
                console.log(`📥 State loaded for user ${userId}`);
            }
            return state; // Redis автоматически десериализует JSON
        } catch (error) {
            console.error(`❌ Ошибка получения state для ${userId}:`, error);
            return null;
        }
    },

    /**
     * Сохранить состояние пользователя в Redis
     * TTL: 3600 секунд (1 час) - автоматически удаляется если практика не завершена
     * @param {number|string} userId - Telegram user ID
     * @param {Object} state - Объект состояния
     * @returns {Promise<boolean>} - Успешность операции
     */
    async set(userId, state) {
        try {
            await redis.set(`user:${userId}`, state, {
                ex: 3600  // Истекает через 1 час
            });
            console.log(`💾 State saved for user ${userId}`);
            return true;
        } catch (error) {
            console.error(`❌ Ошибка сохранения state для ${userId}:`, error);
            return false;
        }
    },

    /**
     * Удалить состояние пользователя из Redis
     * Используется при завершении или отмене практики
     * @param {number|string} userId - Telegram user ID
     * @returns {Promise<boolean>} - Успешность операции
     */
    async delete(userId) {
        try {
            await redis.del(`user:${userId}`);
            console.log(`🗑️ State deleted for user ${userId}`);
            return true;
        } catch (error) {
            console.error(`❌ Ошибка удаления state для ${userId}:`, error);
            return false;
        }
    },

    /**
     * Проверить существование состояния пользователя
     * @param {number|string} userId - Telegram user ID
     * @returns {Promise<boolean>} - true если состояние существует
     */
    async exists(userId) {
        try {
            const exists = await redis.exists(`user:${userId}`);
            return exists === 1;
        } catch (error) {
            console.error(`❌ Ошибка проверки state для ${userId}:`, error);
            return false;
        }
    }
};
