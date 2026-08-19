'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useQueryHistory, type QueryHistoryItem } from '@/hooks/useQueryHistory';

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(date: Date): string {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return date.toLocaleDateString();
}

// ── Left sidebar ──────────────────────────────────────────────────────────────

function Sidebar({
  items,
  selectedId,
  onSelect,
  onClear,
  isLoading,
}: {
  items: QueryHistoryItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onClear: () => void;
  isLoading: boolean;
}) {
  return (
    <div style={{
      width: 260,
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      borderRight: '1px solid var(--color-hairline)',
      backgroundColor: 'var(--color-canvas-soft)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 16px 10px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid var(--color-hairline)',
        flexShrink: 0,
      }}>
        <span style={{
          fontFamily: 'var(--font-body)',
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--color-muted)',
        }}>
          History
        </span>
        {items.length > 0 && !isLoading && (
          <button
            onClick={onClear}
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 11,
              color: 'var(--color-muted)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              textDecoration: 'underline',
              textUnderlineOffset: 2,
            }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Items */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {items.length === 0 ? (
          <div style={{
            padding: '24px 16px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
            textAlign: 'center',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
              style={{ color: 'var(--color-muted)', opacity: 0.5 }}>
              <path d="M12 8v4l3 3" /><circle cx="12" cy="12" r="9" />
            </svg>
            <p style={{
              fontFamily: 'var(--font-body)', fontSize: 12,
              color: 'var(--color-muted)', margin: 0, lineHeight: 1.5,
            }}>
              No queries yet.
              <br />
              Ask a question above to get started.
            </p>
          </div>
        ) : (
          // newest-first
          [...items].reverse().map((item) => {
            const isSelected = item.id === selectedId;
            return (
              <button
                key={item.id}
                onClick={() => onSelect(item.id)}
                style={{
                  width: '100%',
                  display: 'block',
                  textAlign: 'left',
                  padding: '12px 14px 12px 16px',
                  background: isSelected ? 'var(--color-canvas)' : 'transparent',
                  border: 'none',
                  borderLeft: isSelected ? '3px solid var(--color-ink)' : '3px solid transparent',
                  cursor: 'pointer',
                  borderBottom: '1px solid var(--color-hairline)',
                  transition: 'background 120ms ease',
                }}
              >
                {/* Question truncated to 2 lines */}
                <p style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 13,
                  color: 'var(--color-ink)',
                  margin: '0 0 4px',
                  lineHeight: 1.45,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}>
                  {item.question}
                </p>
                {/* Metadata */}
                <span style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 11,
                  color: 'var(--color-muted)',
                }}>
                  {item.isError
                    ? '⚠ Error'
                    : `${item.row_count} row${item.row_count === 1 ? '' : 's'}`
                  }
                  {' · '}
                  {timeAgo(item.timestamp)}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

// ── Data table ────────────────────────────────────────────────────────────────

function DataTable({
  columns, rows, rowCount,
  itemId, currentPage, totalPages, totalCount, onPageChange,
}: {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  itemId: string;
  currentPage: number;
  totalPages: number;
  totalCount: number;
  onPageChange: (itemId: string, page: number) => void;
}) {
  if (columns.length === 0) {
    return (
      <div style={{
        padding: '32px',
        textAlign: 'center',
        color: 'var(--color-muted)',
        fontFamily: 'var(--font-body)',
        fontSize: 13,
        fontStyle: 'italic',
        border: '1px solid var(--color-hairline)',
        borderRadius: 12,
      }}>
        Query returned no rows.
      </div>
    );
  }

  return (
    <div>
      {/* Table */}
      <div style={{
        overflowX: 'auto',
        borderRadius: 12,
        border: '1px solid var(--color-hairline)',
        boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
      }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontFamily: 'var(--font-body)',
          fontSize: 13,
          whiteSpace: 'nowrap',
        }}>
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col} style={{
                  padding: '10px 16px',
                  textAlign: 'left',
                  fontWeight: 600,
                  color: 'var(--color-ink)',
                  backgroundColor: 'var(--color-canvas-soft)',
                  borderBottom: '1px solid var(--color-hairline)',
                  letterSpacing: '0.01em',
                  fontSize: 12,
                }}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr
                key={ri}
                style={{
                  backgroundColor: ri % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.015)',
                  transition: 'background 80ms',
                }}
              >
                {columns.map((col) => {
                  const val = row[col];
                  const isNum = typeof val === 'number';
                  return (
                    <td key={col} style={{
                      padding: '8px 16px',
                      color: 'var(--color-ink)',
                      textAlign: isNum ? 'right' : 'left',
                      borderBottom: ri < rows.length - 1 ? '1px solid var(--color-hairline)' : 'none',
                      maxWidth: 300,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {val === null || val === undefined
                        ? <span style={{ color: 'var(--color-muted)', fontStyle: 'italic' }}>null</span>
                        : String(val)
                      }
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer: row count + pagination controls */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginTop: 10, flexWrap: 'wrap', gap: 8,
      }}>
        <p style={{
          fontFamily: 'var(--font-body)', fontSize: 11,
          color: 'var(--color-muted)', margin: 0,
        }}>
          {totalCount === 0
            ? 'No rows returned.'
            : `${totalCount.toLocaleString()} row${totalCount === 1 ? '' : 's'} total`
          }
        </p>

        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => onPageChange(itemId, 1)}
              disabled={currentPage <= 1}
              style={{
                padding: '4px 12px',
                borderRadius: 6,
                border: '1px solid var(--color-hairline)',
                background: 'var(--color-surface-card)',
                fontFamily: 'var(--font-body)', fontSize: 12,
                color: currentPage <= 1 ? 'var(--color-muted)' : 'var(--color-ink)',
                cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
              }}
            >
              ⇤ First
            </button>

            <button
              onClick={() => onPageChange(itemId, currentPage - 1)}
              disabled={currentPage <= 1}
              style={{
                padding: '4px 12px',
                borderRadius: 6,
                border: '1px solid var(--color-hairline)',
                background: 'var(--color-surface-card)',
                fontFamily: 'var(--font-body)', fontSize: 12,
                color: currentPage <= 1 ? 'var(--color-muted)' : 'var(--color-ink)',
                cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
              }}
            >
              ← Prev
            </button>

            <span style={{
              fontFamily: 'var(--font-body)', fontSize: 11,
              color: 'var(--color-muted)',
            }}>
              Page {currentPage} of {totalPages}
            </span>

            <button
              onClick={() => onPageChange(itemId, currentPage + 1)}
              disabled={currentPage >= totalPages}
              style={{
                padding: '4px 12px',
                borderRadius: 6,
                border: '1px solid var(--color-hairline)',
                background: 'var(--color-surface-card)',
                fontFamily: 'var(--font-body)', fontSize: 12,
                color: currentPage >= totalPages ? 'var(--color-muted)' : 'var(--color-ink)',
                cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
              }}
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── SQL block ─────────────────────────────────────────────────────────────────

function SqlBlock({ sql }: { sql: string }) {
  const [open, setOpen] = useState(true);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div style={{ marginBottom: 20 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'none', border: 'none', cursor: 'pointer',
          padding: '0 0 8px',
          fontFamily: 'var(--font-body)', fontSize: 12,
          color: 'var(--color-muted)',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
        }}
      >
        <span style={{
          display: 'inline-block',
          transform: open ? 'rotate(90deg)' : 'none',
          transition: 'transform 150ms ease',
          fontSize: 9,
        }}>▶</span>
        Generated SQL
      </button>

      {open && (
        <div style={{
          position: 'relative',
          backgroundColor: '#0f1117',
          borderRadius: 10,
          padding: '14px 16px',
        }}>
          <button
            onClick={handleCopy}
            style={{
              position: 'absolute', top: 10, right: 12,
              padding: '3px 10px',
              borderRadius: 6,
              border: '1px solid rgba(255,255,255,0.15)',
              backgroundColor: copied ? 'rgba(255,255,255,0.12)' : 'transparent',
              color: 'rgba(255,255,255,0.6)',
              fontFamily: 'var(--font-body)', fontSize: 11,
              cursor: 'pointer', transition: 'all 150ms ease',
            }}
          >
            {copied ? '✓ Copied' : 'Copy'}
          </button>
          <pre style={{
            margin: 0, paddingRight: 72,
            fontFamily: '"JetBrains Mono","Fira Code",ui-monospace,monospace',
            fontSize: 12.5, lineHeight: 1.65,
            color: '#e2e8f0',
            whiteSpace: 'pre-wrap', wordBreak: 'break-all',
          }}>
            {sql}
          </pre>
        </div>
      )}
    </div>
  );
}

// ── Main result pane ──────────────────────────────────────────────────────────

function MainPane({
  item,
  isLoading,
  onTryExample,
  onFetchPage,
}: {
  item: QueryHistoryItem | null;
  isLoading: boolean;
  onTryExample: (q: string) => void;
  onFetchPage: (itemId: string, page: number) => void;
}) {
  const paneRef = useRef<HTMLDivElement>(null);

  // Scroll to top when a new result is shown
  useEffect(() => {
    paneRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [item?.id]);

  return (
    <div
      ref={paneRef}
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: '32px 40px 48px',
        backgroundColor: 'var(--color-canvas)',
      }}
    >
      {/* Loading */}
      {isLoading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 0' }}>
          <style>{`
            @keyframes xdot { 0%,60%,100%{opacity:.2;transform:scale(.75)} 30%{opacity:1;transform:scale(1)} }
          `}</style>
          {[0, 1, 2].map((i) => (
            <span key={i} style={{
              width: 8, height: 8, borderRadius: '50%',
              backgroundColor: 'var(--color-muted)', display: 'inline-block',
              animation: `xdot 1.2s ease-in-out ${i * 200}ms infinite`,
            }} />
          ))}
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-muted)' }}>
            Running query…
          </span>
        </div>
      )}

      {/* Empty state with workflow guide */}
      {!isLoading && !item && (
        <div style={{
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          height: '100%', gap: 32, padding: '0 20px',
        }}>

          {/* Workflow steps */}
          <div style={{ textAlign: 'center' }}>
            <p style={{
              fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 300,
              color: 'var(--color-ink)', margin: '0 0 20px',
            }}>
              How it works
            </p>
            <div style={{ display: 'flex', gap: 0, alignItems: 'flex-start' }}>
              {[
                { step: '1', icon: '✏️', label: 'Ask', desc: 'Type a question in plain English' },
                { step: '2', icon: '⚙️', label: 'Query', desc: 'AI writes and runs SQL automatically' },
                { step: '3', icon: '📊', label: 'Explore', desc: 'Browse results as an interactive table' },
              ].map((s, i) => (
                <div key={s.step} style={{ display: 'flex', alignItems: 'flex-start' }}>
                  <div style={{
                    width: 140, textAlign: 'center', padding: '0 12px',
                  }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%',
                      backgroundColor: 'var(--color-canvas-soft)',
                      border: '1px solid var(--color-hairline)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      margin: '0 auto 10px', fontSize: 16,
                    }}>
                      {s.icon}
                    </div>
                    <p style={{
                      fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600,
                      color: 'var(--color-ink)', margin: '0 0 4px',
                    }}>
                      {s.label}
                    </p>
                    <p style={{
                      fontFamily: 'var(--font-body)', fontSize: 11,
                      color: 'var(--color-muted)', margin: 0, lineHeight: 1.5,
                    }}>
                      {s.desc}
                    </p>
                  </div>
                  {i < 2 && (
                    <div style={{
                      marginTop: 18, color: 'var(--color-hairline)',
                      fontFamily: 'var(--font-body)', fontSize: 16,
                    }}>→</div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div style={{ width: '100%', maxWidth: 440, height: 1, backgroundColor: 'var(--color-hairline)' }} />

          {/* Example chips */}
          <div style={{ textAlign: 'center', maxWidth: 480 }}>
            <p style={{
              fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 600,
              letterSpacing: '0.07em', textTransform: 'uppercase',
              color: 'var(--color-muted)', margin: '0 0 12px',
            }}>
              Try an example
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
              {[
                'Show me the first 10 rows',
                'How many rows are in this dataset?',
                'Count records grouped by each category',
                'What is the average of all numeric columns?',
                'Show rows with the highest values',
                'List all unique values in each column',
              ].map((q) => (
                <button
                  key={q}
                  onClick={() => onTryExample(q)}
                  style={{
                    fontFamily: 'var(--font-body)', fontSize: 12,
                    color: 'var(--color-ink)',
                    padding: '6px 14px',
                    borderRadius: 999,
                    border: '1px solid var(--color-hairline)',
                    backgroundColor: 'var(--color-surface-card)',
                    cursor: 'pointer',
                    transition: 'border-color 120ms, background 120ms',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-ink)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-hairline)';
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {!isLoading && item?.isError && (
        <div>
          <h2 style={{
            fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 300,
            color: 'var(--color-ink)', margin: '0 0 20px',
          }}>
            {item.question}
          </h2>
          <div style={{
            backgroundColor: '#fff5f5', border: '1px solid #fecaca',
            borderRadius: 12, padding: '16px 20px',
            fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: 1.6,
            color: 'var(--color-error)',
          }}>
            {item.errorMessage}
          </div>
        </div>
      )}

      {/* Success result */}
      {!isLoading && item && !item.isError && (
        <div>
          {/* Question heading */}
          <h2 style={{
            fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 300,
            color: 'var(--color-ink)', margin: '0 0 6px', lineHeight: 1.3,
          }}>
            {item.question}
          </h2>
          <p style={{
            fontFamily: 'var(--font-body)', fontSize: 11,
            color: 'var(--color-muted)', margin: '0 0 24px',
          }}>
            {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>

          {/* Explanation */}
          {item.explanation && (
            <div style={{
              fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: 1.7,
              color: 'var(--color-ink)', marginBottom: 20,
            }}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {item.explanation}
              </ReactMarkdown>
            </div>
          )}

          {/* SQL */}
          {item.sql && <SqlBlock sql={item.sql} />}

          {/* Table with server-side pagination */}
          <DataTable
            columns={item.columns}
            rows={item.rows}
            rowCount={item.row_count}
            itemId={item.id}
            currentPage={item.current_page}
            totalPages={item.total_pages}
            totalCount={item.total_count}
            onPageChange={onFetchPage}
          />
        </div>
      )}
    </div>
  );
}

// ── Top input bar ─────────────────────────────────────────────────────────────

function InputBar({
  draft,
  setDraft,
  onSend,
  onAbort,
  isLoading,
}: {
  draft: string;
  setDraft: (v: string) => void;
  onSend: () => void;
  onAbort: () => void;
  isLoading: boolean;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const resize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); }
  };

  return (
    <div style={{
      padding: '16px 0',
      borderBottom: '1px solid var(--color-hairline)',
      backgroundColor: 'var(--color-canvas)',
      flexShrink: 0,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 16px',
        borderRadius: 'var(--radius-xl)',
        border: '1.5px solid var(--color-hairline)',
        backgroundColor: 'var(--color-surface-card)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        transition: 'border-color 150ms, box-shadow 150ms',
      }}
        onFocus={(e) => {
          (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--color-ink)';
          (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 12px rgba(0,0,0,0.10)';
        }}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--color-hairline)';
            (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)';
          }
        }}
      >
        {/* Search icon */}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ flexShrink: 0, color: 'var(--color-muted)' }}>
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
        </svg>

        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => { setDraft(e.target.value); resize(); }}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          placeholder="Ask anything about your data…"
          rows={1}
          style={{
            flex: 1, resize: 'none', border: 'none', outline: 'none',
            background: 'transparent',
            fontFamily: 'var(--font-body)', fontSize: 14,
            color: 'var(--color-ink)', lineHeight: 1.5,
            padding: 0, minHeight: 22, maxHeight: 120,
            overflowY: 'auto',
            opacity: isLoading ? 0.5 : 1,
          }}
        />

        {/* Hint */}
        {!isLoading && draft.trim() && (
          <span style={{
            fontFamily: 'var(--font-body)', fontSize: 11,
            color: 'var(--color-muted)', flexShrink: 0,
          }}>
            Enter ↵
          </span>
        )}

        {/* Stop button */}
        {isLoading && (
          <button onClick={onAbort} title="Stop" style={{
            width: 30, height: 30, flexShrink: 0,
            borderRadius: '50%', backgroundColor: 'var(--color-ink)',
            color: 'white', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700,
          }}>■</button>
        )}

        {/* Send button */}
        {!isLoading && (
          <button
            onClick={onSend} disabled={!draft.trim()} title="Run query"
            style={{
              width: 30, height: 30, flexShrink: 0,
              borderRadius: '50%',
              backgroundColor: draft.trim() ? 'var(--color-ink)' : 'var(--color-hairline)',
              color: draft.trim() ? 'white' : 'var(--color-muted)',
              border: 'none',
              cursor: draft.trim() ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background-color 150ms, color 150ms',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

// ── Root component ────────────────────────────────────────────────────────────

interface Props {
  datasetId: string;
  isActive: boolean;
}

export function AskView({ datasetId, isActive }: Props) {
  const { items, phase, submit, fetchPage, abort, clearHistory } = useQueryHistory(datasetId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const isLoading = phase === 'loading';

  // Auto-select the latest result after each query
  useEffect(() => {
    if (items.length > 0) {
      setSelectedId(items[items.length - 1].id);
    }
  }, [items]);

  // Lock page scroll — this pane manages its own internal scroll
  useEffect(() => {
    if (isActive) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isActive]);

  const handleSend = useCallback(() => {
    if (!draft.trim() || isLoading) return;
    submit(draft);
    setDraft('');
  }, [draft, isLoading, submit]);

  const selectedItem = items.find((i) => i.id === selectedId) ?? null;

  return (
    <div style={{
      height: 'calc(100vh - 116px)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Top input bar */}
      <InputBar
        draft={draft}
        setDraft={setDraft}
        onSend={handleSend}
        onAbort={abort}
        isLoading={isLoading}
      />

      {/* Body: sidebar + main */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <Sidebar
          items={items}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onClear={clearHistory}
          isLoading={isLoading}
        />
        <MainPane
          item={isLoading ? null : selectedItem}
          isLoading={isLoading}
          onTryExample={(q) => { setDraft(q); }}
          onFetchPage={fetchPage}
        />
      </div>
    </div>
  );
}
