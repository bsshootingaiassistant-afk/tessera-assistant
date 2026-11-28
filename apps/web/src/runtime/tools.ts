import { runPython } from '../lib/python';
import { runPluginAction } from './plugins';
import { InstalledPlugin, RuntimeAction } from './types';

export interface ToolResult {
  ok: boolean;
  output: string;
}

async function runHttp(args: Record<string, unknown>): Promise<ToolResult> {
  const url = String(args.url ?? '').trim();
  if (!/^https?:\/\//i.test(url)) {
    return { ok: false, output: 'URL должен начинаться с http:// или https://' };
  }
  const method = String(args.method ?? 'GET').toUpperCase();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, {
      method,
      headers:
        args.headers && typeof args.headers === 'object'
          ? (args.headers as Record<string, string>)
          : undefined,
      body: method === 'GET' || method === 'HEAD' ? undefined : String(args.body ?? ''),
      signal: controller.signal,
    });
    const text = await response.text();
    return {
      ok: response.ok,
      output: `HTTP ${response.status}\n${text.slice(0, 20000)}`,
    };
  } catch (error) {
    return {
      ok: false,
      output: error instanceof Error ? error.message : 'HTTP-запрос не удался',
    };
  } finally {
    clearTimeout(timer);
  }
}

async function runPythonTool(args: Record<string, unknown>): Promise<ToolResult> {
  const code = String(args.code ?? '').trim();
  if (!code) return { ok: false, output: 'Пустой Python-код.' };
  if (code.length > 20000) return { ok: false, output: 'Python-код больше 20 000 символов.' };
  try {
    const result = await runPython(code);
    return { ok: result.ok, output: result.output };
  } catch (error) {
    return {
      ok: false,
      output: error instanceof Error ? error.message : 'Python не запустился',
    };
  }
}

async function runPluginTool(
  args: Record<string, unknown>,
  plugins: InstalledPlugin[],
): Promise<ToolResult> {
  const id = String(args.id ?? '');
  const actionId = String(args.action ?? '');
  const plugin = plugins.find((item) => item.manifest.id === id);
  if (!plugin) return { ok: false, output: `Плагин ${id} не установлен.` };
  const action = plugin.manifest.actions.find((item) => item.id === actionId);
  if (!action) return { ok: false, output: `У плагина ${id} нет действия ${actionId}.` };
  try {
    const result = await runPluginAction(plugin, action);
    return { ok: result.ok, output: result.output };
  } catch (error) {
    return {
      ok: false,
      output: error instanceof Error ? error.message : 'Действие плагина не выполнилось',
    };
  }
}

export async function executeTool(
  action: RuntimeAction,
  plugins: InstalledPlugin[],
): Promise<ToolResult> {
  const args = action.args ?? {};
  if (action.tool === 'python') return runPythonTool(args);
  if (action.tool === 'http') return runHttp(args);
  if (action.tool === 'plugin') return runPluginTool(args, plugins);
  return { ok: false, output: `Неизвестный инструмент: ${action.tool}` };
}

export const TOOL_HELP = `Доступные инструменты:
- python: {"code": "print(2+2)"} — выполнить Python на устройстве.
- http: {"url": "https://...", "method": "GET"} — HTTP-запрос.
- plugin: {"id": "plugin-id", "action": "action-id"} — действие установленного плагина.
- final: {"answer": "итог"} — завершить задачу.`;
