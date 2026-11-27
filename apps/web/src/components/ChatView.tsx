import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from 'react';
import { Chat, ModuleIntegration, Settings } from '../types';
import { cls } from '../lib/utils';
import { Icon } from './Icon';
import { MessageBubble } from './MessageBubble';

interface ChatViewProps {
  chat: Chat;
  modules: ModuleIntegration[];
  settings: Settings;
  isStreaming: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
  onOpenModules: () => void;
  onOpenSettings: () => void;
  onOpenPython: () => void;
  onOpenJobs: () => void;
  onOpenSidebar: () => void;
  onSuggestion: (text: string) => void;
  onNewChat: () => void;
}

const QUICK_ACTIONS = [
  { label: 'Добавить модуль', icon: 'plus' as const, text: 'Как добавить интеграцию?' },
  { label: 'Проверить модули', icon: 'refresh' as const, text: 'Проверь мои модули' },
  { label: 'Что ты умеешь?', icon: 'sparkles' as const, text: 'Что ты умеешь?' },
];

export function ChatView({
  chat,
  modules,
  settings,
  isStreaming,
  onSend,
  onStop,
  onOpenModules,
  onOpenSettings,
  onOpenPython,
  onOpenJobs,
  onOpenSidebar,
  onSuggestion,
  onNewChat,
}: ChatViewProps) {
  const [draft, setDraft] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);

  const activeModules = modules.filter((module) => module.enabled).length;
  const isApiMode = Boolean(settings.apiBase.trim());

  useEffect(() => {
    stickRef.current = true;
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [chat.id]);

  useEffect(() => {
    if (stickRef.current) {
      bottomRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
    }
  }, [chat.messages, isStreaming]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [draft]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
  };

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    const text = draft.trim();
    if (!text || isStreaming) return;
    setDraft('');
    onSend(text);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
    if (settings.sendOnEnter) {
      event.preventDefault();
      submit();
    } else if (event.metaKey || event.ctrlKey) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <main className="chat">
      <header className="chat__header">
        <button type="button" className="icon-btn chat__menu" onClick={onOpenSidebar} aria-label="Открыть меню">
          <Icon name="menu" />
        </button>
        <div className="chat__heading">
          <h1>{chat.title}</h1>
          <div className="chat__subtitle">
            <span className={cls('status-dot', isApiMode ? 'status-dot--on' : 'status-dot--local')} />
            {isApiMode ? `API · ${settings.model}` : 'Локальный режим · без сети'}
            <span className="chat__divider" />
            <span>{activeModules} модулей активно</span>
          </div>
        </div>
        <div className="chat__actions">
          <button type="button" className="ghost-btn" onClick={onOpenJobs} title="Задачи на ПК">
            <Icon name="layers" size={17} />
            <span>ПК</span>
          </button>
          <button type="button" className="ghost-btn" onClick={onOpenModules}>
            <Icon name="modules" size={17} />
            <span>Модули</span>
          </button>
          <button type="button" className="icon-btn" onClick={onOpenSettings} aria-label="Настройки">
            <Icon name="settings" />
          </button>
        </div>
      </header>

      <div className="chat__scroll" ref={scrollRef} onScroll={handleScroll}>
        <div className="chat__inner">
          {chat.messages.length === 0 ? (
            <section className="empty-state">
              <div className="empty-state__logo">
                <span />
                <span />
                <span />
                <span />
              </div>
              <h2>Чем займёмся?</h2>
              <p>
                Опиши сервис, который нужно подключить, или задай вопрос о текущих модулях. Tessera
                разложит задачу на шаги и поможет с настройкой.
              </p>
              <div className="empty-state__cards">
                {QUICK_ACTIONS.map((action) => (
                  <button
                    key={action.label}
                    type="button"
                    className="empty-card"
                    onClick={() => onSuggestion(action.text)}
                  >
                    <Icon name={action.icon} size={18} />
                    <span>{action.label}</span>
                  </button>
                ))}
              </div>
            </section>
          ) : (
            <div className="messages">
              {chat.messages.map((message) => (
                <MessageBubble key={message.id} message={message} onSuggestion={onSuggestion} />
              ))}
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="composer-wrap">
        {chat.messages.length > 0 && !isStreaming && (
          <div className="quick-actions">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.label}
                type="button"
                className="chip chip--muted"
                onClick={() => onSuggestion(action.text)}
              >
                <Icon name={action.icon} size={14} />
                {action.label}
              </button>
            ))}
            <button type="button" className="chip chip--muted" onClick={onNewChat}>
              <Icon name="plus" size={14} />
              Новый чат
            </button>
          </div>
        )}

        <form className="composer" onSubmit={submit}>
          <button
            type="button"
            className="composer__tool"
            onClick={onOpenModules}
            title="Модули"
            aria-label="Модули"
          >
            <Icon name="puzzle" size={19} />
          </button>
          <button
            type="button"
            className="composer__tool"
            onClick={onOpenPython}
            title="Python"
            aria-label="Python"
          >
            <Icon name="code" size={19} />
          </button>
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Спроси о модулях…"
            rows={1}
            aria-label="Сообщение"
          />
          {isStreaming ? (
            <button type="button" className="composer__send composer__send--stop" onClick={onStop} aria-label="Остановить">
              <Icon name="stop" size={18} />
            </button>
          ) : (
            <button type="submit" className="composer__send" disabled={!draft.trim()} aria-label="Отправить">
              <Icon name="send" size={18} />
            </button>
          )}
        </form>
        <div className="composer__hint">
          <span>
            {settings.sendOnEnter ? 'Enter — отправить, Shift+Enter — новая строка' : 'Ctrl+Enter — отправить'}
          </span>
          <span className="composer__hint-right">
            <Icon name="shield" size={12} />
            Данные остаются на устройстве
          </span>
        </div>
      </div>
    </main>
  );
}
