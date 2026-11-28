import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { installPluginZip, validateManifest } from './plugins';

const manifest = {
  id: 'calc-tools',
  name: 'Calc Tools',
  version: '1.0.0',
  permissions: ['python'],
  python: 'python/main.py',
  actions: [{ id: 'run', label: 'Запустить', code: 'print(add(2, 3))' }],
};

function makeZip(files: Record<string, string>): ArrayBuffer {
  const zip = zipSync(
    Object.fromEntries(Object.entries(files).map(([name, content]) => [name, strToU8(content)])),
  );
  return zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.byteLength) as ArrayBuffer;
}

describe('plugin manager', () => {
  it('installs a safe plugin from zip', () => {
    const plugin = installPluginZip(
      makeZip({
        'plugin.json': JSON.stringify(manifest),
        'python/main.py': 'def add(a, b):\n    return a + b\n',
      }),
    );
    expect(plugin.manifest.id).toBe('calc-tools');
    expect(plugin.files['python/main.py']).toContain('def add');
  });

  it('rejects path traversal', () => {
    expect(() =>
      installPluginZip(
        makeZip({
          'plugin.json': JSON.stringify(manifest),
          '../evil.py': 'print(1)',
        }),
      ),
    ).toThrow(/Небезопасный путь/);
  });

  it('rejects unknown permissions', () => {
    expect(() =>
      validateManifest({ ...manifest, permissions: ['root'] }),
    ).toThrow(/Неизвестное разрешение/);
  });
});
