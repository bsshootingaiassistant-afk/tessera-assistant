import { describe, expect, it } from 'vitest';
import { FeedbackPayload, buildIssueUrl, feedbackAsText } from './feedback';

const payload: FeedbackPayload = {
  kind: 'bug',
  message: 'Кнопка не работает',
  contact: 'user@example.com',
  page: 'Чат',
  diagnostics: {
    appVersion: '0.2.0',
    page: 'Чат',
    url: 'https://example.com/',
    theme: 'dark',
    locale: 'ru',
    modulesTotal: 3,
    modulesActive: 2,
    userAgent: 'test-agent',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
};

describe('feedback helpers', () => {
  it('builds a readable text report', () => {
    const text = feedbackAsText(payload);
    expect(text).toContain('Тип: Ошибка');
    expect(text).toContain('Кнопка не работает');
    expect(text).toContain('Версия: 0.2.0');
  });

  it('builds an encoded GitHub issue URL', () => {
    const url = buildIssueUrl('owner/repo', payload);
    expect(url.startsWith('https://github.com/owner/repo/issues/new?')).toBe(true);
    const parsed = new URL(url);
    expect(parsed.searchParams.get('title')).toContain('Кнопка не работает');
    expect(parsed.searchParams.get('body')).toContain('Кнопка не работает');
  });
});
