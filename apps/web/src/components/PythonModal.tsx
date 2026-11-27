import { FormEvent, useEffect, useState } from 'react';
import { runPython } from '../lib/python';
import { Icon } from './Icon';

interface PythonModalProps {
  open: boolean;
  onClose: () => void;
  onResult: (message: string, kind: 'success' | 'info' | 'error') => void;
}

const EXAMPLE = `import math

radius = 12
area = math.pi * radius ** 2
print(f"Площадь: {area:.2f} мм²")`;

export function PythonModal({ open, onClose, onResult }: PythonModalProps) {
  const [code, setCode] = useState(EXAMPLE);
  const [output, setOutput] = useState('');
  const [running, setRunning] = useState(false);
  const [seconds, setSeconds] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setOutput('');
    setSeconds(null);
    setRunning(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const run = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!code.trim() || running) return;
    setRunning(true);
    setOutput('Загружаю Python…');
    try {
      const result = await runPython(code);
      setOutput(result.output);
      setSeconds(result.seconds);
      onResult(
        result.ok ? `Python выполнен за ${result.seconds} с` : 'Python завершился с ошибкой',
        result.ok ? 'success' : 'error',
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось запустить Python';
      setOutput(message);
      onResult(message, 'error');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="modal modal--python" role="dialog" aria-modal="true" aria-labelledby="python-title">
      <button type="button" className="modal__backdrop" aria-label="Закрыть" onClick={onClose} />
      <form className="modal__card python-modal" onSubmit={run}>
        <header className="modal__header">
          <div>
            <h2 id="python-title">Python</h2>
            <p>Pyodide · локально на устройстве</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Закрыть">
            <Icon name="close" />
          </button>
        </header>

        <div className="modal__body">
          <div className="field">
            <label htmlFor="python-code">Код</label>
            <textarea
              id="python-code"
              className="python-editor mono"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              spellCheck={false}
              rows={9}
            />
          </div>

          <div className="python-toolbar">
            <span className="field-hint">
              numpy/pandas/scipy доступны после импорта. Время выполнения ограничено вручную.
            </span>
            {seconds !== null && <span className="badge badge--soft">{seconds} с</span>}
          </div>

          <div className="field">
            <label>Вывод</label>
            <pre className="python-output">{output || 'Нажмите «Выполнить»…'}</pre>
          </div>
        </div>

        <footer className="modal__footer">
          <button
            type="button"
            className="ghost-btn"
            onClick={() => {
              setCode(EXAMPLE);
              setOutput('');
            }}
          >
            <Icon name="refresh" size={16} />
            Пример
          </button>
          <div className="modal__footer-right">
            <button type="button" className="ghost-btn" onClick={onClose}>
              Закрыть
            </button>
            <button type="submit" className="primary-btn" disabled={running || !code.trim()}>
              {running ? <span className="spinner" /> : <Icon name="code" size={16} />}
              {running ? 'Выполняю…' : 'Выполнить'}
            </button>
          </div>
        </footer>
      </form>
    </div>
  );
}
