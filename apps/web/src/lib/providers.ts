import { ProviderId, Settings } from '../types';
import { normalizeBase } from './utils';

export interface ProviderPreset {
  id: ProviderId;
  name: string;
  baseUrl: string;
  model: string;
  docsUrl: string;
  keysUrl?: string;
  hint: string;
  local?: boolean;
}

export const PROVIDERS: ProviderPreset[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    docsUrl: 'https://platform.openai.com/docs/api-reference',
    keysUrl: 'https://platform.openai.com/api-keys',
    hint: 'Официальный API OpenAI.',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'openai/gpt-4o-mini',
    docsUrl: 'https://openrouter.ai/docs',
    keysUrl: 'https://openrouter.ai/keys',
    hint: 'Сотни моделей через один ключ; каталог моделей открыт.',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    docsUrl: 'https://api-docs.deepseek.com',
    keysUrl: 'https://platform.deepseek.com/api_keys',
    hint: 'DeepSeek Chat и Reasoner.',
  },
  {
    id: 'mistral',
    name: 'Mistral',
    baseUrl: 'https://api.mistral.ai/v1',
    model: 'mistral-small-latest',
    docsUrl: 'https://docs.mistral.ai',
    keysUrl: 'https://console.mistral.ai/api-keys',
    hint: 'Mistral La Plateforme, OpenAI-совместимый режим.',
  },
  {
    id: 'groq',
    name: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    model: 'llama-3.3-70b-versatile',
    docsUrl: 'https://console.groq.com/docs',
    keysUrl: 'https://console.groq.com/keys',
    hint: 'Быстрый инференс Llama и других открытых моделей.',
  },
  {
    id: 'together',
    name: 'Together AI',
    baseUrl: 'https://api.together.xyz/v1',
    model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    docsUrl: 'https://docs.together.ai',
    keysUrl: 'https://api.together.ai/settings/api-keys',
    hint: 'Открытые модели и собственные endpoint-ы.',
  },
  {
    id: 'fireworks',
    name: 'Fireworks AI',
    baseUrl: 'https://api.fireworks.ai/inference/v1',
    model: 'accounts/fireworks/models/llama-v3p3-70b-instruct',
    docsUrl: 'https://docs.fireworks.ai',
    keysUrl: 'https://fireworks.ai/account/api-keys',
    hint: 'OpenAI-совместимый inference.',
  },
  {
    id: 'xai',
    name: 'xAI',
    baseUrl: 'https://api.x.ai/v1',
    model: 'grok-2-latest',
    docsUrl: 'https://docs.x.ai',
    keysUrl: 'https://console.x.ai',
    hint: 'Модели Grok.',
  },
  {
    id: 'ollama',
    name: 'Ollama (локально)',
    baseUrl: 'http://localhost:11434/v1',
    model: 'qwen2.5-coder:14b',
    docsUrl: 'https://docs.ollama.com/api',
    hint: 'Локальный сервер Ollama; ключ не нужен.',
    local: true,
  },
  {
    id: 'lmstudio',
    name: 'LM Studio (локально)',
    baseUrl: 'http://localhost:1234/v1',
    model: 'local-model',
    docsUrl: 'https://lmstudio.ai/docs/local-server',
    hint: 'Local Server в LM Studio; ключ не нужен.',
    local: true,
  },
  {
    id: 'tessera',
    name: 'Tessera API (свой сервер)',
    baseUrl: 'http://localhost:3000',
    model: 'tessera-core',
    docsUrl: '',
    hint: 'Собственный сервер Tessera: POST /api/chat, ключ не нужен.',
  },
  {
    id: 'custom',
    name: 'Другой OpenAI-совместимый',
    baseUrl: '',
    model: '',
    docsUrl: '',
    hint: 'Укажите base URL вручную, например https://api.example.com/v1.',
  },
];

export function providerById(id: ProviderId): ProviderPreset {
  return PROVIDERS.find((provider) => provider.id === id) ?? PROVIDERS[PROVIDERS.length - 1];
}

export function applyProvider(settings: Settings, id: ProviderId): Settings {
  const preset = providerById(id);
  return {
    ...settings,
    provider: id,
    apiBase: preset.baseUrl,
    model: preset.model,
  };
}

function modelsEndpoint(provider: ProviderId, base: string): string {
  if (provider === 'ollama') {
    return new URL('/api/tags', base.endsWith('/') ? base : `${base}/`).toString();
  }
  return `${base}/models`;
}

export async function fetchProviderModels(settings: Settings): Promise<string[]> {
  const base = normalizeBase(settings.apiBase);
  if (!base) throw new Error('Сначала укажите base URL провайдера.');
  if (settings.provider === 'tessera') {
    throw new Error('У Tessera-сервера нет каталога моделей — введите модель вручную.');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(modelsEndpoint(settings.provider, base), {
      headers: settings.apiKey ? { Authorization: `Bearer ${settings.apiKey}` } : {},
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Сервис ответил ${response.status}. Проверьте ключ и base URL.`);
    }

    const data = (await response.json()) as {
      data?: Array<{ id?: string }>;
      models?: Array<{ name?: string; id?: string }>;
    };

    const list =
      data.data?.map((item) => item.id).filter((id): id is string => Boolean(id)) ??
      data.models?.map((item) => item.name ?? item.id).filter((id): id is string => Boolean(id)) ??
      [];

    return [...new Set(list)].sort((a, b) => a.localeCompare(b));
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Таймаут: каталог моделей не ответил за 15 секунд.');
    }
    if (error instanceof TypeError) {
      throw new Error(
        'Не удалось запросить каталог. Для локальных серверов разрешите CORS, для облачных — проверьте ключ.',
      );
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
