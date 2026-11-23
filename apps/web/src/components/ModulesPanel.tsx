import { ModuleIntegration, ModuleKind } from '../types';
import { KIND_LABELS, STATUS_LABELS } from '../lib/modules';
import { cls, relativeTime } from '../lib/utils';
import { Icon, IconName } from './Icon';

interface ModulesPanelProps {
  modules: ModuleIntegration[];
  isOpen: boolean;
  onClose: () => void;
  onAdd: (kind?: ModuleKind) => void;
  onEdit: (module: ModuleIntegration) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onTest: (id: string) => void;
}

const POPULAR: Array<{ name: string; kind: ModuleKind; icon: IconName; description: string }> = [
  { name: 'Telegram', kind: 'webhook', icon: 'bolt', description: 'Уведомления и приём сообщений' },
  { name: 'Notion', kind: 'rest', icon: 'globe', description: 'Страницы и базы данных' },
  { name: 'MCP-сервер', kind: 'mcp', icon: 'puzzle', description: 'Инструменты для агента' },
  { name: 'Google Drive', kind: 'oauth', icon: 'folder', description: 'Файлы и документы' },
];

function moduleIcon(icon: string): IconName {
  const map: Record<string, IconName> = {
    github: 'github',
    globe: 'globe',
    folder: 'folder',
    bolt: 'bolt',
    key: 'key',
    puzzle: 'puzzle',
    cube: 'cube',
  };
  return map[icon] ?? 'cube';
}

export function ModulesPanel({
  modules,
  isOpen,
  onClose,
  onAdd,
  onEdit,
  onToggle,
  onDelete,
  onTest,
}: ModulesPanelProps) {
  const active = modules.filter((module) => module.enabled).length;
  const connected = modules.filter((module) => module.status === 'connected').length;

  if (!isOpen) return null;

  return (
    <>
      <button type="button" className="panel-backdrop" aria-label="Закрыть панель" onClick={onClose} />
      <aside className="modules-panel" aria-label="Модули и интеграции">
        <header className="modules-panel__header">
          <div>
            <h2>Модули</h2>
            <p>Интеграции и коннекторы</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Закрыть">
            <Icon name="close" />
          </button>
        </header>

        <div className="modules-stats">
          <div>
            <strong>{modules.length}</strong>
            <span>всего</span>
          </div>
          <div>
            <strong>{active}</strong>
            <span>активны</span>
          </div>
          <div>
            <strong>{connected}</strong>
            <span>подключены</span>
          </div>
        </div>

        <button type="button" className="add-module" onClick={() => onAdd()}>
          <Icon name="plus" size={18} />
          Добавить интеграцию
        </button>

        <div className="modules-panel__section">
          <div className="modules-panel__label">
            Подключения
            <span className="badge badge--soft">{modules.length}</span>
          </div>

          <div className="module-list">
            {modules.length === 0 && (
              <div className="module-empty">Пока пусто. Добавьте первый модуль.</div>
            )}
            {modules.map((module) => (
              <article key={module.id} className={cls('module-card', !module.enabled && 'module-card--off')}>
                <div className={cls('module-card__icon', `module-card__icon--${module.status}`)}>
                  <Icon name={moduleIcon(module.icon)} size={19} />
                </div>
                <div className="module-card__body">
                  <div className="module-card__title">
                    <strong>{module.name}</strong>
                    {module.demo && <span className="badge badge--soft">пример</span>}
                    <span className={cls('status-dot', `status-dot--${module.status}`)} />
                  </div>
                  <div className="module-card__meta">
                    <span>{KIND_LABELS[module.kind]}</span>
                    <span>·</span>
                    <span>{STATUS_LABELS[module.status]}</span>
                    {module.lastCheckedAt && (
                      <>
                        <span>·</span>
                        <span>{relativeTime(module.lastCheckedAt)}</span>
                      </>
                    )}
                  </div>
                  <p>{module.description}</p>
                  <div className="module-card__actions">
                    <button type="button" className="mini-btn" onClick={() => onTest(module.id)}>
                      <Icon name="refresh" size={13} />
                      Проверить
                    </button>
                    <button type="button" className="mini-btn" onClick={() => onEdit(module)}>
                      <Icon name="edit" size={13} />
                      Изменить
                    </button>
                    <button
                      type="button"
                      className="mini-btn mini-btn--danger"
                      onClick={() => onDelete(module.id)}
                    >
                      <Icon name="trash" size={13} />
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={module.enabled}
                  aria-label={module.enabled ? 'Отключить модуль' : 'Включить модуль'}
                  className={cls('switch', module.enabled && 'switch--on')}
                  onClick={() => onToggle(module.id)}
                >
                  <span />
                </button>
              </article>
            ))}
          </div>
        </div>

        <div className="modules-panel__section">
          <div className="modules-panel__label">Популярные интеграции</div>
          <div className="popular-grid">
            {POPULAR.map((item) => (
              <button
                key={item.name}
                type="button"
                className="popular-card"
                onClick={() => onAdd(item.kind)}
              >
                <Icon name={item.icon} size={18} />
                <span>
                  <strong>{item.name}</strong>
                  <small>{item.description}</small>
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="modules-panel__footer">
          <Icon name="shield" size={14} />
          Токены хранятся только в браузере устройства.
        </div>
      </aside>
    </>
  );
}
