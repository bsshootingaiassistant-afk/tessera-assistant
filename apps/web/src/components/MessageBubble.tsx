import { ChatMessage } from '../types';
import { cls, formatTime } from '../lib/utils';
import { Icon } from './Icon';
import { RichText } from './RichText';

interface MessageBubbleProps {
  message: ChatMessage;
  onSuggestion: (text: string) => void;
}

export function MessageBubble({ message, onSuggestion }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <article className={cls('message', isUser ? 'message--user' : 'message--assistant')}>
      <div className={cls('message__avatar', isUser ? 'message__avatar--user' : 'message__avatar--bot')}>
        {isUser ? <Icon name="user" size={18} /> : <Icon name="sparkles" size={18} />}
      </div>
      <div className="message__content">
        <div className="message__meta">
          <strong>{isUser ? 'Вы' : 'Tessera'}</strong>
          <span>{formatTime(message.createdAt)}</span>
          {message.error && <span className="badge badge--danger">ошибка</span>}
        </div>

        <div className={cls('message__bubble', message.error && 'message__bubble--error')}>
          {message.pending && !message.content ? (
            <div className="typing" aria-label="Tessera печатает">
              <span />
              <span />
              <span />
            </div>
          ) : (
            <RichText content={message.content} />
          )}
          {message.pending && message.content && <span className="caret" />}
        </div>

        {!message.pending && message.suggestions && message.suggestions.length > 0 && (
          <div className="suggestions">
            {message.suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                className="chip"
                onClick={() => onSuggestion(suggestion)}
              >
                {suggestion}
                <Icon name="arrow-right" size={13} />
              </button>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
