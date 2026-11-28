import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react';
import { ModuleIntegration, Settings } from '../types';
import { InstalledPlugin, RuntimeStep } from '../runtime/types';
import { runAgentTask } from '../runtime/engine';
import { installPluginZip, runPluginAction } from '../runtime/plugins';
import { Icon } from './Icon';

interface RuntimeModalProps {
  open: boolean;
  settings: Settings;
  modules: ModuleIntegration[];
  plugins: InstalledPlugin[];
  onPluginsChange: (plugins: InstalledPlugin[]) => void;
  onClose: () => void;
  onResult: (message: string, kind: 'success' | 'info' | 'error') => void;
}

type Tab = 'agent' | 'plugins';

export function RuntimeModal({
  open,
  settings,
  modules,
  plugins,
  onPluginsChange,
  onClose,
  onResult,
}: RuntimeModalProps) {
  const [tab, setTab] = useState<Tab>('agent');
  const [task, setTask] = useState('');
  const [steps, setSteps] = useState<RuntimeStep[]>([]);
  const [answer, setAnswer] = useState('');
  const [running, setRunning] = useState(false);
  const [pluginOutput, setPluginOutput] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setTab('agent');
    setSteps([]);
    setAnswer('');
    setRunning(false);
    setPluginOutput('');
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

  const run = async (event: FormEvent) => {
    event.preventDefault();
    if (!task.trim() || running) return;
    setRunning(true);
    setSteps([]);
    setAnswer('');
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const result = await runAgentTask(
        task.trim(),
        settings,
        modules,
        plugins,
        (step) => setSteps((prev) => [...prev, step]),
        controller.signal,
      );
      setAnswer(result.answer);
      onResult('Задача выполнена', 'success');
    } catch (error) {
      if (!controller.signal.aborted) {
        onResult(error instanceof Error ? error.message : 'Рантайм завершился ошибкой', 'error');
      }
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  };

  const stop = () => {
    abortRef.current?.abort();
    setRunning(false);
  };

  const install = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const plugin = installPluginZip(await file.arrayBuffer());
      const next = [plugin, ...plugins.filter((item) => item.manifest.id !== plugin.manifest.id)];
      onPluginsChange(next);
      onResult(`Плагин «${plugin.manifest.name}» установлен`, 'success');
    } catch (error) {
      onResult(error instanceof Error ? error.message : 'Не удалось установить плагин', 'error');
    } finally {
      event.target.value = '';
    }
  };

  const runAction = async (plugin: InstalledPlugin, actionId: string) => {
    const action = plugin.manifest.actions.find((item) => item.id === actionId);
    if (!action) return;
    setPluginOutput('Выполняю…');
    try {
      const result = await runPluginAction(plugin, action);
      setPluginOutput(result.output);
      onResult(result.ok ? 'Действие выполнено' : 'Действие завершилось ошибкой', result.ok ? 'success' : 'error');
    } catch (error) {
      setPluginOutput(error instanceof Error ? error.message : 'Ошибка плагина');
    }
  };

  const remove = (id: string) => {
    onPluginsChange(plugins.filter((plugin) => plugin.manifest.id !== id));
    onResult('Плагин удалён', 'info');
  };

  return (
    <div className="modal modal--runtime" role="dialog" aria-modal="true" aria-labelledby="runtime-title">
      <button type="button" className="modal__backdrop" aria-label="Закрыть" onClick={onClose} />
      <div className="modal__card runtime-modal">
        <header className="modal__header">
          <div>
            <h2 id="runtime-title">Tessera Runtime</h2>
            <p>Агентный цикл · Python · плагины</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Закрыть">
            <Icon name="close" />
          </button>
        </header>

        <div className="runtime-tabs">
          <button type="button" className={tab === 'agent' ? 'is-active' : ''} onClick={() => setTab('agent')}>
            <Icon name="bot" size={15} />
            Агент
          </button>
          <button type="button" className={tab === 'plugins' ? 'is-active' : ''} onClick={() => setTab('plugins')}>
            <Icon name="layers" size={15} />
            Плагины ({plugins.length})
          </button>
        </div>

        <div className="modal__body">
          {tab === 'agent' && (
            <>
              <form className="runtime-form" onSubmit={run}>
                <div className="field">
                  <label htmlFor="runtime-task">Задача</label>
                  <textarea
                    id="runtime-task"
                    rows={4}
                    value={task}
                    onChange={(event) => setTask(event.target.value)}
                    placeholder="Например: посчитай площадь круга радиусом 12 и проверь результат"
                  />
                </div>
                <div className="runtime-form__footer">
                  <small className="field-hint">
                    Инструменты: Python, HTTP, плагины. Максимум 4 шага.
                  </small>
                  {running ? (
                    <button type="button" className="danger-btn" onClick={stop}>
                      Остановить
                    </button>
                  ) : (
                    <button type="submit" className="primary-btn" disabled={!task.trim()}>
                      <Icon name="sparkles" size={16} />
                      Запустить
                    </button>
                  )}
                </div>
              </form>

              {steps.length > 0 && (
                <div className="runtime-steps">
                  {steps.map((step) => (
                    <article key={step.index} className={`runtime-step runtime-step--${step.ok ? 'ok' : 'error'}`}>
                      <div className="runtime-step__head">
                        <span className="badge badge--soft">Шаг {step.index}</span>
                        <strong>{step.tool}</strong>
                        <span>{step.seconds} с</span>
                      </div>
                      {step.thought && <p className="runtime-step__thought">{step.thought}</p>}
                      <pre className="runtime-step__result">{step.result.slice(0, 4000)}</pre>
                    </article>
                  ))}
                </div>
              )}

              {answer && (
                <div className="runtime-answer">
                  <strong>Ответ</strong>
                  <p>{answer}</p>
                </div>
              )}
            </>
          )}

          {tab === 'plugins' && (
            <>
              <div className="runtime-install">
                <div>
                  <strong>Установка из ZIP</strong>
                  <small className="field-hint">
                    plugin.json + .py/.json/.md/.txt, до 2 МБ. Нативные библиотеки запрещены.
                  </small>
                </div>
                <input ref={fileRef} type="file" accept=".zip" onChange={install} hidden />
                <button type="button" className="primary-btn" onClick={() => fileRef.current?.click()}>
                  <Icon name="plus" size={16} />
                  Выбрать ZIP
                </button>
              </div>

              <div className="runtime-plugins">
                {plugins.length === 0 && <div className="module-empty">Плагинов пока нет.</div>}
                {plugins.map((plugin) => (
                  <article key={plugin.manifest.id} className="runtime-plugin">
                    <div className="runtime-plugin__head">
                      <strong>{plugin.manifest.name}</strong>
                      <span className="badge badge--soft">v{plugin.manifest.version}</span>
                      <button
                        type="button"
                        className="mini-btn mini-btn--danger"
                        onClick={() => remove(plugin.manifest.id)}
                      >
                        <Icon name="trash" size={13} />
                      </button>
                    </div>
                    <p>{plugin.manifest.description}</p>
                    <div className="runtime-plugin__actions">
                      {plugin.manifest.actions.map((action) => (
                        <button
                          key={action.id}
                          type="button"
                          className="mini-btn"
                          onClick={() => void runAction(plugin, action.id)}
                        >
                          <Icon name="arrow-right" size={13} />
                          {action.label}
                        </button>
                      ))}
                    </div>
                  </article>
                ))}
              </div>

              {pluginOutput && (
                <pre className="runtime-step__result">{pluginOutput}</pre>
              )}
            </>
          )}
        </div>

        <footer className="modal__footer">
          <span className="modal__footer-note">
            <Icon name="shield" size={13} /> Песочница приложения
          </span>
          <button type="button" className="ghost-btn" onClick={onClose}>
            Закрыть
          </button>
        </footer>
      </div>
    </div>
  );
}
