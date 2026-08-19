'use client';

import { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ChatMessage } from '@/hooks/useAgentChat';

// ── Scoped markdown styles ────────────────────────────────────────────────────
// Applied only inside assistant bubbles via the .md-body class.

const MD_STYLES = `
  .md-body { font-family: var(--font-body); font-size: 14px; line-height: 1.7; color: var(--color-ink); }
  .md-body p  { margin: 0 0 10px; }
  .md-body p:last-child { margin-bottom: 0; }
  .md-body ul, .md-body ol { margin: 6px 0 10px; padding-left: 22px; }
  .md-body li { margin-bottom: 4px; }
  .md-body li:last-child { margin-bottom: 0; }
  .md-body strong { font-weight: 600; color: var(--color-ink); }
  .md-body em { font-style: italic; }
  .md-body code {
    font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', ui-monospace, monospace;
    font-size: 12.5px;
    background: rgba(0,0,0,0.07);
    color: var(--color-ink);
    padding: 1px 5px;
    border-radius: 4px;
    border: 1px solid rgba(0,0,0,0.08);
  }
  .md-body pre {
    background: rgba(0,0,0,0.06);
    border: 1px solid var(--color-hairline);
    border-radius: 8px;
    padding: 12px 14px;
    overflow-x: auto;
    margin: 10px 0;
  }
  .md-body pre code {
    background: none;
    border: none;
    padding: 0;
    font-size: 13px;
  }
  .md-body table {
    width: 100%;
    border-collapse: collapse;
    margin: 10px 0;
    font-size: 13px;
  }
  .md-body th {
    background: rgba(0,0,0,0.05);
    font-weight: 600;
    text-align: left;
    padding: 7px 12px;
    border: 1px solid var(--color-hairline);
  }
  .md-body td {
    padding: 6px 12px;
    border: 1px solid var(--color-hairline);
  }
  .md-body tr:nth-child(even) td {
    background: rgba(0,0,0,0.02);
  }
  .md-body h1, .md-body h2, .md-body h3 {
    font-family: var(--font-display);
    font-weight: 400;
    color: var(--color-ink);
    margin: 12px 0 6px;
  }
  .md-body h1 { font-size: 18px; }
  .md-body h2 { font-size: 16px; }
  .md-body h3 { font-size: 14px; font-weight: 500; }
  .md-body blockquote {
    border-left: 3px solid var(--color-hairline);
    margin: 8px 0;
    padding: 4px 12px;
    color: var(--color-muted);
    font-style: italic;
  }
  .md-body hr {
    border: none;
    border-top: 1px solid var(--color-hairline);
    margin: 12px 0;
  }
`;

// ── Pulsing 3-dot loader (Claude style) ───────────────────────────────────────

function ThinkingDots() {
  return (
    <>
      <style>{`
        @keyframes dot-pop {
          0%, 60%, 100% { opacity: 0.2; transform: scale(0.75); }
          30%            { opacity: 1;   transform: scale(1);    }
        }
      `}</style>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '14px 18px',
        backgroundColor: 'var(--color-surface-card)',
        borderRadius: '18px 18px 18px 4px',
        border: '1px solid var(--color-hairline)',
        boxShadow: 'var(--shadow-card)',
      }}>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              width: 7, height: 7,
              borderRadius: '50%',
              backgroundColor: 'var(--color-muted)',
              display: 'inline-block',
              animation: `dot-pop 1.2s ease-in-out ${i * 200}ms infinite`,
            }}
          />
        ))}
      </div>
    </>
  );
}

// ── Single message bubble ─────────────────────────────────────────────────────

function Bubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === 'user';

  const time = msg.timestamp.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  if (isUser) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
        <div style={{
          backgroundColor: 'var(--color-ink)',
          color: 'white',
          borderRadius: '18px 18px 4px 18px',
          padding: '12px 16px',
          maxWidth: '72%',
          fontFamily: 'var(--font-body)',
          fontSize: 14,
          lineHeight: 1.6,
          boxShadow: 'var(--shadow-card)',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}>
          {msg.content}
        </div>
        <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--color-muted)', paddingInline: 4 }}>
          You · {time}
        </span>
      </div>
    );
  }

  // Assistant bubble — render markdown
  const bgColor = msg.isAborted
    ? 'var(--color-canvas-soft)'
    : msg.isError
    ? '#fff5f5'
    : 'var(--color-surface-card)';

  const borderColor = msg.isError ? '#fecaca' : 'var(--color-hairline)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
      <div style={{
        backgroundColor: bgColor,
        borderRadius: '18px 18px 18px 4px',
        padding: '12px 16px',
        maxWidth: '82%',
        border: `1px solid ${borderColor}`,
        boxShadow: 'var(--shadow-card)',
        fontStyle: msg.isAborted ? 'italic' : 'normal',
        color: msg.isError ? 'var(--color-error)' : undefined,
        wordBreak: 'break-word',
      }}>
        {msg.isAborted || msg.isError ? (
          <span style={{
            fontFamily: 'var(--font-body)', fontSize: 14,
            lineHeight: 1.6,
          }}>
            {msg.content}
          </span>
        ) : (
          <div className="md-body">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {msg.content}
            </ReactMarkdown>
          </div>
        )}
      </div>
      <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--color-muted)', paddingInline: 4 }}>
        Agent · {time}
      </span>
    </div>
  );
}

// ── Message list ──────────────────────────────────────────────────────────────

interface Props {
  messages: ChatMessage[];
  isLoading: boolean;
}

export function MessageList({ messages, isLoading }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  return (
    <>
      {/* Inject scoped markdown styles once */}
      <style>{MD_STYLES}</style>

      {messages.length === 0 && !isLoading ? (
        <div style={{
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 12,
          // Fill remaining space so empty state is vertically centred
          minHeight: 'calc(100vh - 350px)',
          padding: '40px 0',
        }}>
          <span style={{ fontSize: 36, opacity: 0.2 }}>💬</span>
          <p style={{
            fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 300,
            color: 'var(--color-ink)', margin: 0,
          }}>
            Ask anything about your data
          </p>
          <p style={{
            fontFamily: 'var(--font-body)', fontSize: 13,
            color: 'var(--color-muted)', margin: 0, textAlign: 'center', maxWidth: 340,
          }}>
            The agent can run SQL queries, check column stats, detect anomalies,
            and explain results in plain English.
          </p>
        </div>
      ) : (
        // Plain flex column — page scroll handles scrolling, not an inner container
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          padding: '24px 0 8px',
        }}>
          {messages.map((msg) => (
            <Bubble key={msg.id} msg={msg} />
          ))}

          {isLoading && (
            <div style={{ alignSelf: 'flex-start' }}>
              <ThinkingDots />
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      )}
    </>
  );
}
