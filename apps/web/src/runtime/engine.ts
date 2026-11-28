import { ModuleIntegration, Settings } from '../types';
import { streamAssistant } from '../lib/assistant';
import { executeTool, TOOL_HELP } from './tools';
import { InstalledPlugin, RuntimeAction, RuntimeResult, RuntimeStep } from './types';

const RUNTIME_PROMPT = `Ты — Tessera Runtime, агент на Android.
Решай задачу по шагам. На каждом шаге возвращай ТОЛЬКО валидный JSON без markdown:
{"thought":"краткое рассуждение","tool":"python|http|plugin|final","args":{...}}

${TOOL_HELP}

Правила:
- для расчётов всегда используй python, не считай в уме;
- не выдумывай результаты инструментов;
- максимум 4 шага;
- когда готов — tool="final", args={"answer":"..."}.
Если инструмент не нужен, сразу final.`;

function parseAction(text: string): RuntimeAction | null {
  const cleaned = text
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1)) as RuntimeAction & { answer?: unknown };
    if (!parsed || typeof parsed !== 'object') return null;
    if (!parsed.tool && parsed.answer !== undefined) {
      return { tool: 'final', args: { answer: parsed.answer } };
    }
    if (!parsed.tool || !['python', 'http', 'plugin', 'final'].includes(parsed.tool)) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function collect(
  settings: Settings,
  modules: ModuleIntegration[],
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  signal: AbortSignal,
): Promise<string> {
  let text = '';
  for await (const chunk of streamAssistant({
    messages: messages.map((message, index) => ({
      id: `runtime-${index}`,
      role: message.role,
      content: message.content,
      createdAt: Date.now(),
    })),
    modules,
    settings,
    signal,
  })) {
    text += chunk;
  }
  return text;
}

export async function runAgentTask(
  task: string,
  settings: Settings,
  modules: ModuleIntegration[],
  plugins: InstalledPlugin[],
  onStep: (step: RuntimeStep) => void,
  signal: AbortSignal,
): Promise<RuntimeResult> {
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
    { role: 'user', content: `${RUNTIME_PROMPT}\n\nЗадача: ${task}` },
  ];
  const steps: RuntimeStep[] = [];

  for (let index = 0; index < 4; index += 1) {
    const started = performance.now();
    const raw = await collect(settings, modules, messages, signal);
    const action = parseAction(raw);

    if (!action) {
      return { answer: raw.trim(), steps };
    }

    if (action.tool === 'final') {
      return {
        answer: String(action.args?.answer ?? action.thought ?? raw).trim(),
        steps,
      };
    }

    const result = await executeTool(action, plugins);
    const step: RuntimeStep = {
      index: index + 1,
      thought: action.thought,
      tool: action.tool,
      args: action.args,
      result: result.output,
      ok: result.ok,
      seconds: Math.round((performance.now() - started) / 100) / 10,
    };
    steps.push(step);
    onStep(step);

    messages.push({ role: 'assistant', content: raw });
    messages.push({
      role: 'user',
      content: `Результат инструмента ${action.tool}:\n${result.output.slice(0, 12000)}\n\nПродолжай.`,
    });
  }

  return { answer: 'Достигнут лимит шагов. Проверьте шаги выше.', steps };
}
