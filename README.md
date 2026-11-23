# Tessera

Персональный ИИ-ассистент в стиле чата для работы с модулями и интеграциями. Один кодбейс даёт:

- **веб-приложение** (Windows, macOS, Linux, iPhone/iPad — устанавливается как PWA);
- **Android APK**, который публикуется в GitHub Releases и умеет обновляться поверх установленной версии;
- **локальный офлайн-режим** без API-ключа;
- **подключение собственного LLM** через OpenAI-совместимый endpoint;
- **модули и интеграции**: REST, webhook, OAuth, MCP, встроенные коннекторы.

---

## Содержание

1. [Архитектура](#архитектура)
2. [Дизайн и визуальный стиль](#дизайн-и-визуальный-стиль)
3. [Структура репозитория](#структура-репозитория)
4. [Локальный запуск](#локальный-запуск)
5. [Настройка ИИ](#настройка-ии)
6. [Модули](#модули)
7. [Сборка Android APK](#сборка-android-apk)
8. [Деплой на GitHub](#деплой-на-github)
9. [Автообновление APK](#автообновление-apk)
10. [Переменные окружения](#переменные-окружения)
11. [Безопасность](#безопасность)
12. [Roadmap](#roadmap)

---

## Архитектура

```
┌─────────────────────────────────────────────────────────────┐
│                        Клиенты                              │
│  Web / PWA (React)          Android (Capacitor WebView)     │
└───────────────┬─────────────────────────┬───────────────────┘
                │ HTTPS                   │ HTTPS
                ▼                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    apps/web (React + Vite)                  │
│  Chat UI · Modules panel · Settings · Update checker        │
│  localStorage: чаты, модули, настройки                      │
└───────────────┬─────────────────────────────────────────────┘
                │ POST /api/chat (SSE)
                ▼
┌─────────────────────────────────────────────────────────────┐
│                  apps/server (NestJS)                       │
│  Chat proxy · модульный каталог · health                    │
│  OpenAI-совместимый LLM или офлайн-ответчик                 │
└─────────────────────────────────────────────────────────────┘
```

**Ключевые решения**

| Решение | Причина |
| --- | --- |
| Один React-кодбейс для web и Android | Одинаковый UI, быстрые релизы, меньше расхождений |
| Capacitor вместо отдельного React Native | Не нужен второй UI-слой; APK собирается из того же `dist` |
| Локальный fallback-ассистент | Приложение работает без ключей и сети |
| SSE-стриминг | Ответ появляется постепенно, как в ChatGPT |
| GitHub Releases как канал обновлений | Бесплатно, версионирование, прямая ссылка на APK |
| localStorage | Приватность: данные не уходят на сервер без явного API |

**Поток сообщения**

1. Пользователь отправляет текст.
2. `App.tsx` добавляет сообщение и пустой ответ ассистента.
3. `streamAssistant()` выбирает маршрут:
   - `settings.apiBase` заполнен → `POST {apiBase}/api/chat`, разбор SSE;
   - иначе → локальный генератор `localReply()` с посимвольной выдачей.
4. Каждый чанк обновляет сообщение в состоянии и localStorage.
5. По завершении добавляются контекстные подсказки.

---

## Дизайн и визуальный стиль

**Концепция:** «тихая мастерская» — тёмная стеклянная панель, акцентные плитки-тессеры, минимум визуального шума, максимум читаемости.

| Токен | Значение |
| --- | --- |
| Шрифт | `Inter` (UI), `JetBrains Mono` (код) |
| Тёмный фон | `#0B0F14`, поверхности `#111823` / `#16202E` |
| Светлый фон | `#F4F6FB`, поверхности `#FFFFFF` / `#F7F9FD` |
| Акценты | indigo `#7C9CFF`, teal `#2DD4BF`, violet `#A78BFA`, amber `#FBBF24` |
| Радиусы | 8 / 12 / 18 / 24 px |
| Сетка | sidebar 290 px · чат 1fr · панель модулей 380 px |
| Анимации | 120–280 мс, `prefers-reduced-motion` уважается |

**Компоненты**

- **Sidebar** — бренд, новый чат, поиск, история, модули, настройки, версия.
- **Chat header** — название чата, режим (API/локальный), число активных модулей.
- **Messages** — аватары, markdown, блоки кода с копированием, chips-подсказки.
- **Composer** — авто-растущее поле, отправка/остановка, быстрые действия.
- **Modules panel** — статистика, карточки модулей, переключатели, проверка, популярные интеграции.
- **Modals** — добавление модуля (тип, endpoint, токен, headers, тест) и настройки (4 вкладки).
- **Update banner** — новая версия, кнопка загрузки, dismiss.

**Адаптивность**

- ≥ 1180 px — три колонки.
- 960–1180 px — панель модулей выезжает поверх.
- < 960 px — sidebar превращается в drawer, появляется кнопка меню.
- < 640 px — компактные отступы, скрываются второстепенные подписи.

**Доступность:** focus-visible, aria-label, role=switch, контраст текста, клавиатурные сокращения `Ctrl/⌘+K` (новый чат), `Ctrl/⌘+,` (настройки), `Esc` (закрыть панели).

---

## Структура репозитория

```
tessera-assistant/
├─ apps/
│  ├─ web/                     # React + Vite + Capacitor
│  │  ├─ public/               # manifest, иконки, service worker
│  │  ├─ src/
│  │  │  ├─ components/        # Sidebar, ChatView, ModulesPanel, modals
│  │  │  ├─ lib/               # assistant, modules, store, update, version
│  │  │  ├─ App.tsx
│  │  │  ├─ styles.css         # дизайн-система
│  │  │  └─ types.ts
│  │  ├─ capacitor.config.ts
│  │  └─ vite.config.ts
│  └─ server/                  # NestJS API
│     └─ src/
│        ├─ chat/              # SSE-контроллер и LLM-прокси
│        ├─ modules/           # каталог и валидация endpoint
│        └─ health.controller.ts
├─ packages/
│  └─ kernel/                  # задел под Dart-ядро Tessera
├─ scripts/
│  └─ patch-android.mjs        # версия + разрешение на установку APK
├─ .github/workflows/deploy.yml
├─ package.json                # npm workspaces
└─ README.md
```

---

## Локальный запуск

Требования: **Node.js ≥ 20**, npm ≥ 10.

```bash
npm install

# терминал 1 — API (необязательно, для реальной модели)
npm run dev:api

# терминал 2 — веб-приложение
npm run dev:web
```

Откройте `http://localhost:5173`.

Проверки:

```bash
npm run typecheck
npm run test
npm run build:web
```

### Локальная сборка APK

Нужны JDK 21 и Android SDK.

```bash
npm run build:web
cd apps/web
npx cap add android      # один раз
npx cap sync android
node ../../scripts/patch-android.mjs
cd android && ./gradlew assembleDebug
```

APK: `apps/web/android/app/build/outputs/apk/debug/app-debug.apk`.

---

## Настройка ИИ

По умолчанию приложение работает **офлайн**: ответы генерирует встроенный помощник, данные не покидают устройство.

В **Настройках → ИИ и API** выберите провайдера — base URL и модель подставятся автоматически. Кнопка **«Загрузить»** запрашивает каталог моделей и заполняет список, чтобы не вводить имя вручную.

| Провайдер | Base URL | Каталог моделей |
| --- | --- | --- |
| OpenAI | `https://api.openai.com/v1` | `GET /models` |
| OpenRouter | `https://openrouter.ai/api/v1` | `GET /models` (открыт) |
| DeepSeek | `https://api.deepseek.com/v1` | `GET /models` |
| Mistral | `https://api.mistral.ai/v1` | `GET /models` |
| Groq | `https://api.groq.com/openai/v1` | `GET /models` |
| Together AI | `https://api.together.xyz/v1` | `GET /models` |
| Fireworks AI | `https://api.fireworks.ai/inference/v1` | `GET /models` |
| xAI | `https://api.x.ai/v1` | `GET /models` |
| Ollama | `http://localhost:11434/v1` | `GET /api/tags` |
| LM Studio | `http://localhost:1234/v1` | `GET /models` |
| Tessera API | `http://localhost:3000` | вручную |

Облачные провайдеры вызываются напрямую из браузера; ключ хранится в localStorage и уходит только выбранному сервису. Для локальных серверов с HTTPS-страницы браузер может блокировать mixed content — тогда используйте режим **Tessera API**:

```bash
cp apps/server/.env.example apps/server/.env
# OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_MODEL
npm run dev:api
```

В приложении выберите провайдера **Tessera API** и укажите `http://localhost:3000`. Сервер проксирует запросы и без ключа стримит локальные ответы.

---

## Модули

Типы подключений:

| Тип | Назначение | Обязательные поля |
| --- | --- | --- |
| REST | HTTP-сервис | endpoint, опционально токен/headers |
| Webhook | приём событий | endpoint |
| OAuth | вход через аккаунт | endpoint, токен |
| MCP | сервер инструментов | endpoint |
| Встроенный | локальный коннектор | — |

Проверка модуля делает `GET` на endpoint с таймаутом 8 секунд. Если браузер блокирует CORS, приложение сообщает об этом и предлагает проверить через сервер (`POST /api/modules/validate`).

Токены и headers хранятся **только в localStorage** устройства и отправляются напрямую на указанный endpoint.

---

## Отзывы и режим разработчика

В приложении нет GitHub-логина, OAuth-сессий и встроенных токенов. Публичный репозиторий используется только как источник релизов и (опционально) как форма отзывов.

1. **Настройки → Разработчик → «Показывать кнопку “Отзыв”»**.
2. После включения кнопка **«Отзыв»** появляется поверх любого экрана: чат, модули, форма интеграции, настройки.
3. Форма собирает тип отзыва, сообщение, необязательный контакт и диагностику (версия, страница, тема, число модулей, браузер).

Куда уходит отзыв:

| Настройка | Поведение |
| --- | --- |
| `Endpoint отзывов` заполнен | `POST {endpoint}/api/feedback` с JSON |
| Endpoint пуст, репозиторий известен | открывается публичная форма GitHub Issues; вход в GitHub — только в браузере |
| Ничего не настроено | отзыв сохраняется в `localStorage`, доступна кнопка «Скопировать» |

Собственный сервер Tessera уже принимает отзывы: `POST /api/feedback` пишет `data/feedback.ndjson` (каталог можно изменить через `FEEDBACK_DIR`).

---

## Сборка Android APK

APK собирается в CI и публикуется в GitHub Releases. Локально — см. выше.

Что делает `scripts/patch-android.mjs`:

- подставляет `versionName` из корневого `package.json`;
- вычисляет `versionCode` как `major*10000 + minor*100 + patch`;
- добавляет `REQUEST_INSTALL_PACKAGES` — разрешение на запуск установщика APK;
- отключает cleartext traffic.

Подпись:

- `appId` — `ai.tessera.assistant` (уникальный, не конфликтует с пакетом `com.tessera.assistant`);
- CI подписывает debug APK **постоянным ключом** из GitHub Secrets, поэтому новая версия ставится поверх предыдущей и данные сохраняются;
- секреты: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`;
- локальная копия keystore: `C:\Users\Home_PC\.secrets\tessera-release.jks` (в репозиторий не попадает).

Если секреты не заданы, CI откатывается на временную debug-подпись и предупреждает об этом — такие APK не обновляются поверх друг друга.

---

## Деплой на GitHub

### 1. Создайте репозиторий

```bash
git init
git add .
git commit -m "feat: Tessera assistant"
git branch -M main
git remote add origin https://github.com/<USERNAME>/tessera-assistant.git
git push -u origin main
```

### 2. Включите GitHub Pages

**Settings → Pages → Build and deployment → Source: GitHub Actions.**

После первого пуша workflow `Deploy Tessera`:

1. `verify` — typecheck и тесты;
2. `build-web` — сборка `apps/web/dist` с `VITE_GITHUB_REPO`;
3. `deploy-pages` — публикация на `https://<USERNAME>.github.io/tessera-assistant/`;
4. `build-android` — Capacitor + Gradle → `tessera-assistant.apk`;
5. `Publish GitHub Release` — тег `v<version>`, APK в ассетах.

### 3. Проверьте результат

- Веб: `https://<USERNAME>.github.io/tessera-assistant/`
- APK: `https://github.com/<USERNAME>/tessera-assistant/releases/latest`
- Actions: вкладка **Actions**

### 4. Обновление версии

```bash
npm version patch   # 0.1.0 → 0.1.1, создаёт коммит и тег
git push --follow-tags
```

Workflow соберёт новую версию, обновит релиз `v0.1.1` и APK.

> Если Pages не включён, job `deploy-pages` упадёт с понятной ошибкой — включите Source: GitHub Actions и перезапустите workflow.

### 5. iPhone / Windows

- **iPhone/iPad:** откройте веб-адрес в Safari → «Поделиться» → «На экран “Домой”». Работает как PWA, офлайн-кэш через service worker.
- **Windows:** Chrome/Edge → иконка установки в адресной строке. Приложение появится в меню «Пуск».
- Нативная iOS-сборка возможна через `npx cap add ios`, но требует macOS, Xcode и подписи Apple Developer.

---

## Автообновление APK

1. CI кладёт `tessera-assistant.apk` в **latest** release.
2. При запуске приложение (если включено «Проверять обновления») запрашивает:
   `https://api.github.com/repos/<owner>/<repo>/releases/latest`.
3. Сравнивает `tag_name` с `__APP_VERSION__`.
4. Показывает баннер «Доступно обновление».
5. На Android:
   - APK скачивается в `Cache` через `@capacitor/filesystem`;
   - установщик открывается через `cordova-plugin-file-opener2`;
   - если плагин недоступен — открывается ссылка на скачивание.
6. Установка поверх сохраняет данные (чаты, модули, настройки).

На веб-версии кнопка «Обновить» открывает страницу релиза; сама веб-версия обновляется при перезагрузке после деплоя.

Настройка: `VITE_GITHUB_REPO` подставляется в CI как `${{ github.repository }}`. Локально можно создать `apps/web/.env.local`:

```env
VITE_GITHUB_REPO=username/tessera-assistant
```

---

## Переменные окружения

### Web (`apps/web`)

| Переменная | Назначение |
| --- | --- |
| `VITE_GITHUB_REPO` | `owner/repo` для проверки релизов |
| `VITE_API_BASE` | предзаполнить API endpoint (необязательно) |

### Server (`apps/server`)

| Переменная | Назначение |
| --- | --- |
| `PORT` | порт API, по умолчанию 3000 |
| `OPENAI_API_KEY` | ключ LLM; без него — офлайн-ответчик |
| `OPENAI_BASE_URL` | OpenAI-совместимый base URL |
| `OPENAI_MODEL` | модель по умолчанию |
| `FEEDBACK_DIR` | каталог для `feedback.ndjson`, по умолчанию `./data` |

---

## Безопасность

- API-ключ из настроек хранится в localStorage и уходит **только** на указанный вами endpoint. Не коммитьте `.env`.
- Для публичного деплоя используйте собственный backend-прокси: не встраивайте ключи в веб-бандл.
- Токены модулей не покидают устройство.
- Service worker кэширует только same-origin GET-запросы.
- APK собирается без секретов; keystore для release-подписи храните в GitHub Secrets.

---

## Roadmap

- [ ] Синхронизация чатов между устройствами (Supabase / собственный backend).
- [ ] OAuth-flow с PKCE для Google Drive и Notion.
- [ ] MCP-клиент с JSON-RPC handshake и списком tools.
- [ ] Голосовой ввод (Web Speech API + Whisper).
- [ ] Экспорт чата в Markdown/PDF.
- [ ] Release-подпись APK и публикация в RuStore / Google Play.
- [ ] Тёмная/светлая тема по расписанию.
- [ ] Плагинная система модулей (Dart `packages/kernel`).
