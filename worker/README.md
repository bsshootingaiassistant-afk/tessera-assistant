# Tessera worker

Локальный вычислитель для Android-приложения Tessera.

Возможности:

- `POST /api/chat` — SSE-стриминг от Ollama;
- `POST /api/python` — выполнение Python-кода с таймаутом;
- `POST /api/jobs` — долгая задача в фоне;
- `GET /api/jobs/{id}` — статус и результат;
- `GET /api/health`.

## Запуск

```powershell
cd worker
python -m venv .venv
.\.venv\Scripts\pip install -r requirements.txt
$env:WORKER_TOKEN = "<длинный случайный токен>"
.\.venv\Scripts\python -m uvicorn app:app --host 127.0.0.1 --port 8787
```

Проверка:

```powershell
curl http://127.0.0.1:8787/api/health
```

## Cloudflare Tunnel

```powershell
cloudflared tunnel --url http://127.0.0.1:8787
```

Для постоянного адреса нужен named tunnel и домен в Cloudflare. Для быстрой проверки подойдёт временный `https://*.trycloudflare.com`.

Токен worker-а указывается в Tessera: **Настройки → ИИ и API → Tessera Server → API-ключ**.

## Уведомления на телефон

Worker отправляет push через [ntfy.sh](https://ntfy.sh) при завершении задачи:

1. Установите приложение **ntfy** на Android.
2. Подпишитесь на тему из `NTFY_TOPIC` в `worker/.env` (например, `tessera-dc86efc82f`).
3. Готово: при завершении задачи придёт уведомление с результатом.

Тема — это случайный адрес; не публикуйте её. Для приватности можно поднять свой ntfy-сервер и указать `NTFY_SERVER`.
