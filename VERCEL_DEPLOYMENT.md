# Деплой на Vercel

## Предварительные требования

✅ Upstash Redis база данных создана  
✅ Vercel аккаунт  
✅ GitHub репозиторий

---

## 1. Настройка Upstash Redis

Вы уже создали базу данных. У вас есть:

```
UPSTASH_REDIS_REST_URL=https://crack-ox-12609.upstash.io
UPSTASH_REDIS_REST_TOKEN=ATFBAAIncDIwMjdhNTQ5MDM5ZjY0YWYzODZmYjZjMDRhNGZjZjU2MnAyMTI2MDk
```

---

## 2. Деплой на Vercel

### Через GitHub Integration (рекомендуется)

1. Откройте [vercel.com](https://vercel.com)
2. **New Project** → **Import Git Repository**
3. Выберите `heal_bot` репозиторий
4. **ВАЖНО:** Выберите ветку `vercel-deployment`
5. Framework Preset: **Other** (или оставить автоопределение)
6. Root Directory: `./`
7. Build Command: оставить пустым (не требуется для Node.js serverless)
8. Output Directory: оставить пустым

### Environment Variables

В настройках проекта добавьте:

| Key | Value |
|-----|-------|
| `BOT_TOKEN` | Ваш Telegram Bot Token |
| `GEMINI_API_KEY` | Ваш Gemini API Key |
| `UPSTASH_REDIS_REST_URL` | `https://crack-ox-12609.upstash.io` |
| `UPSTASH_REDIS_REST_TOKEN` | `ATFBAAIncDI...` |
| `NODE_ENV` | `production` |

9. **Deploy**

---

## 3. Получение Vercel URL

После деплоя Vercel выдаст URL вида:
```
https://heal-bot-xyz.vercel.app
```

Скопируйте этот URL.

---

## 4. Установка Telegram Webhook

Замените `<BOT_TOKEN>` и `<VERCEL_URL>` на ваши значения:

```bash
curl -F "url=<VERCEL_URL>/webhook/<BOT_TOKEN>" \
     https://api.telegram.org/bot<BOT_TOKEN>/setWebhook
```

**Пример:**
```bash
curl -F "url=https://heal-bot-xyz.vercel.app/webhook/8093833928:AAFhvKXccXxYyEELCSkonaMav0tDKnbHUkI" \
     https://api.telegram.org/bot8093833928:AAFhvKXccXxYyEELCSkonaMav0tDKnbHUkI/setWebhook
```

**Ответ должен быть:**
```json
{
  "ok": true,
  "result": true,
  "description": "Webhook was set"
}
```

---

## 5. Проверка Webhook

```bash
curl https://api.telegram.org/bot<BOT_TOKEN>/getWebhookInfo
```

**Ожидаемый ответ:**
```json
{
  "ok": true,
  "result": {
    "url": "https://heal-bot-xyz.vercel.app/webhook/...",
    "has_custom_certificate": false,
    "pending_update_count": 0,
    "max_connections": 40
  }
}
```

---

## 6. Тестирование бота

Откройте Telegram → найдите вашего бота → `/start`

Бот должен ответить!

---

## Troubleshooting

### Бот не отвечает

1. **Проверьте логи Vercel:**
   - Vercel Dashboard → Project → Functions tab
   - Посмотрите логи вызовов функции

2. **Проверьте webhook:**
   ```bash
   curl https://api.telegram.org/bot<BOT_TOKEN>/getWebhookInfo
   ```

3. **Проверьте Redis подключение:**
   - Upstash Console → посмотрите активность
   - Должны быть запросы GET/SET

### Ошибка "unauthorized"

- Проверьте что `UPSTASH_REDIS_REST_TOKEN` правильный в Vercel Environment Variables

### Холодные старты

- Первый запрос после ~5 минут неактивности может занять 500-1000ms
- Это нормально для serverless
- Последующие запросы будут быстрыми (~100ms)

---

## Отличия от Railway версии

| Аспект | Railway (main branch) | Vercel (vercel-deployment) |
|--------|----------------------|---------------------------|
| **State** | In-memory Map | Upstash Redis |
| **Холодный старт** | Нет | ~500ms после неактивности |
| **Масштабирование** | Вертикальное | Горизонтальное (автоматическое) |
| **Стоимость** | $5/мес после trial | Бесплатно (до лимитов) |
| **TTL состояния** | Бесконечно | 1 час (настраивается) |

---

## Переключение между версиями

### Вернуться на Railway:
```bash
git checkout main
# Deploy на Railway как обычно
```

### Вернуться на Vercel:
```bash
git checkout vercel-deployment
git push origin vercel-deployment
# Vercel автоматически задеплоит
```

---

## 🎉 Готово!

Ваш бот работает на Vercel Serverless с Redis state management!
