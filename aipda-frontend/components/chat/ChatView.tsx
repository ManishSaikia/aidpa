'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useAgentChat } from '@/hooks/useAgentChat';
import { MessageList } from '@/components/chat/MessageList';

// ── Time-ago helper ───────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)  return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ── Session Sidebar ───────────────────────────────────────────────────────────

interface SidebarProps {
  sessions: ReturnType<typeof useAgentChat>['sessions'];
  sessionsLoading: boolean;
  activeSessionId: string | null;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onDelete: () => void;
}

function SessionSidebar({
  sessions, sessionsLoading, activeSessionId, onSelect, onNewChat, onDelete,
}: SidebarProps) {
  return (
    <div style={{
      width: 240,
      flexShrink: 0,
      borderRight: '1px solid var(--color-hairline)',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: 'var(--color-canvas-soft)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 14px 12px',
        borderBottom: '1px solid var(--color-hairline)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{
          fontFamily: 'var(--font-body)',
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--color-muted)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}>
          Chat History
        </span>
        {activeSessionId && (
          <button
            onClick={onDelete}
            title="Delete this session"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--color-muted)', fontSize: 14, padding: '2px 4px',
              borderRadius: 4, lineHeight: 1,
            }}
          >
            🗑
          </button>
        )}
      </div>

      {/* New Chat button */}
      <div style={{ padding: '10px 12px 8px' }}>
        <button
          onClick={onNewChat}
          style={{
            width: '100%',
            padding: '8px 12px',
            borderRadius: 8,
            border: '1px solid var(--color-hairline)',
            background: activeSessionId === null ? 'var(--color-ink)' : 'var(--color-surface-card)',
            color: activeSessionId === null ? '#fff' : 'var(--color-ink)',
            fontFamily: 'var(--font-body)',
            fontSize: 12,
            fontWeight: 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            transition: 'background 120ms, color 120ms',
          }}
        >
          <span style={{ fontSize: 14 }}>+</span>
          New Chat
        </button>
      </div>

      {/* Session list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 12px' }}>
        {sessionsLoading && (
          <p style={{
            fontFamily: 'var(--font-body)', fontSize: 12,
            color: 'var(--color-muted)', padding: '12px 4px',
          }}>
            Loading…
          </p>
        )}

        {!sessionsLoading && sessions.length === 0 && (
          <p style={{
            fontFamily: 'var(--font-body)', fontSize: 12,
            color: 'var(--color-muted)', padding: '12px 4px', fontStyle: 'italic',
          }}>
            No conversations yet
          </p>
        )}

        {sessions.map((s) => {
          const isActive = s.session_id === activeSessionId;
          return (
            <button
              key={s.session_id}
              onClick={() => onSelect(s.session_id)}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '9px 10px',
                borderRadius: 8,
                border: 'none',
                backgroundColor: isActive ? 'var(--color-surface-card)' : 'transparent',
                boxShadow: isActive ? 'var(--shadow-card)' : 'none',
                cursor: 'pointer',
                marginBottom: 2,
                transition: 'background 100ms',
              }}
            >
              <div style={{
                fontFamily: 'var(--font-body)', fontSize: 12.5,
                color: 'var(--color-ink)',
                fontWeight: isActive ? 500 : 400,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                marginBottom: 2,
              }}>
                {s.title}
              </div>
              <div style={{
                fontFamily: 'var(--font-body)', fontSize: 10.5,
                color: 'var(--color-muted)',
              }}>
                {s.message_count} msg{s.message_count !== 1 ? 's' : ''} · {timeAgo(s.last_used_at)}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Root component ────────────────────────────────────────────────────────────

interface Props {
  datasetId: string;
  isActive: boolean;
}

export function ChatView({ datasetId, isActive }: Props) {
  const {
    sessions, sessionsLoading,
    activeSessionId, messages, phase,
    selectSession, startNewSession,
    sendMessage, abort, deleteActiveSession,
  } = useAgentChat(datasetId);

  const [draft, setDraft] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isLoading = phase === 'loading';

  // Lock page scroll when this tab is active
  useEffect(() => {
    if (isActive) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isActive]);

  const resize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, []);

  const handleSend = useCallback(() => {
    if (!draft.trim() || isLoading) return;
    sendMessage(draft);
    setDraft('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }, [draft, isLoading, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  return (
    <div style={{
      height: 'calc(100vh - 116px)',
      display: 'flex',
      overflow: 'hidden',
    }}>
      {/* Sidebar */}
      <SessionSidebar
        sessions={sessions}
        sessionsLoading={sessionsLoading}
        activeSessionId={activeSessionId}
        onSelect={selectSession}
        onNewChat={startNewSession}
        onDelete={deleteActiveSession}
      />

      {/* Chat pane */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        backgroundColor: 'var(--color-canvas)',
      }}>
        {/* Messages — scrollable */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 8px' }}>
          {activeSessionId === null && messages.length === 0 ? (
            // Empty state — no session selected
            <div style={{
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              height: '100%', gap: 8,
              padding: '0 32px',
            }}>
              <span style={{ fontSize: 32 }}>💬</span>
              <p style={{
                fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 300,
                color: 'var(--color-ink)', margin: 0, textAlign: 'center',
              }}>
                Start a new chat or pick a past session
              </p>
              <p style={{
                fontFamily: 'var(--font-body)', fontSize: 13,
                color: 'var(--color-muted)', margin: 0, textAlign: 'center',
              }}>
                Ask questions about your data in plain English. The AI will run SQL, compute stats, and explain results.
              </p>
            </div>
          ) : (
            <MessageList messages={messages} isLoading={isLoading} />
          )}
        </div>

        {/* Sticky input bar */}
        <div style={{
          flexShrink: 0,
          borderTop: '1px solid var(--color-hairline)',
          backgroundColor: 'var(--color-canvas)',
          padding: '12px 24px 16px',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: 10,
            padding: '10px 14px',
            borderRadius: 'var(--radius-xl)',
            border: '1px solid var(--color-hairline)',
            backgroundColor: 'var(--color-surface-card)',
            boxShadow: 'var(--shadow-card)',
            transition: 'border-color 150ms ease',
          }}
            onFocus={(e) => {
              (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--color-ink)';
            }}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--color-hairline)';
              }
            }}
          >
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => { setDraft(e.target.value); resize(); }}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              placeholder="Ask about your data… (Enter to send, Shift+Enter for newline)"
              rows={1}
              style={{
                flex: 1, resize: 'none', border: 'none', outline: 'none',
                background: 'transparent', fontFamily: 'var(--font-body)',
                fontSize: 14, color: 'var(--color-ink)', lineHeight: 1.6,
                padding: 0, minHeight: 24, maxHeight: 160, overflowY: 'auto',
                opacity: isLoading ? 0.5 : 1,
              }}
            />

            {isLoading && (
              <button onClick={abort} title="Stop" style={{
                width: 32, height: 32, flexShrink: 0, borderRadius: '50%',
                backgroundColor: 'var(--color-ink)', color: 'white',
                border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700,
              }}>
                ■
              </button>
            )}

            {!isLoading && (
              <button onClick={handleSend} disabled={!draft.trim()} title="Send (Enter)" style={{
                width: 32, height: 32, flexShrink: 0, borderRadius: '50%',
                backgroundColor: draft.trim() ? 'var(--color-ink)' : 'var(--color-hairline)',
                color: draft.trim() ? 'white' : 'var(--color-muted)',
                border: 'none', cursor: draft.trim() ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background-color 150ms ease, color 150ms ease',
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 19V5M5 12l7-7 7 7"/>
                </svg>
              </button>
            )}
          </div>

          <div style={{
            display: 'flex', justifyContent: 'flex-end',
            padding: '6px 4px 0',
          }}>
            <span style={{
              fontFamily: 'var(--font-body)', fontSize: 11,
              color: 'var(--color-muted)',
            }}>
              Enter ↵ to send · Shift+Enter for newline
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
