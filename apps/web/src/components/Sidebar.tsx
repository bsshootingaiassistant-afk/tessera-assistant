import { useState } from 'react';
import { Chat } from '../types';
import { cls, formatDate, truncate } from '../lib/utils';
import { Icon } from './Icon';

interface SidebarProps {
  chats: Chat[];
  activeChatId: string;
  modulesCount: number;
  activeModules: number;
  onNewChat: () => void;
  onSelectChat: (id: string) => void;
  onDeleteChat: (id: string) => void;
  onOpenModules: () => void;
  onOpenSettings: () => void;
  onClose: () => void;
  isMobileOpen: boolean;
}

export function Sidebar({
  chats,
  activeChatId,
  modulesCount,
  activeModules,
  onNewChat,
  onSelectChat,
  onDeleteChat,
  onOpenModules,
  onOpenSettings,
  onClose,
  isMobileOpen,
}: SidebarProps) {
  const [query, setQuery] = useState('');
  const filtered = query
    ? chats.filter(
        (chat) =>
          chat.title.toLowerCase().includes(query.toLowerCase()) ||
          chat.messages.some((m) => m.content.toLowerCase().includes(query.toLowerCase())),
      )
    : chats;

  return (
    <>
      <aside className={cls('sidebar', isMobileOpen && 'sidebar--open')}>
        <div className="sidebar__bg" aria-hidden="true" />
        <div className="sidebar__top">
          <div className="brand">
            <span className="brand__mark">
              <span />
              <span />
              <span />
              <span />
            </span>
            <div className="brand__text">
              <strong>Tessera</strong>
              <small>AI workspace</small>
            </div>
          </div>
          <button type="button" className="icon-btn sidebar__close" onClick={onClose} aria-label="Закрыть меню">
            <Icon name="close" />
          </button>
        </div>

        <button type="button" className="new-chat" onClick={onNewChat}>
          <span className="new-chat__icon">
            <Icon name="plus" size={18} />
          </span>
          Новый чат
          <kbd>⌘ K</kbd>
        </button>

        <div className="sidebar__search">
          <Icon name="search" size={16} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск по чатам"
            aria-label="Поиск по чатам"
          />
        </div>

        <div className="sidebar__label">
          История
          <span>{chats.length}</span>
        </div>

        <nav className="chat-list" aria-label="История чатов">
          {filtered.length === 0 && <div className="chat-list__empty">Ничего не найдено</div>}
          {filtered.map((chat) => (
            <div
              key={chat.id}
              className={cls('chat-item', chat.id === activeChatId && 'chat-item--active')}
              role="button"
              tabIndex={0}
              onClick={() => onSelectChat(chat.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') onSelectChat(chat.id);
              }}
            >
              <span className="chat-item__icon">
                <Icon name="chat" size={16} />
              </span>
              <span className="chat-item__body">
                <span className="chat-item__title">{truncate(chat.title, 42)}</span>
                <span className="chat-item__meta">{formatDate(chat.updatedAt)}</span>
              </span>
              <button
                type="button"
                className="chat-item__delete"
                aria-label="Удалить чат"
                onClick={(event) => {
                  event.stopPropagation();
                  onDeleteChat(chat.id);
                }}
              >
                <Icon name="trash" size={14} />
              </button>
            </div>
          ))}
        </nav>

        <div className="sidebar__spacer" />

        <button type="button" className="sidebar__action" onClick={onOpenModules}>
          <span className="sidebar__action-icon">
            <Icon name="modules" size={18} />
          </span>
          <span>
            Модули
            <small>
              {activeModules} из {modulesCount} активны
            </small>
          </span>
          <span className="status-dot status-dot--on" />
        </button>

        <button type="button" className="sidebar__action" onClick={onOpenSettings}>
          <span className="sidebar__action-icon">
            <Icon name="settings" size={18} />
          </span>
          <span>
            Настройки
            <small>Тема, API, обновления</small>
          </span>
        </button>

        <div className="sidebar__footer">
          <span className="badge badge--soft">v{__APP_VERSION__}</span>
          <span>Локальное хранилище</span>
        </div>
      </aside>
      {isMobileOpen && <button type="button" className="sidebar-backdrop" aria-label="Закрыть меню" onClick={onClose} />}
    </>
  );
}
