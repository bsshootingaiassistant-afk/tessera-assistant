import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../types';
import { shouldUseSubagents, subagentModels } from './subagents';

describe('subagents', () => {
  it('never runs in off mode', () => {
    expect(shouldUseSubagents('off', 'переведи текст')).toBe(false);
  });

  it('always runs in on mode', () => {
    expect(shouldUseSubagents('on', 'просто вопрос')).toBe(true);
  });

  it('auto mode only picks routine tasks', () => {
    expect(shouldUseSubagents('auto', 'переведи это на английский')).toBe(true);
    expect(shouldUseSubagents('auto', 'напиши архитектуру приложения')).toBe(false);
  });

  it('limits the model pool by max parallel', () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      subagentModels: 'a, b, c, d',
      subagentMax: 2,
    };
    expect(subagentModels(settings)).toEqual(['a', 'b']);
  });
});
