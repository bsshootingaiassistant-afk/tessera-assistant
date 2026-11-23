import { useEffect, useState } from 'react';
import { AccentId, Settings, ThemeMode } from '../types';
import { cls } from '../lib/utils';
import { Icon } from './Icon';

interface SettingsModalProps {
  open: boolean;
  settings: Settings;
  onClose: () => void;
  onSave: (settings: Settings) => void;
  onCheckUpdate: () => void;
  onClearData: () => void;
  onExport: () => void;
  onOpenFeedback: (settings: Settings) => void;
}

type Tab = 'general' | 'ai' | 'updates' | 'developer' | 'data';

const THEMES: Array<{ value: ThemeMode; label: string; icon: 'monitor' | 'sun' | 'moon' }> = [
  { value: 'system', label: 'Системная', icon: 'monitor' },
  { value: 'light', label: 'Светлая', icon: 'sun' },
  { value: 'dark', label: 'Тёмная', icon: 'moon' },
];

const ACCENTS: Array<{ id: AccentId; label: string }> = [
  { id: 'indigo', label: 'Индиго' },
  { id: 'teal', label: 'Бирюза' },
  { id: 'violet', label: 'Фиолет' },
  { id: 'amber', label: 'Янтарь' },
];

export function SettingsModal({
  open,
  settings,
  onClose,
  onSave,
  onCheckUpdate,
  onClearData,
  onExport,
  onOpenFeedback,
}: SettingsModalProps) {
  const [tab, setTab] = useState<Tab>('general');
  const [draft, setDraft] = useState<Settings>(settings);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraft(settings);
    setTab('general');
    setConfirmClear(false);
  }, [open, settings]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const save = () => {
    onSave(draft);
    onClose();
  };

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
      <button type="button" className="modal__backdrop" aria-label="Закрыть" onClick={onClose} />
      <div className="modal__card settings">
        <header className="modal__header">
          <div>
            <h2 id="settings-title">Настройки</h2>
            <p>Tessera · v{__APP_VERSION__}</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Закрыть">
            <Icon name="close" />
          </button>
        </header>

        <div className="settings__layout">
          <nav className="settings__nav" aria-label="Разделы настроек">
            {(
              [
                ['general', 'Общие', 'settings'],
                ['ai', 'ИИ и API', 'sparkles'],
                ['updates', 'Обновления', 'download'],
                ['developer', 'Разработчик', 'code'],
                ['data', 'Данные', 'shield'],
              ] as Array<[Tab, string, 'settings' | 'sparkles' | 'download' | 'code' | 'shield']>
            ).map(([id, label, icon]) => (
              <button
                key={id}
                type="button"
                className={cls('settings__tab', tab === id && 'settings__tab--active')}
                onClick={() => setTab(id)}
              >
                <Icon name={icon} size={17} />
                {label}
              </button>
            ))}
          </nav>

          <div className="settings__body">
            {tab === 'general' && (
              <>
                <section className="settings__section">
                  <h3>Оформление</h3>
                  <div className="field">
                    <label>Тема</label>
                    <div className="segmented segmented--icons">
                      {THEMES.map((theme) => (
                        <button
                          key={theme.value}
                          type="button"
                          className={cls(draft.theme === theme.value && 'is-active')}
                          onClick={() => update('theme', theme.value)}
                        >
                          <Icon name={theme.icon} size={16} />
                          {theme.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="field">
                    <label>Акцент</label>
                    <div className="accents">
                      {ACCENTS.map((accent) => (
                        <button
                          key={accent.id}
                          type="button"
                          className={cls('accent', `accent--${accent.id}`, draft.accent === accent.id && 'accent--active')}
                          onClick={() => update('accent', accent.id)}
                          aria-label={accent.label}
                          title={accent.label}
                        >
                          <span />
                          {draft.accent === accent.id && <Icon name="check" size={14} />}
                        </button>
                      ))}
                    </div>
                  </div>
                  <label className="toggle-row">
                    <span>
                      <strong>Компактный режим</strong>
                      <small>Меньше отступов в списке чатов</small>
                    </span>
                    <input
                      type="checkbox"
                      checked={draft.compact}
                      onChange={(event) => update('compact', event.target.checked)}
                    />
                  </label>
                  <label className="toggle-row">
                    <span>
                      <strong>Enter отправляет сообщение</strong>
                      <small>Shift+Enter — перенос строки</small>
                    </span>
                    <input
                      type="checkbox"
                      checked={draft.sendOnEnter}
                      onChange={(event) => update('sendOnEnter', event.target.checked)}
                    />
                  </label>
                </section>
              </>
            )}

            {tab === 'ai' && (
              <>
                <section className="settings__section">
                  <h3>Подключение модели</h3>
                  <div className="field">
                    <label htmlFor="api-base">API endpoint</label>
                    <input
                      id="api-base"
                      value={draft.apiBase}
                      onChange={(event) => update('apiBase', event.target.value)}
                      placeholder="https://api.example.com"
                      inputMode="url"
                    />
                    <small className="field-hint">
                      Запросы уходят на <code>POST /api/chat</code>. Пустое поле — локальный офлайн-режим.
                    </small>
                  </div>
                  <div className="field">
                    <label htmlFor="api-key">API-ключ</label>
                    <input
                      id="api-key"
                      type="password"
                      value={draft.apiKey}
                      onChange={(event) => update('apiKey', event.target.value)}
                      placeholder="sk-…"
                      autoComplete="off"
                    />
                    <small className="field-hint">Хранится только в этом браузере и отправляется на ваш endpoint.</small>
                  </div>
                  <div className="field-row">
                    <div className="field">
                      <label htmlFor="model-name">Модель</label>
                      <input
                        id="model-name"
                        value={draft.model}
                        onChange={(event) => update('model', event.target.value)}
                        placeholder="tessera-core"
                      />
                    </div>
                    <div className="field field--narrow">
                      <label>Температура: {draft.temperature.toFixed(1)}</label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={draft.temperature}
                        onChange={(event) => update('temperature', Number(event.target.value))}
                      />
                    </div>
                  </div>
                </section>
                <div className="notice">
                  <Icon name="shield" size={16} />
                  <span>
                    Для production используйте собственный backend-прокси: ключ не должен попадать в публичный
                    репозиторий.
                  </span>
                </div>
              </>
            )}

            {tab === 'updates' && (
              <>
                <section className="settings__section">
                  <h3>Обновления</h3>
                  <div className="version-row">
                    <span>Текущая версия</span>
                    <strong>v{__APP_VERSION__}</strong>
                  </div>
                  <label className="toggle-row">
                    <span>
                      <strong>Проверять автоматически</strong>
                      <small>При запуске приложение ищет новый релиз</small>
                    </span>
                    <input
                      type="checkbox"
                      checked={draft.autoUpdate}
                      onChange={(event) => update('autoUpdate', event.target.checked)}
                    />
                  </label>
                  <button type="button" className="primary-btn" onClick={onCheckUpdate}>
                    <Icon name="refresh" size={16} />
                    Проверить обновления
                  </button>
                </section>
                <div className="notice">
                  <Icon name="download" size={16} />
                  <span>Android обновляется из APK, веб-версия — при следующей загрузке.</span>
                </div>
              </>
            )}

            {tab === 'developer' && (
              <>
                <section className="settings__section">
                  <h3>Режим разработчика</h3>
                  <label className="toggle-row">
                    <span>
                      <strong>Показывать кнопку «Отзыв»</strong>
                      <small>Кнопка доступна на всех экранах: чат, модули, настройки</small>
                    </span>
                    <input
                      type="checkbox"
                      checked={draft.developerMode}
                      onChange={(event) => update('developerMode', event.target.checked)}
                    />
                  </label>

                  <div className="field">
                    <label htmlFor="feedback-endpoint">
                      Endpoint отзывов <span className="label-hint">необязательно</span>
                    </label>
                    <input
                      id="feedback-endpoint"
                      value={draft.feedbackEndpoint}
                      onChange={(event) => update('feedbackEndpoint', event.target.value)}
                      placeholder="https://api.example.com"
                      inputMode="url"
                    />
                    <small className="field-hint">
                      POST <code>/api/feedback</code> с JSON. Если пусто — откроется публичная форма GitHub Issues.
                    </small>
                  </div>

                  <button
                    type="button"
                    className="primary-btn"
                    disabled={!draft.developerMode}
                    onClick={() => onOpenFeedback(draft)}
                  >
                    <Icon name="chat" size={16} />
                    Открыть форму отзыва
                  </button>
                  <small className="field-hint">
                    Включите режим разработчика, чтобы кнопка отзывов появилась поверх любого экрана.
                  </small>
                </section>

                <div className="notice">
                  <Icon name="shield" size={16} />
                  <span>
                    Приложение не запрашивает GitHub-логин и не хранит токены. Если используется GitHub
                    Issues, вход выполняется в браузере только в момент отправки.
                  </span>
                </div>
              </>
            )}

            {tab === 'data' && (
              <>
                <section className="settings__section">
                  <h3>Данные приложения</h3>
                  <p className="settings__text">
                    Чаты, модули и настройки хранятся в localStorage устройства. Экспорт создаёт JSON-файл с
                    резервной копией.
                  </p>
                  <div className="button-row">
                    <button type="button" className="ghost-btn" onClick={onExport}>
                      <Icon name="download" size={16} />
                      Экспортировать данные
                    </button>
                    {!confirmClear ? (
                      <button type="button" className="ghost-btn ghost-btn--danger" onClick={() => setConfirmClear(true)}>
                        <Icon name="trash" size={16} />
                        Очистить всё
                      </button>
                    ) : (
                      <div className="confirm-row">
                        <span>Удалить все чаты и модули?</span>
                        <button
                          type="button"
                          className="danger-btn"
                          onClick={() => {
                            onClearData();
                            setConfirmClear(false);
                          }}
                        >
                          Да, удалить
                        </button>
                        <button type="button" className="ghost-btn" onClick={() => setConfirmClear(false)}>
                          Отмена
                        </button>
                      </div>
                    )}
                  </div>
                </section>
                <div className="notice notice--danger">
                  <Icon name="alert" size={16} />
                  <span>Действие необратимо. Сначала сделайте экспорт, если нужна копия.</span>
                </div>
              </>
            )}
          </div>
        </div>

        <footer className="modal__footer">
          <span className="modal__footer-note">
            <Icon name="shield" size={13} /> Локальное хранилище
          </span>
          <div className="modal__footer-right">
            <button type="button" className="ghost-btn" onClick={onClose}>
              Отмена
            </button>
            <button type="button" className="primary-btn" onClick={save}>
              <Icon name="check" size={16} />
              Сохранить
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
