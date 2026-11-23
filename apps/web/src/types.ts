export type Role = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  createdAt: number;
  pending?: boolean;
  error?: boolean;
  suggestions?: string[];
}

export interface Chat {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export type ModuleKind = 'builtin' | 'rest' | 'webhook' | 'mcp' | 'oauth';
export type ModuleStatus = 'connected' | 'disconnected' | 'error' | 'checking';

export interface ModuleIntegration {
  id: string;
  name: string;
  kind: ModuleKind;
  description: string;
  icon: string;
  enabled: boolean;
  status: ModuleStatus;
  endpoint?: string;
  token?: string;
  headers?: string;
  createdAt: number;
  lastCheckedAt?: number;
}

export type ThemeMode = 'system' | 'light' | 'dark';
export type AccentId = 'indigo' | 'teal' | 'violet' | 'amber';

export interface Settings {
  theme: ThemeMode;
  accent: AccentId;
  locale: 'ru' | 'en';
  apiBase: string;
  apiKey: string;
  model: string;
  temperature: number;
  autoUpdate: boolean;
  compact: boolean;
  sendOnEnter: boolean;
  developerMode: boolean;
  feedbackEndpoint: string;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  accent: 'indigo',
  locale: 'ru',
  apiBase: '',
  apiKey: '',
  model: 'tessera-core',
  temperature: 0.4,
  autoUpdate: true,
  compact: false,
  sendOnEnter: true,
  developerMode: false,
  feedbackEndpoint: '',
};

export interface ReleaseInfo {
  version: string;
  tag: string;
  url: string;
  apkUrl: string | null;
  notes: string;
  publishedAt: string;
}
