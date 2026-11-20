import {
  Chat,
  DEFAULT_SETTINGS,
  ModuleIntegration,
  Settings,
} from '../types';
import { safeJsonParse, uid } from './utils';

const KEYS = {
  chats: 'tessera.chats.v1',
  activeChat: 'tessera.activeChat.v1',
  modules: 'tessera.modules.v1',
  settings: 'tessera.settings.v1',
  releaseDismissed: 'tessera.releaseDismissed.v1',
} as const;

export function loadSettings(): Settings {
  const raw = safeJsonParse<Partial<Settings>>(localStorage.getItem(KEYS.settings), {});
  const merged = { ...DEFAULT_SETTINGS, ...raw };
  if (!merged.apiBase && import.meta.env.VITE_API_BASE) {
    merged.apiBase = import.meta.env.VITE_API_BASE;
  }
  return merged;
}

export function saveSettings(settings: Settings): void {
  localStorage.setItem(KEYS.settings, JSON.stringify(settings));
}

export function seededModules(): ModuleIntegration[] {
  const now = Date.now();
  return [
    {
      id: 'mod_github',
      name: 'GitHub',
      kind: 'oauth',
      description: 'Репозитории, issues, pull requests и релизы.',
      icon: 'github',
      enabled: true,
      status: 'connected',
      endpoint: 'https://api.github.com',
      createdAt: now,
      lastCheckedAt: now,
    },
    {
      id: 'mod_rest',
      name: 'REST API',
      kind: 'rest',
      description: 'Универсальный HTTP-коннектор для любых сервисов.',
      icon: 'globe',
      enabled: true,
      status: 'connected',
      endpoint: 'https://httpbin.org',
      createdAt: now,
      lastCheckedAt: now,
    },
    {
      id: 'mod_files',
      name: 'Локальные файлы',
      kind: 'builtin',
      description: 'Доступ к документам и заметкам на устройстве.',
      icon: 'folder',
      enabled: false,
      status: 'disconnected',
      createdAt: now,
    },
  ];
}

export function loadModules(): ModuleIntegration[] {
  const raw = localStorage.getItem(KEYS.modules);
  if (!raw) return seededModules();
  const parsed = safeJsonParse<ModuleIntegration[]>(raw, []);
  return Array.isArray(parsed) ? parsed : seededModules();
}

export function saveModules(modules: ModuleIntegration[]): void {
  localStorage.setItem(KEYS.modules, JSON.stringify(modules));
}

export function seededChats(): Chat[] {
  const now = Date.now();
  return [
    {
      id: 'chat_welcome',
      title: 'Знакомство с Tessera',
      createdAt: now,
      updatedAt: now,
      messages: [
        {
          id: uid('msg'),
          role: 'assistant',
          createdAt: now,
          content:
            'Привет! Я **Tessera** — твой персональный ассистент по модулям и интеграциям.\n\nЯ помогу:\n- подключить новый сервис по REST, webhook, OAuth или MCP;\n- проверить, что интеграция отвечает;\n- объяснить, как модуль влияет на сценарии;\n- собрать и обновить приложение.\n\nС чего начнём?',
          suggestions: [
            'Какие модули уже подключены?',
            'Как добавить интеграцию?',
            'Проверь мои модули',
            'Что ты умеешь?',
          ],
        },
      ],
    },
  ];
}

export function loadChats(): Chat[] {
  const raw = localStorage.getItem(KEYS.chats);
  if (!raw) return seededChats();
  const parsed = safeJsonParse<Chat[]>(raw, []);
  if (!Array.isArray(parsed) || parsed.length === 0) return seededChats();
  return parsed;
}

export function saveChats(chats: Chat[]): void {
  localStorage.setItem(KEYS.chats, JSON.stringify(chats));
}

export function loadActiveChatId(): string | null {
  return localStorage.getItem(KEYS.activeChat);
}

export function saveActiveChatId(id: string): void {
  localStorage.setItem(KEYS.activeChat, id);
}

export function loadDismissedRelease(): string {
  return localStorage.getItem(KEYS.releaseDismissed) ?? '';
}

export function saveDismissedRelease(version: string): void {
  localStorage.setItem(KEYS.releaseDismissed, version);
}

export function clearAllData(): void {
  Object.values(KEYS).forEach((key) => localStorage.removeItem(key));
}
