import { ModuleIntegration, Settings } from '../types';
import { normalizeBase, uid } from './utils';

export type FeedbackKind = 'bug' | 'idea' | 'other';

export interface FeedbackDiagnostics {
  appVersion: string;
  page: string;
  url: string;
  theme: string;
  locale: string;
  modulesTotal: number;
  modulesActive: number;
  userAgent: string;
  createdAt: string;
}

export interface FeedbackPayload {
  kind: FeedbackKind;
  message: string;
  contact: string;
  page: string;
  diagnostics: FeedbackDiagnostics;
}

export interface FeedbackResult {
  status: 'sent' | 'opened' | 'queued';
  url?: string;
}

export const FEEDBACK_KINDS: Array<{ id: FeedbackKind; label: string; hint: string }> = [
  { id: 'bug', label: 'Ошибка', hint: 'Что-то сломалось или ведёт себя странно' },
  { id: 'idea', label: 'Идея', hint: 'Чего не хватает или что улучшить' },
  { id: 'other', label: 'Другое', hint: 'Вопрос, замечание, благодарность' },
];

export function collectDiagnostics(
  page: string,
  settings: Settings,
  modules: ModuleIntegration[],
): FeedbackDiagnostics {
  return {
    appVersion: __APP_VERSION__,
    page,
    url: window.location.href,
    theme: document.documentElement.dataset.theme ?? settings.theme,
    locale: settings.locale,
    modulesTotal: modules.length,
    modulesActive: modules.filter((module) => module.enabled).length,
    userAgent: navigator.userAgent,
    createdAt: new Date().toISOString(),
  };
}

export function buildFeedbackPayload(
  kind: FeedbackKind,
  message: string,
  contact: string,
  page: string,
  settings: Settings,
  modules: ModuleIntegration[],
): FeedbackPayload {
  return {
    kind,
    message: message.trim(),
    contact: contact.trim(),
    page,
    diagnostics: collectDiagnostics(page, settings, modules),
  };
}

export function feedbackAsText(payload: FeedbackPayload): string {
  const kind = FEEDBACK_KINDS.find((item) => item.id === payload.kind)?.label ?? payload.kind;
  const d = payload.diagnostics;
  return [
    `Тип: ${kind}`,
    `Страница: ${payload.page}`,
    payload.contact ? `Контакт: ${payload.contact}` : '',
    '',
    payload.message,
    '',
    '--- диагностика ---',
    `Версия: ${d.appVersion}`,
    `URL: ${d.url}`,
    `Тема: ${d.theme}`,
    `Модули: ${d.modulesActive}/${d.modulesTotal}`,
    `Браузер: ${d.userAgent}`,
    `Время: ${d.createdAt}`,
  ]
    .filter((line) => line !== '')
    .join('\n');
}

export function buildIssueUrl(repo: string, payload: FeedbackPayload): string {
  const kind = FEEDBACK_KINDS.find((item) => item.id === payload.kind)?.label ?? payload.kind;
  const title = `[Отзыв] ${kind}: ${payload.message.slice(0, 60)}`;
  const body = `${payload.message}\n\n${
    payload.contact ? `**Контакт:** ${payload.contact}\n\n` : ''
  }**Страница:** ${payload.page}\n\n<details><summary>Диагностика</summary>\n\n\`\`\`\n${feedbackAsText(
    payload,
  )}\n\`\`\`\n\n</details>`;
  const params = new URLSearchParams({ title, body });
  return `https://github.com/${repo}/issues/new?${params.toString()}`;
}

function readQueue(): FeedbackPayload[] {
  try {
    const raw = localStorage.getItem('tessera.feedback.v1');
    if (!raw) return [];
    const parsed = JSON.parse(raw) as FeedbackPayload[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function queueFeedback(payload: FeedbackPayload): void {
  const queue = readQueue();
  queue.unshift(payload);
  localStorage.setItem('tessera.feedback.v1', JSON.stringify(queue.slice(0, 50)));
}

export function loadFeedbackQueue(): FeedbackPayload[] {
  return readQueue();
}

export async function submitFeedback(
  payload: FeedbackPayload,
  endpoint: string,
  repo: string,
): Promise<FeedbackResult> {
  const base = normalizeBase(endpoint);

  if (base) {
    const response = await fetch(`${base}/api/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: uid('feedback'), source: 'tessera-app', ...payload }),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`HTTP ${response.status}: ${detail.slice(0, 160)}`);
    }
    return { status: 'sent' };
  }

  if (repo) {
    return { status: 'opened', url: buildIssueUrl(repo, payload) };
  }

  queueFeedback(payload);
  return { status: 'queued' };
}
