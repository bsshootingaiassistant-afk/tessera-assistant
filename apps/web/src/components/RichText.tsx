import { ReactNode, useState } from 'react';
import { Icon } from './Icon';

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\((https?:\/\/[^)\s]+)\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    const key = `${keyPrefix}-${index}`;
    index += 1;

    if (token.startsWith('**')) {
      nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('`')) {
      nodes.push(<code key={key}>{token.slice(1, -1)}</code>);
    } else {
      const label = token.slice(1, token.indexOf(']'));
      const url = token.slice(token.indexOf('](') + 2, -1);
      nodes.push(
        <a key={key} href={url} target="_blank" rel="noopener noreferrer">
          {label}
        </a>,
      );
    }
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

function CodeBlock({ code, language }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard may be unavailable on http origins.
    }
  };

  return (
    <div className="code-block">
      <div className="code-block__head">
        <span>{language || 'code'}</span>
        <button type="button" onClick={copy} className="code-block__copy">
          <Icon name={copied ? 'check' : 'copy'} size={14} />
          {copied ? 'Скопировано' : 'Копировать'}
        </button>
      </div>
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  );
}

function TextBlock({ text, keyPrefix }: { text: string; keyPrefix: string }) {
  const lines = text.split('\n');
  const blocks: ReactNode[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    const joined = paragraph.join(' ').trim();
    if (joined) {
      blocks.push(<p key={`${keyPrefix}-p-${blocks.length}`}>{renderInline(joined, `${keyPrefix}-p-${blocks.length}`)}</p>);
    }
    paragraph = [];
  };

  const flushList = () => {
    if (!list) return;
    const items = list.items.map((item, i) => (
      <li key={`${keyPrefix}-li-${blocks.length}-${i}`}>{renderInline(item, `${keyPrefix}-li-${blocks.length}-${i}`)}</li>
    ));
    blocks.push(
      list.ordered ? (
        <ol key={`${keyPrefix}-ol-${blocks.length}`}>{items}</ol>
      ) : (
        <ul key={`${keyPrefix}-ul-${blocks.length}`}>{items}</ul>
      ),
    );
    list = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const bullet = /^[-*]\s+(.*)$/.exec(line);
    const ordered = /^\d+[.)]\s+(.*)$/.exec(line);

    if (bullet) {
      flushParagraph();
      if (!list || list.ordered) {
        flushList();
        list = { ordered: false, items: [] };
      }
      list.items.push(bullet[1]);
      continue;
    }
    if (ordered) {
      flushParagraph();
      if (!list || !list.ordered) {
        flushList();
        list = { ordered: true, items: [] };
      }
      list.items.push(ordered[1]);
      continue;
    }
    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }
    flushList();
    paragraph.push(line.trim());
  }

  flushParagraph();
  flushList();
  return <>{blocks}</>;
}

export function RichText({ content }: { content: string }) {
  const parts: ReactNode[] = [];
  const fence = /```([\w+-]*)\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = fence.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(
        <TextBlock
          key={`text-${index}`}
          text={content.slice(lastIndex, match.index)}
          keyPrefix={`t-${index}`}
        />,
      );
      index += 1;
    }
    parts.push(<CodeBlock key={`code-${index}`} code={match[2].trim()} language={match[1]} />);
    index += 1;
    lastIndex = fence.lastIndex;
  }

  if (lastIndex < content.length) {
    parts.push(<TextBlock key={`text-${index}`} text={content.slice(lastIndex)} keyPrefix={`t-${index}`} />);
  }

  return <div className="rich-text">{parts}</div>;
}
