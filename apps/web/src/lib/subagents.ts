import { Settings, SubagentMode } from '../types';

const ROUTINE_PATTERN =
  /(перевед|перевод|извлек|выпиш|список|сравн|резюм|классифиц|проверь|найди|сумм|таблиц|translate|extract|summar|compare|classif|list)/i;

export function subagentModels(settings: Settings): string[] {
  return [
    ...new Set(
      settings.subagentModels
        .split(/[,\n]/)
        .map((model) => model.trim())
        .filter(Boolean),
    ),
  ].slice(0, Math.max(1, settings.subagentMax));
}

export function shouldUseSubagents(mode: SubagentMode, text: string): boolean {
  if (mode === 'off') return false;
  if (mode === 'on') return true;
  return text.length <= 1200 && ROUTINE_PATTERN.test(text);
}

interface SubagentResult {
  model: string;
  text: string;
}

async function askModel(
  model: string,
  task: string,
  settings: Settings,
  signal?: AbortSignal,
): Promise<SubagentResult | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  if (signal) signal.addEventListener('abort', () => controller.abort(), { once: true });

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.subagentKey}`,
        'HTTP-Referer': window.location.origin,
        'X-Title': 'Tessera',
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content:
              'Ты быстрый субагент Tessera. Выполни узкую часть задачи точно и кратко. ' +
              'Верни только результат, без вступлений. Если нужен расчёт — покажи формулу и итог.',
          },
          { role: 'user', content: task },
        ],
        temperature: 0.2,
        max_tokens: 500,
      }),
      signal: controller.signal,
    });

    if (!response.ok) return null;
    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = data.choices?.[0]?.message?.content?.trim() ?? '';
    return text ? { model, text } : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function runSubagents(
  task: string,
  settings: Settings,
  signal?: AbortSignal,
): Promise<SubagentResult[]> {
  if (!settings.subagentKey.trim()) return [];
  const models = subagentModels(settings);
  if (models.length === 0) return [];

  const settled = await Promise.all(
    models.map((model, index) =>
      askModel(
        model,
        `Основная задача пользователя:\n${task}\n\nТвоя часть: ${
          index === 0
            ? 'выдели ключевые факты, числа и ограничения.'
            : 'предложи короткий проверочный взгляд: риски, ошибки, альтернативы.'
        }`,
        settings,
        signal,
      ),
    ),
  );

  return settled.filter((item): item is SubagentResult => item !== null);
}

export function subagentContext(results: SubagentResult[]): string {
  return results
    .map((result) => `### Субагент ${result.model}\n${result.text}`)
    .join('\n\n');
}
