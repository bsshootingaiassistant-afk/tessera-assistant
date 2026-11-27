import { FormEvent, useEffect, useState } from 'react';
import { RemoteJob, Settings } from '../types';
import { workerReady } from '../lib/jobs';
import { cls, relativeTime } from '../lib/utils';
import { Icon } from './Icon';

interface JobsModalProps {
  open: boolean;
  settings: Settings;
  jobs: RemoteJob[];
  submitting: boolean;
  onClose: () => void;
  onSubmit: (prompt: string) => void;
  onRefresh: () => void;
  onClear: () => void;
  onUseResult: (result: string) => void;
}

const STATUS_LABEL: Record<RemoteJob['status'], string> = {
  queued: 'В очереди',
  running: 'Выполняется',
  done: 'Готово',
  failed: 'Ошибка',
};

export function JobsModal({
  open,
  settings,
  jobs,
  submitting,
  onClose,
  onSubmit,
  onRefresh,
  onClear,
  onUseResult,
}: JobsModalProps) {
  const [prompt, setPrompt] = useState('');

  useEffect(() => {
    if (open) setPrompt('');
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

  const ready = workerReady(settings);
  const active = jobs.filter((job) => job.status === 'queued' || job.status === 'running').length;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!prompt.trim() || submitting || !ready) return;
    onSubmit(prompt.trim());
    setPrompt('');
  };

  return (
    <div className="modal modal--jobs" role="dialog" aria-modal="true" aria-labelledby="jobs-title">
      <button type="button" className="modal__backdrop" aria-label="Закрыть" onClick={onClose} />
      <div className="modal__card jobs-modal">
        <header className="modal__header">
          <div>
            <h2 id="jobs-title">Задачи на ПК</h2>
            <p>
              {ready ? `Worker · ${settings.model}` : 'Сначала настройте Tessera Server'} · активных: {active}
            </p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Закрыть">
            <Icon name="close" />
          </button>
        </header>

        <div className="modal__body">
          <form className="jobs-form" onSubmit={submit}>
            <div className="field">
              <label htmlFor="job-prompt">Что сделать на ПК</label>
              <textarea
                id="job-prompt"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                rows={4}
                placeholder="Например: спроектируй проект, посчитай нагрузки, проверь код…"
              />
            </div>
            <div className="jobs-form__footer">
              <small className="field-hint">
                {ready
                  ? 'Задача уйдёт в фон. Можно закрыть приложение — результат сохранится на ПК.'
                  : 'Base URL и API-ключ задаются в Настройках → ИИ и API.'}
              </small>
              <button type="submit" className="primary-btn" disabled={!ready || submitting || !prompt.trim()}>
                {submitting ? <span className="spinner" /> : <Icon name="send" size={15} />}
                {submitting ? 'Отправляю…' : 'На ПК'}
              </button>
            </div>
          </form>

          <div className="jobs-list">
            <div className="jobs-list__head">
              <strong>История</strong>
              <div>
                <button type="button" className="mini-btn" onClick={onRefresh} disabled={!ready}>
                  <Icon name="refresh" size={13} />
                  Обновить
                </button>
                <button type="button" className="mini-btn mini-btn--danger" onClick={onClear} disabled={jobs.length === 0}>
                  <Icon name="trash" size={13} />
                  Очистить
                </button>
              </div>
            </div>

            {jobs.length === 0 && <div className="module-empty">Задач пока нет.</div>}

            {jobs.map((job) => (
              <article key={job.id} className={cls('job-card', `job-card--${job.status}`)}>
                <div className="job-card__head">
                  <span className={cls('badge', `badge--${job.status === 'done' ? 'success' : job.status === 'failed' ? 'danger' : 'soft'}`)}>
                    {STATUS_LABEL[job.status]}
                  </span>
                  <span>{job.model}</span>
                  <span>{relativeTime(job.updatedAt)}</span>
                </div>
                <p className="job-card__prompt">{job.prompt}</p>
                {job.error && <div className="form-error">{job.error}</div>}
                {job.result && (
                  <>
                    <pre className="job-card__result">{job.result.slice(0, 1200)}</pre>
                    <button type="button" className="mini-btn" onClick={() => onUseResult(job.result)}>
                      <Icon name="arrow-right" size={13} />
                      В чат
                    </button>
                  </>
                )}
              </article>
            ))}
          </div>
        </div>

        <footer className="modal__footer">
          <span className="modal__footer-note">
            <Icon name="shield" size={13} /> Токен хранится на устройстве
          </span>
          <button type="button" className="ghost-btn" onClick={onClose}>
            Закрыть
          </button>
        </footer>
      </div>
    </div>
  );
}
