import { FormEvent, useEffect, useState } from 'react';
import { ModuleIntegration, Settings } from '../types';
import {
  FEEDBACK_KINDS,
  FeedbackKind,
  buildFeedbackPayload,
  feedbackAsText,
  submitFeedback,
} from '../lib/feedback';
import { repoSlug } from '../lib/update';
import { cls } from '../lib/utils';
import { Icon } from './Icon';

interface FeedbackModalProps {
  open: boolean;
  page: string;
  settings: Settings;
  modules: ModuleIntegration[];
  onClose: () => void;
  onResult: (message: string, kind: 'success' | 'info' | 'error') => void;
}

export function FeedbackModal({
  open,
  page,
  settings,
  modules,
  onClose,
  onResult,
}: FeedbackModalProps) {
  const [kind, setKind] = useState<FeedbackKind>('bug');
  const [message, setMessage] = useState('');
  const [contact, setContact] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setKind('bug');
    setMessage('');
    setContact('');
    setError('');
    setSending(false);
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

  const payload = buildFeedbackPayload(kind, message, contact, page, settings, modules);
  const canSend = message.trim().length >= 5 && !sending;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(feedbackAsText(payload));
      onResult('Отзыв скопирован в буфер обмена', 'info');
    } catch {
      onResult('Не удалось скопировать отзыв', 'error');
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSend) return;
    setSending(true);
    setError('');
    try {
      const result = await submitFeedback(payload, settings.feedbackEndpoint, repoSlug());
      if (result.status === 'opened' && result.url) {
        window.open(result.url, '_blank', 'noopener,noreferrer');
        onResult('Открыта форма GitHub Issues — отправьте отзыв там', 'info');
      } else if (result.status === 'sent') {
        onResult('Спасибо! Отзыв отправлен', 'success');
      } else {
        onResult('Отзыв сохранён локально — настройте endpoint в режиме разработчика', 'info');
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отправить отзыв');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="modal modal--feedback" role="dialog" aria-modal="true" aria-labelledby="feedback-title">
      <button type="button" className="modal__backdrop" aria-label="Закрыть" onClick={onClose} />
      <form className="modal__card feedback-modal" onSubmit={submit}>
        <header className="modal__header">
          <div>
            <h2 id="feedback-title">Отправить отзыв</h2>
            <p>Режим разработчика · {page}</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Закрыть">
            <Icon name="close" />
          </button>
        </header>

        <div className="modal__body">
          <div className="field">
            <label>Тип отзыва</label>
            <div className="feedback-kinds">
              {FEEDBACK_KINDS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={cls('feedback-kind', kind === item.id && 'feedback-kind--active')}
                  onClick={() => setKind(item.id)}
                >
                  <strong>{item.label}</strong>
                  <small>{item.hint}</small>
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label htmlFor="feedback-message">
              Сообщение <span className="label-hint">минимум 5 символов</span>
            </label>
            <textarea
              id="feedback-message"
              value={message}
              onChange={(event) => setMessage(event.target.value.slice(0, 4000))}
              rows={6}
              placeholder="Что случилось или что улучшить? Чем подробнее, тем полезнее."
              autoFocus
            />
            <small className="field-hint">{message.length} / 4000</small>
          </div>

          <div className="field">
            <label htmlFor="feedback-contact">
              Контакт для ответа <span className="label-hint">необязательно</span>
            </label>
            <input
              id="feedback-contact"
              value={contact}
              onChange={(event) => setContact(event.target.value.slice(0, 200))}
              placeholder="email или @username"
              autoComplete="off"
            />
          </div>

          <details className="diagnostics">
            <summary>Диагностика приложения</summary>
            <pre>{feedbackAsText(payload)}</pre>
          </details>

          {error && <div className="form-error">{error}</div>}

          <div className="notice">
            <Icon name="shield" size={16} />
            <span>
              {settings.feedbackEndpoint
                ? 'Отзыв уйдёт на настроенный endpoint. Аккаунты GitHub в приложение не встраиваются.'
                : repoSlug()
                  ? 'Откроется публичная форма GitHub Issues. Вход в GitHub нужен только для отправки и не сохраняется приложением.'
                  : 'Endpoint не настроен — отзыв сохранится локально и его можно скопировать.'}
            </span>
          </div>
        </div>

        <footer className="modal__footer">
          <button type="button" className="ghost-btn" onClick={copy} disabled={message.trim().length < 5}>
            <Icon name="copy" size={16} />
            Скопировать
          </button>
          <div className="modal__footer-right">
            <button type="button" className="ghost-btn" onClick={onClose}>
              Отмена
            </button>
            <button type="submit" className="primary-btn" disabled={!canSend}>
              {sending ? <span className="spinner" /> : <Icon name="send" size={16} />}
              {sending ? 'Отправляю…' : 'Отправить'}
            </button>
          </div>
        </footer>
      </form>
    </div>
  );
}
