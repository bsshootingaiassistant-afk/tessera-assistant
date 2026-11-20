export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ModuleSummary {
  id?: string;
  name: string;
  kind: string;
  enabled: boolean;
  status: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  modules?: ModuleSummary[];
}

const SYSTEM_PROMPT = `Ты — Tessera, персональный ИИ-ассистент по модулям и интеграциям приложения.
Отвечай на русском, кратко и по делу. Помогай подключать REST, webhook, OAuth и MCP-модули,
объясняй шаги настройки и проверяй статусы. Не выдумывай факты о подключениях: используй
переданный список модулей. Если данных не хватает — задай один точный вопрос.
Форматируй ответ markdown-ом: короткие абзацы, списки, блоки кода для примеров.`;

function moduleLines(modules: ModuleSummary[] | undefined): string {
  if (!modules || modules.length === 0) return 'Подключённых модулей нет.';
  return modules
    .map(
      (m) =>
        `- ${m.name}: тип ${m.kind}, ${m.enabled ? 'включён' : 'выключен'}, статус ${m.status}`,
    )
    .join('\n');
}

function localAnswer(request: ChatRequest): string {
  const last = [...request.messages].reverse().find((m) => m.role === 'user');
  const text = (last?.content ?? '').toLowerCase();
  const modules = request.modules ?? [];
  const list = moduleLines(modules);

  if (/(привет|здравствуй|hello|hi)/.test(text) && text.length < 40) {
    return 'Привет! Я Tessera. Помогу подключить модуль, проверить интеграцию или настроить приложение. С чего начнём?';
  }
  if (/(что ты умеешь|возможност|help)/.test(text)) {
    return 'Я умею:\n\n1. Подключать REST, webhook, OAuth и MCP-модули.\n2. Проверять доступность endpoint.\n3. Объяснять, как модуль встраивается в сценарии.\n4. Помогать с настройками модели и обновлениями.\n\nОткройте панель «Модули» или напишите название сервиса.';
  }
  if (/(какие модул|список модул|что подключен|статус)/.test(text)) {
    return `Текущие модули:\n\n${list}\n\nПереключатели и кнопка «Проверить» находятся в панели «Модули».`;
  }
  if (/(добав|подключ|интеграц)/.test(text)) {
    return `Чтобы добавить интеграцию:\n\n1. Нажмите «+ Модуль» в панели справа.\n2. Выберите тип: REST, Webhook, OAuth или MCP.\n3. Укажите endpoint и токен.\n4. Нажмите «Проверить», затем «Сохранить».\n\n${list}`;
  }
  if (/(обнов|версия|apk|release)/.test(text)) {
    return 'Веб-версия обновляется автоматически после деплоя. Android APK публикуется в GitHub Releases: приложение сравнивает версии и предлагает обновление. Проверить вручную можно в настройках → «Обновления».';
  }
  if (/(настройк|тема|модель|ключ|api)/.test(text)) {
    return 'Настройки открываются шестерёнкой внизу слева. В разделе «ИИ и API» можно указать собственный endpoint и ключ, в «Обновлениях» — включить автопроверку релизов.';
  }

  return `Принял: «${(last?.content ?? '').slice(0, 160)}».\n\nСейчас доступны модули:\n\n${list}\n\nМогу разложить задачу на шаги или подсказать подходящий тип подключения. Уточните название сервиса и что он должен делать.`;
}

function buildMessages(request: ChatRequest): ChatMessage[] {
  const history = (request.messages ?? [])
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-24);

  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'system', content: `Модули приложения:\n${moduleLines(request.modules)}` },
    ...history,
  ];
}

export class ChatService {
  async streamChat(request: ChatRequest, onDelta: (text: string) => void): Promise<void> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      await this.streamLocal(request, onDelta);
      return;
    }

    const base = (process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1').replace(/\/+$/, '');
    const model =
      request.model && request.model !== 'tessera-core'
        ? request.model
        : process.env.OPENAI_MODEL ?? 'gpt-4o-mini';

    const response = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: buildMessages(request),
        temperature: typeof request.temperature === 'number' ? request.temperature : 0.4,
        stream: true,
      }),
    });

    if (!response.ok || !response.body) {
      const detail = await response.text().catch(() => '');
      throw new Error(`LLM ${response.status}: ${detail.slice(0, 300)}`);
    }

    const reader = response.body.getReader();
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
            choices?: Array<{ delta?: { content?: string } }>;
          };
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) onDelta(delta);
        } catch {
          // Ignore keep-alive and non-JSON frames.
        }
      }
    }
  }

  private async streamLocal(request: ChatRequest, onDelta: (text: string) => void): Promise<void> {
    const answer = localAnswer(request);
    const chunks = answer.match(/[\s\S]{1,24}/g) ?? [answer];
    for (const chunk of chunks) {
      onDelta(chunk);
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }
}
