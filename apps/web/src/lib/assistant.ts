import { ChatMessage, ModuleIntegration, Settings } from '../types';
import { normalizeBase, sleep } from './utils';

export interface AssistantRequest {
  messages: ChatMessage[];
  modules: ModuleIntegration[];
  settings: Settings;
  signal?: AbortSignal;
}

const KIND_LABEL: Record<string, string> = {
  builtin: 'встроенный',
  rest: 'REST',
  webhook: 'webhook',
  mcp: 'MCP',
  oauth: 'OAuth',
};

function modulesOverview(modules: ModuleIntegration[]): string {
  if (modules.length === 0) {
    return 'Пока не подключено ни одного модуля. Начни с **REST API** — он подходит почти для любого сервиса.';
  }
  return modules
    .map((m) => {
      const status =
        m.status === 'connected'
          ? '🟢 подключён'
          : m.status === 'error'
            ? '🔴 ошибка'
            : m.status === 'checking'
              ? '🟡 проверка'
              : '⚪ выключен';
      return `- **${m.name}** (${KIND_LABEL[m.kind] ?? m.kind}) — ${status}${m.enabled ? '' : ', отключён'}`;
    })
    .join('\n');
}

function connectedCount(modules: ModuleIntegration[]): number {
  return modules.filter((m) => m.enabled && m.status === 'connected').length;
}

function capabilitiesReply(): string {
  return `Вот что я умею как ассистент по модулям:

1. **Подключать интеграции** — REST, webhook, OAuth, MCP и встроенные модули.
2. **Проверять соединение** — отправлю тестовый запрос к endpoint и покажу статус.
3. **Объяснять архитектуру** — как модуль встраивается в приложение и какие данные получает.
4. **Помогать с настройками** — модель, API-ключ, тема, автообновление.
5. **Следить за обновлениями** — приложение само проверяет релизы на GitHub.

Открой панель **«Модули»** справа, чтобы увидеть текущие подключения, или напиши, какой сервис хочешь добавить.`;
}

function addIntegrationReply(text: string): string {
  const lower = text.toLowerCase();
  let hint = '';
  if (lower.includes('github')) {
    hint =
      'Для GitHub укажи `https://api.github.com` и personal access token с правами `repo` и `read:org`.';
  } else if (lower.includes('google') || lower.includes('drive')) {
    hint =
      'Для Google Drive нужен OAuth-клиент в Google Cloud Console; в Tessera выбери тип **OAuth** и вставь Client ID.';
  } else if (lower.includes('telegram')) {
    hint = 'Для Telegram создай бота через @BotFather и укажи endpoint `https://api.telegram.org`.';
  } else if (lower.includes('notion')) {
    hint = 'Для Notion создай internal integration и укажи endpoint `https://api.notion.com/v1`.';
  }

  return `Добавить интеграцию можно за минуту:

1. Нажми **«+ Модуль»** в панели справа (или кнопку «Добавить интеграцию»).
2. Выбери тип подключения:
   - **REST** — обычный HTTP-сервис;
   - **Webhook** — приём событий по URL;
   - **OAuth** — вход через сторонний аккаунт;
   - **MCP** — сервер инструментов Model Context Protocol.
3. Укажи имя, endpoint и токен. Заголовки можно добавить JSON-объектом.
4. Нажми **«Проверить»**, затем **«Сохранить»**.

${hint ? `${hint}\n\n` : ''}Модуль появится в списке, и я сразу смогу учитывать его в ответах.`;
}

function settingsReply(): string {
  return `Настройки открываются шестерёнкой в левом нижнем углу. Там есть:

- **Тема** — системная, светлая или тёмная;
- **Акцент** — четыре цветовые схемы;
- **ИИ** — адрес API, модель, температура и ключ (ключ хранится только на устройстве);
- **Обновления** — автопроверка релизов и кнопка «Проверить сейчас»;
- **Данные** — экспорт чатов и полная очистка.

Если хочешь подключить собственный бэкенд, укажи его базовый URL в поле **«API endpoint»**, например \`https://api.example.com\`. Запросы уйдут на \`POST /api/chat\`.`;
}

function updateReply(settings: Settings): string {
  return `Обновление устроено так:

- **Веб-версия** обновляется сама: GitHub Actions пересобирает сайт при каждом пуше в \`main\`.
- **Android APK** публикуется в GitHub Releases; приложение сравнивает текущую версию с последним релизом.
- Если доступна новая версия, сверху появится баннер **«Доступно обновление»** с кнопкой загрузки.
- Автопроверка сейчас ${settings.autoUpdate ? 'включена' : 'выключена'} — переключается в настройках.

Текущая версия: **${__APP_VERSION__}**.`;
}

function codeReply(): string {
  return `Пример подключения REST-модуля в коде:

\`\`\`ts
const module = {
  name: 'Мой сервис',
  kind: 'rest',
  endpoint: 'https://api.example.com',
  headers: { Authorization: \`Bearer \${token}\` },
};

const res = await fetch(\`\${module.endpoint}/health\`, {
  headers: module.headers,
});

if (!res.ok) throw new Error(\`HTTP \${res.status}\`);
\`\`\`

В Tessera этот же запрос выполняет кнопка **«Проверить»** в форме модуля. Для MCP вместо HTTP используется JSON-RPC handshake — выбери тип **MCP** и укажи URL сервера.`;
}

function modulesListReply(modules: ModuleIntegration[]): string {
  const active = connectedCount(modules);
  return `Сейчас в проекте **${modules.length}** модулей, из них активны **${active}**.

${modulesOverview(modules)}

Чтобы изменить состояние, открой панель **«Модули»**. Переключатель включает модуль в сценариях, а кнопка с точками позволяет переименовать, проверить или удалить интеграцию.`;
}

function defaultReply(text: string, modules: ModuleIntegration[]): string {
  const active = modules.filter((m) => m.enabled);
  const names = active.map((m) => m.name).join(', ') || 'пока ни один модуль не включён';
  return `Понял задачу: «${text.trim().slice(0, 140)}».

Сейчас в работе: ${names}. Я могу разложить её на шаги, предложить подходящий модуль или подготовить запрос к API.

Уточни, что важнее:
- подключить новый сервис;
- проверить уже существующую интеграцию;
- изменить настройки приложения.

Если нужен конкретный план — напиши название сервиса и что он должен делать.`;
}

function greetingReply(): string {
  return `Привет! Я Tessera — ассистент по модулям и интеграциям.

Могу подключить новый сервис, проверить текущие соединения или помочь с настройками. С чего начнём?`;
}

function isGreeting(text: string): boolean {
  const t = text.trim().toLowerCase();
  return /^(привет|здравствуй|хай|hello|hi|добрый (день|вечер|утро))[\s!.,]*$/.test(t);
}

export function localReply(text: string, modules: ModuleIntegration[], settings: Settings): string {
  const t = text.toLowerCase();

  if (isGreeting(text)) return greetingReply();
  if (/(что ты умеешь|возможност|чем поможешь|help|команды)/.test(t)) return capabilitiesReply();
  if (/(какие модул|список модул|что подключен|мои модул|статус модул|проверь мои модул)/.test(t)) {
    return modulesListReply(modules);
  }
  if (/(добав|подключ|интеграц|новый модул|new module)/.test(t)) return addIntegrationReply(text);
  if (/(настройк|настрой|тема|акцент|api endpoint|модель|temperature|ключ)/.test(t)) {
    return settingsReply();
  }
  if (/(обнов|update|версия|release|apk)/.test(t)) return updateReply(settings);
  if (/(код|code|пример|fetch|запрос|api)/.test(t)) return codeReply();
  if (/(провер|тест|соединен|доступен|health)/.test(t)) {
    return `Проверить модули можно двумя способами:

1. В панели **«Модули»** нажми на модуль → **«Проверить»**. Для REST отправляется \`GET\` на endpoint, для встроенных проверяется локальный коннектор.
2. Напиши мне «проверь мои модули» — я покажу статусы.

${modulesOverview(modules)}`;
  }

  return defaultReply(text, modules);
}

export function suggestionsFor(text: string): string[] {
  const t = text.toLowerCase();
  if (/(модул|интеграц|подключ)/.test(t)) {
    return ['Как добавить REST-модуль?', 'Проверь мои модули', 'Открой настройки'];
  }
  if (/(настройк|тема|модель)/.test(t)) {
    return ['Как подключить свой API?', 'Что такое MCP?', 'Проверь обновления'];
  }
  if (/(обнов|версия|apk)/.test(t)) {
    return ['Проверь обновления', 'Где скачать APK?', 'Что нового?'];
  }
  return ['Какие модули подключены?', 'Как добавить интеграцию?', 'Что ты умеешь?'];
}

async function* streamFromApi(req: AssistantRequest): AsyncGenerator<string> {
  const base = normalizeBase(req.settings.apiBase);
  const direct = req.settings.provider !== 'tessera';
  const history = req.messages
    .filter((m) => !m.pending)
    .slice(-20)
    .map((m) => ({ role: m.role, content: m.content }));

  const modulesLine = req.modules.length
    ? req.modules
        .map((m) => `${m.name} (${m.kind}, ${m.enabled ? 'вкл' : 'выкл'}, ${m.status})`)
        .join('; ')
    : 'нет подключённых модулей';

  const system = `Ты Tessera — персональный ИИ-ассистент по модулям и интеграциям.
Отвечай на русском, кратко и по делу. Помогай подключать REST, webhook, OAuth и MCP-модули,
объясняй шаги настройки и проверяй статусы. Не выдумывай данные о подключениях.
Модули приложения: ${modulesLine}.`;

  const endpoint = direct ? `${base}/chat/completions` : `${base}/api/chat`;
  const body = direct
    ? {
        model: req.settings.model,
        messages: [{ role: 'system', content: system }, ...history],
        temperature: req.settings.temperature,
        stream: true,
      }
    : {
        messages: history,
        model: req.settings.model,
        temperature: req.settings.temperature,
        modules: req.modules.map((m) => ({
          id: m.id,
          name: m.name,
          kind: m.kind,
          enabled: m.enabled,
          status: m.status,
        })),
      };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(req.settings.apiKey ? { Authorization: `Bearer ${req.settings.apiKey}` } : {}),
    },
    body: JSON.stringify(body),
    signal: req.signal,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(
      `API ${res.status}: ${detail.slice(0, 240) || res.statusText}${
        direct ? ' — проверьте ключ, модель и CORS провайдера.' : ''
      }`,
    );
  }

  const contentType = res.headers.get('content-type') ?? '';

  if (!contentType.includes('text/event-stream') || !res.body) {
    const data = (await res.json()) as {
      content?: string;
      message?: string;
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text =
      data.content ?? data.message ?? data.choices?.[0]?.message?.content ?? '';
    if (text) yield text;
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      try {
        const parsed = JSON.parse(payload) as {
          delta?: string;
          content?: string;
          error?: string;
          choices?: Array<{ delta?: { content?: string } }>;
        };
        if (parsed.error) {
          throw new Error(parsed.error);
        }
        const chunk =
          parsed.delta ??
          parsed.content ??
          parsed.choices?.[0]?.delta?.content ??
          '';
        if (chunk) yield chunk;
      } catch {
        // Ignore malformed keep-alive frames.
      }
    }
  }
}

async function* streamLocal(req: AssistantRequest): AsyncGenerator<string> {
  const lastUser = [...req.messages].reverse().find((m) => m.role === 'user');
  const text = lastUser?.content ?? '';
  const reply = localReply(text, req.modules, req.settings);

  const tokens = reply.match(/[\s\S]{1,18}/g) ?? [reply];
  for (const token of tokens) {
    if (req.signal?.aborted) return;
    yield token;
    await sleep(12);
  }
}

export function streamAssistant(req: AssistantRequest): AsyncGenerator<string> {
  if (normalizeBase(req.settings.apiBase)) {
    return streamFromApi(req);
  }
  return streamLocal(req);
}
