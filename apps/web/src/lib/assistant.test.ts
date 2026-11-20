import { describe, expect, it } from 'vitest';
import { localReply, suggestionsFor } from './assistant';
import { isNewerVersion, parseVersion } from './version';
import { DEFAULT_SETTINGS, ModuleIntegration } from '../types';

const modules: ModuleIntegration[] = [
  {
    id: 'm1',
    name: 'GitHub',
    kind: 'oauth',
    description: '',
    icon: 'github',
    enabled: true,
    status: 'connected',
    createdAt: 0,
  },
  {
    id: 'm2',
    name: 'REST API',
    kind: 'rest',
    description: '',
    icon: 'globe',
    enabled: false,
    status: 'disconnected',
    createdAt: 0,
  },
];

describe('version comparison', () => {
  it('parses tags with a v prefix', () => {
    expect(parseVersion('v1.2.3')).toEqual([1, 2, 3]);
  });

  it('detects newer versions', () => {
    expect(isNewerVersion('0.2.0', '0.1.0')).toBe(true);
    expect(isNewerVersion('0.1.0', '0.1.0')).toBe(false);
    expect(isNewerVersion('0.1.0', '0.2.0')).toBe(false);
  });
});

describe('local assistant', () => {
  it('lists connected modules', () => {
    const reply = localReply('Какие модули подключены?', modules, DEFAULT_SETTINGS);
    expect(reply).toContain('GitHub');
    expect(reply).toContain('REST API');
  });

  it('explains how to add an integration', () => {
    const reply = localReply('Как добавить интеграцию?', modules, DEFAULT_SETTINGS);
    expect(reply).toContain('REST');
    expect(reply.toLowerCase()).toContain('токен');
  });

  it('returns contextual suggestions', () => {
    expect(suggestionsFor('расскажи про модули')).toContain('Проверь мои модули');
  });
});
