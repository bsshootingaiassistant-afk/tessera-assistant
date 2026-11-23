import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../types';
import { PROVIDERS, applyProvider, providerById } from './providers';

describe('provider presets', () => {
  it('contains the main OpenAI-compatible providers', () => {
    const ids = PROVIDERS.map((provider) => provider.id);
    expect(ids).toContain('openai');
    expect(ids).toContain('openrouter');
    expect(ids).toContain('mistral');
    expect(ids).toContain('ollama');
  });

  it('fills base URL and model when a provider is selected', () => {
    const next = applyProvider(DEFAULT_SETTINGS, 'deepseek');
    expect(next.apiBase).toBe('https://api.deepseek.com/v1');
    expect(next.model).toBe('deepseek-chat');
  });

  it('falls back to a custom provider for unknown ids', () => {
    expect(providerById('custom').id).toBe('custom');
  });
});
