import { strFromU8, unzipSync } from 'fflate';
import { runPython } from '../lib/python';
import { InstalledPlugin, PluginAction, PluginManifest } from './types';

const KEY = 'tessera.plugins.v1';
const MAX_ZIP_BYTES = 2 * 1024 * 1024;
const MAX_FILES = 100;
const ALLOWED_EXTENSIONS = ['.py', '.json', '.md', '.txt'];
const ALLOWED_PERMISSIONS = ['network', 'storage', 'python'];

export function loadPlugins(): InstalledPlugin[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as InstalledPlugin[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function savePlugins(plugins: InstalledPlugin[]): void {
  localStorage.setItem(KEY, JSON.stringify(plugins));
}

export function validateManifest(value: unknown): PluginManifest {
  if (!value || typeof value !== 'object') throw new Error('plugin.json не является объектом.');
  const raw = value as Partial<PluginManifest>;
  const id = String(raw.id ?? '').trim();
  if (!/^[a-z0-9][a-z0-9._-]{1,60}$/i.test(id)) throw new Error('Некорректный id плагина.');
  if (!raw.name || !raw.version) throw new Error('У плагина должны быть name и version.');
  if (!Array.isArray(raw.actions) || raw.actions.length === 0) {
    throw new Error('У плагина нет actions.');
  }
  const permissions = Array.isArray(raw.permissions)
    ? raw.permissions.filter((item): item is string => typeof item === 'string')
    : [];
  for (const permission of permissions) {
    if (!ALLOWED_PERMISSIONS.includes(permission)) {
      throw new Error(`Неизвестное разрешение: ${permission}`);
    }
  }
  const actions: PluginAction[] = raw.actions.map((action) => {
    if (!action || !action.id || !action.label || !action.code) {
      throw new Error('Каждое действие должно содержать id, label и code.');
    }
    if (action.code.length > 20000) throw new Error('Код действия слишком большой.');
    return {
      id: String(action.id),
      label: String(action.label),
      code: String(action.code),
    };
  });

  return {
    id,
    name: String(raw.name),
    version: String(raw.version),
    description: raw.description ? String(raw.description) : '',
    permissions,
    python: raw.python ? String(raw.python) : undefined,
    actions,
  };
}

export function installPluginZip(buffer: ArrayBuffer): InstalledPlugin {
  if (buffer.byteLength > MAX_ZIP_BYTES) {
    throw new Error('ZIP больше 2 МБ.');
  }

  const archive = unzipSync(new Uint8Array(buffer));
  const names = Object.keys(archive);
  if (names.length > MAX_FILES) throw new Error('Слишком много файлов в ZIP.');

  const manifestName = names.find((name) => name.toLowerCase() === 'plugin.json');
  if (!manifestName) throw new Error('В ZIP нет plugin.json.');

  let manifest: PluginManifest;
  try {
    manifest = validateManifest(JSON.parse(strFromU8(archive[manifestName])));
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Некорректный plugin.json');
  }

  const files: Record<string, string> = {};
  for (const name of names) {
    if (name === manifestName || name.endsWith('/')) continue;
    const normalized = name.replace(/\\/g, '/');
    if (normalized.startsWith('/') || normalized.includes('..')) {
      throw new Error(`Небезопасный путь в ZIP: ${name}`);
    }
    const lower = normalized.toLowerCase();
    if (!ALLOWED_EXTENSIONS.some((extension) => lower.endsWith(extension))) {
      throw new Error(`Запрещённый тип файла: ${name}`);
    }
    files[normalized] = strFromU8(archive[name]);
  }

  return { manifest, files, installedAt: Date.now() };
}

export async function runPluginAction(
  plugin: InstalledPlugin,
  action: PluginAction,
): Promise<{ ok: boolean; output: string }> {
  const pyFiles = Object.fromEntries(
    Object.entries(plugin.files).filter(([name]) => name.toLowerCase().endsWith('.py')),
  );
  const entry = plugin.manifest.python ? plugin.files[plugin.manifest.python] ?? '' : '';
  const code = `${entry}\n\n${action.code}`;
  const result = await runPython(code, pyFiles, `/plugins/${plugin.manifest.id}`);
  return { ok: result.ok, output: `${result.output}\n\n${result.seconds} с` };
}
