import { FormEvent, useEffect, useState } from 'react';
import { ModuleIntegration, ModuleKind, ModuleStatus } from '../types';
import { MODULE_KINDS, testModule } from '../lib/modules';
import { cls, uid } from '../lib/utils';
import { Icon, IconName } from './Icon';

interface AddIntegrationModalProps {
  open: boolean;
  initialKind?: ModuleKind;
  editing: ModuleIntegration | null;
  onClose: () => void;
  onSave: (module: ModuleIntegration) => void;
}

const ICON_BY_KIND: Record<ModuleKind, IconName> = {
  rest: 'globe',
  webhook: 'bolt',
  oauth: 'key',
  mcp: 'puzzle',
  builtin: 'cube',
};

export function AddIntegrationModal({
  open,
  initialKind,
  editing,
  onClose,
  onSave,
}: AddIntegrationModalProps) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState<ModuleKind>('rest');
  const [description, setDescription] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [token, setToken] = useState('');
  const [headers, setHeaders] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ status: ModuleStatus; message: string } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setName(editing.name);
      setKind(editing.kind);
      setDescription(editing.description);
      setEndpoint(editing.endpoint ?? '');
      setToken(editing.token ?? '');
      setHeaders(editing.headers ?? '');
      setEnabled(editing.enabled);
    } else {
      setName('');
      setKind(initialKind ?? 'rest');
      setDescription('');
      setEndpoint('');
      setToken('');
      setHeaders('');
      setEnabled(true);
    }
    setError('');
    setTestResult(null);
    setTesting(false);
  }, [open, editing, initialKind]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const buildDraft = (): ModuleIntegration => ({
    id: editing?.id ?? uid('mod'),
    name: name.trim(),
    kind,
    description: description.trim() || MODULE_KINDS.find((item) => item.kind === kind)?.description || '',
    icon: ICON_BY_KIND[kind],
    enabled,
    status: editing?.status ?? 'disconnected',
    endpoint: endpoint.trim() || undefined,
    token: token.trim() || undefined,
    headers: headers.trim() || undefined,
    createdAt: editing?.createdAt ?? Date.now(),
    lastCheckedAt: editing?.lastCheckedAt,
  });

  const validate = (): string => {
    if (!name.trim()) return 'Укажите название модуля.';
    if (kind !== 'builtin' && !endpoint.trim()) return 'Укажите endpoint.';
    if (headers.trim()) {
      try {
        JSON.parse(headers);
      } catch {
        return 'Заголовки должны быть корректным JSON.';
      }
    }
    return '';
  };

  const runTest = async () => {
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setError('');
    setTesting(true);
    setTestResult(null);
    const result = await testModule(buildDraft());
    setTestResult(result);
    setTesting(false);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    const draft = buildDraft();
    const status: ModuleStatus = testResult?.status ?? editing?.status ?? (kind === 'builtin' ? 'connected' : 'disconnected');
    onSave({
      ...draft,
      status,
      lastCheckedAt: testResult ? Date.now() : editing?.lastCheckedAt,
    });
  };

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="module-modal-title">
      <button type="button" className="modal__backdrop" aria-label="Закрыть" onClick={onClose} />
      <form className="modal__card modal__card--wide" onSubmit={submit}>
        <header className="modal__header">
          <div>
            <h2 id="module-modal-title">{editing ? 'Изменить модуль' : 'Новый модуль'}</h2>
            <p>Подключение сервиса к Tessera</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Закрыть">
            <Icon name="close" />
          </button>
        </header>

        <div className="modal__body">
          <div className="field">
            <label>Тип подключения</label>
            <div className="kind-grid">
              {MODULE_KINDS.filter((item) => item.kind !== 'builtin' || editing).map((item) => (
                <button
                  key={item.kind}
                  type="button"
                  className={cls('kind-card', kind === item.kind && 'kind-card--active')}
                  onClick={() => setKind(item.kind)}
                >
                  <Icon name={item.icon as IconName} size={18} />
                  <strong>{item.label}</strong>
                  <small>{item.description}</small>
                </button>
              ))}
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor="module-name">Название</label>
              <input
                id="module-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Например, CRM"
                autoFocus
              />
            </div>
            <div className="field field--narrow">
              <label>Статус</label>
              <label className="checkline">
                <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
                Включён
              </label>
            </div>
          </div>

          <div className="field">
            <label htmlFor="module-description">Описание</label>
            <input
              id="module-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Что делает модуль"
            />
          </div>

          {kind !== 'builtin' && (
            <>
              <div className="field">
                <label htmlFor="module-endpoint">Endpoint</label>
                <input
                  id="module-endpoint"
                  value={endpoint}
                  onChange={(event) => setEndpoint(event.target.value)}
                  placeholder={kind === 'mcp' ? 'https://mcp.example.com' : 'https://api.example.com'}
                  inputMode="url"
                />
              </div>

              <div className="field">
                <label htmlFor="module-token">
                  Токен <span className="label-hint">необязательно</span>
                </label>
                <input
                  id="module-token"
                  type="password"
                  value={token}
                  onChange={(event) => setToken(event.target.value)}
                  placeholder="Bearer token"
                  autoComplete="off"
                />
              </div>

              <div className="field">
                <label htmlFor="module-headers">
                  Заголовки <span className="label-hint">JSON, необязательно</span>
                </label>
                <textarea
                  id="module-headers"
                  value={headers}
                  onChange={(event) => setHeaders(event.target.value)}
                  rows={3}
                  placeholder={'{ "X-Api-Version": "2024-01" }'}
                  className="mono"
                />
              </div>
            </>
          )}

          {testResult && (
            <div className={cls('test-result', `test-result--${testResult.status}`)}>
              <Icon name={testResult.status === 'connected' ? 'check' : 'alert'} size={16} />
              <span>{testResult.message}</span>
            </div>
          )}

          {error && <div className="form-error">{error}</div>}
        </div>

        <footer className="modal__footer">
          <button type="button" className="ghost-btn" onClick={runTest} disabled={testing}>
            {testing ? <span className="spinner" /> : <Icon name="refresh" size={16} />}
            {testing ? 'Проверяю…' : 'Проверить'}
          </button>
          <div className="modal__footer-right">
            <button type="button" className="ghost-btn" onClick={onClose}>
              Отмена
            </button>
            <button type="submit" className="primary-btn">
              <Icon name="check" size={16} />
              {editing ? 'Сохранить' : 'Добавить модуль'}
            </button>
          </div>
        </footer>
      </form>
    </div>
  );
}
