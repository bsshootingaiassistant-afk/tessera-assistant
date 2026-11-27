const PYODIDE_VERSION = '0.26.4';
const PYODIDE_BASE = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

interface PyodideRuntime {
  runPythonAsync: (code: string) => Promise<unknown>;
  loadPackage: (packages: string | string[]) => Promise<void>;
  globals: { set: (name: string, value: unknown) => void };
}

let runtimePromise: Promise<PyodideRuntime> | null = null;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Не удалось загрузить Pyodide')), {
        once: true,
      });
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Не удалось загрузить Pyodide'));
    document.head.appendChild(script);
  });
}

async function getRuntime(): Promise<PyodideRuntime> {
  if (!runtimePromise) {
    runtimePromise = (async () => {
      const globalWindow = window as unknown as { loadPyodide?: (options: unknown) => Promise<PyodideRuntime> };
      if (!globalWindow.loadPyodide) {
        await loadScript(`${PYODIDE_BASE}pyodide.js`);
      }
      if (!globalWindow.loadPyodide) throw new Error('Pyodide не инициализировался');
      return globalWindow.loadPyodide({ indexURL: PYODIDE_BASE });
    })().catch((error) => {
      runtimePromise = null;
      throw error;
    });
  }
  return runtimePromise;
}

export interface PythonResult {
  ok: boolean;
  output: string;
  seconds: number;
}

export async function runPython(code: string): Promise<PythonResult> {
  const started = performance.now();
  const runtime = await getRuntime();

  const packages = ['numpy', 'pandas', 'scipy', 'sympy'].filter(
    (name) => code.includes(`import ${name}`) || code.includes(`from ${name}`),
  );
  if (packages.length > 0) {
    await runtime.loadPackage(packages);
  }

  runtime.globals.set('__tessera_code', code);

  const output = await runtime.runPythonAsync(`
import io, contextlib, traceback

__tessera_stdout = io.StringIO()
__tessera_stderr = io.StringIO()
__tessera_ok = True
try:
    with contextlib.redirect_stdout(__tessera_stdout), contextlib.redirect_stderr(__tessera_stderr):
        exec(__tessera_code, {})
except Exception:
    __tessera_ok = False
    traceback.print_exc(file=__tessera_stderr)

("__TESSERA_OK__" if __tessera_ok else "__TESSERA_ERR__") + "\\n" + __tessera_stdout.getvalue() + ("\\n" + __tessera_stderr.getvalue() if __tessera_stderr.getvalue() else "")
`);
  const text = String(output);
  const ok = text.startsWith('__TESSERA_OK__');
  return {
    ok,
    output: text.replace(/^__TESSERA_(OK|ERR)__\n?/, '').trim() || '(нет вывода)',
    seconds: Math.round((performance.now() - started) / 10) / 100,
  };
}
