import { ModuleIntegration, ModuleKind, ModuleStatus } from '../types';

export const MODULE_KINDS: Array<{
  kind: ModuleKind;
  label: string;
  description: string;
  icon: string;
}> = [
  {
    kind: 'rest',
    label: 'REST API',
    description: 'HTTP-сервис с токеном или без.',
    icon: 'globe',
  },
  {
    kind: 'webhook',
    label: 'Webhook',
    description: 'Приём событий от внешней системы.',
    icon: 'bolt',
  },
  {
    kind: 'oauth',
    label: 'OAuth',
    description: 'Вход через сторонний аккаунт.',
    icon: 'key',
  },
  {
    kind: 'mcp',
    label: 'MCP-сервер',
    description: 'Инструменты Model Context Protocol.',
    icon: 'puzzle',
  },
  {
    kind: 'builtin',
    label: 'Встроенный',
    description: 'Локальный коннектор Tessera.',
    icon: 'cube',
  },
];

export const KIND_LABELS: Record<ModuleKind, string> = {
  builtin: 'Встроенный',
  rest: 'REST',
  webhook: 'Webhook',
  mcp: 'MCP',
  oauth: 'OAuth',
};

export const STATUS_LABELS: Record<ModuleStatus, string> = {
  connected: 'Подключён',
  disconnected: 'Отключён',
  error: 'Ошибка',
  checking: 'Проверка…',
};

export async function testModule(module: ModuleIntegration): Promise<{
  status: ModuleStatus;
  message: string;
}> {
  if (module.kind === 'builtin') {
    await new Promise((resolve) => setTimeout(resolve, 450));
    return { status: 'connected', message: 'Локальный коннектор доступен.' };
  }

  if (!module.endpoint) {
    return { status: 'error', message: 'Не указан endpoint.' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  let headers: Record<string, string> = { Accept: 'application/json' };
  if (module.token) headers.Authorization = `Bearer ${module.token}`;
  if (module.headers) {
    try {
      const parsed = JSON.parse(module.headers) as Record<string, string>;
      headers = { ...headers, ...parsed };
    } catch {
      return { status: 'error', message: 'Заголовки должны быть корректным JSON.' };
    }
  }

  try {
    const res = await fetch(module.endpoint, {
      method: 'GET',
      headers,
      signal: controller.signal,
      mode: 'cors',
    });
    if (res.ok || res.status === 401 || res.status === 403) {
      return {
        status: res.ok ? 'connected' : 'error',
        message: res.ok
          ? `Ответ ${res.status}. Соединение работает.`
          : `Ответ ${res.status}. Проверьте токен и права.`,
      };
    }
    return { status: 'error', message: `Сервис ответил ${res.status}.` };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      status: 'error',
      message:
        message.includes('abort') || message.includes('Abort')
          ? 'Таймаут: сервис не ответил за 8 секунд.'
          : 'Не удалось подключиться. Возможен CORS или неверный адрес.',
    };
  } finally {
    clearTimeout(timer);
  }
}
