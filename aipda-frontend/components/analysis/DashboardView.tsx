'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useAnalysis } from '@/hooks/useAnalysis';
import { QualityBadgeRow } from '@/components/analysis/QualityBadgeRow';
import { AnomalyPanel } from '@/components/analysis/AnomalyPanel';
import { ColumnStatsTable } from '@/components/analysis/ColumnStatsTable';
import { ChatView } from '@/components/chat/ChatView';
import { AskView } from '@/components/ask/AskView';

type Tab = 'overview' | 'ask' | 'chat' | 'memory';

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'ask', label: 'Ask' },
  { id: 'chat', label: 'Chat' },
  { id: 'memory', label: 'Memory' },
];

interface Props {
  datasetId: string;
}

function TabStub({ label }: { label: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      minHeight: 320, gap: 12,
    }}>
      <span style={{ fontSize: 32, opacity: 0.2 }}>
        {label === 'Ask' ? '⌨' : label === 'Chat' ? '💬' : '🧠'}
      </span>
      <p style={{
        fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 300,
        color: 'var(--color-ink)', margin: 0,
      }}>
        {label}
      </p>
      <p style={{
        fontFamily: 'var(--font-body)', fontSize: 14,
        color: 'var(--color-muted)', margin: 0,
      }}>
        Coming in the next session.
      </p>
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <h2 style={{
        fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600,
        letterSpacing: '0.8px', textTransform: 'uppercase',
        color: 'var(--color-muted)', margin: 0,
      }}>
        {title}
      </h2>
      {sub && (
        <p style={{
          fontFamily: 'var(--font-body)', fontSize: 13,
          color: 'var(--color-muted)', margin: '3px 0 0',
        }}>
          {sub}
        </p>
      )}
    </div>
  );
}

// ── Main dashboard view ───────────────────────────────────────────────────────

export function DashboardView({ datasetId }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [highlightColumn, setHighlightColumn] = useState<string | null>(null);

  const { data: analysis, isLoading, error } = useAnalysis(datasetId);

  // ── Nav ───────────────────────────────────────────────────────────────────

  const tabBarStyle: React.CSSProperties = {
    position: 'sticky', top: 64, zIndex: 9,
    backgroundColor: 'var(--color-canvas)',
    borderBottom: '1px solid var(--color-hairline)',
    display: 'flex', alignItems: 'center',
    padding: '0 32px', gap: 0,
  };

  // ── Loading state ────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div style={{ padding: 64, textAlign: 'center' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 10,
          color: 'var(--color-muted)', fontFamily: 'var(--font-body)', fontSize: 14,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{ animation: 'spin 1s linear infinite' }}>
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          Analysing dataset…
        </div>
      </div>
    );
  }

  // ── Error state ──────────────────────────────────────────────────────────

  if (error || !analysis) {
    return (
      <div style={{ padding: 64, textAlign: 'center' }}>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 15, color: 'var(--color-error)', marginBottom: 8 }}>
          Failed to load analysis
        </p>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-muted)', marginBottom: 20 }}>
          {(error as Error)?.message ?? 'Dataset not found or server error.'}
        </p>
        <Link href="/" style={{
          fontFamily: 'var(--font-body)', fontSize: 13,
          color: 'var(--color-ink)', textDecoration: 'underline',
        }}>
          ← Upload a new file
        </Link>
      </div>
    );
  }

  // ── Success: render overview ─────────────────────────────────────────────

  return (
    <>
      {/* Tab bar */}
      <div style={tabBarStyle}>
        {TABS.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              id={`tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              style={{
                fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: active ? 500 : 400,
                color: active ? 'var(--color-ink)' : 'var(--color-muted)',
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '16px 20px', position: 'relative',
                borderBottom: active ? '2px solid var(--color-ink)' : '2px solid transparent',
                marginBottom: -1,
                transition: 'color 150ms ease',
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div style={{
        maxWidth: 1200,
        margin: '0 auto',
        padding: (activeTab === 'ask' || activeTab === 'chat')
          ? '0 32px'
          : '40px 32px 80px',
        display: 'flex', flexDirection: 'column', gap: 40,
      }}>

        {activeTab === 'memory' && <TabStub label="Memory" />}

        {/* Ask */}
        <div style={{ display: activeTab === 'ask' ? 'flex' : 'none', flexDirection: 'column' }}>
          <AskView datasetId={datasetId} isActive={activeTab === 'ask'} />
        </div>

        {/* Chat */}
        <div style={{ display: activeTab === 'chat' ? 'flex' : 'none', flexDirection: 'column' }}>
          <ChatView datasetId={datasetId} isActive={activeTab === 'chat'} />
        </div>

        {activeTab === 'overview' && (
          <>
            {/* Dataset title */}
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16 }}>
              <div>
                <h1 style={{
                  fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 300,
                  color: 'var(--color-ink)', margin: '0 0 4px', letterSpacing: '-0.3px',
                }}>
                  {analysis.filename}
                </h1>
                <p style={{
                  fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-muted)', margin: 0,
                }}>
                  Dataset ID: <code style={{ fontSize: 12, color: 'var(--color-muted)' }}>{datasetId}</code>
                </p>
              </div>
              <Link href="/" style={{
                fontFamily: 'var(--font-body)', fontSize: 13,
                color: 'var(--color-muted)', textDecoration: 'none',
                display: 'flex', alignItems: 'center', gap: 4,
                flexShrink: 0,
              }}>
                ← Upload new
              </Link>
            </div>

            {/* Quality Badge Row */}
            <div>
              <SectionHeader title="Dataset Health" />
              <QualityBadgeRow analysis={analysis} />
            </div>

            {/* Anomaly Panel */}
            <div>
              <SectionHeader
                title="Outlier Columns"
                sub="Columns with rows flagged by Z-score or IQR analysis. Click to jump to column."
              />
              <AnomalyPanel
                analysis={analysis}
                onColumnClick={(col) => {
                  setHighlightColumn(col);
                  setTimeout(() => setHighlightColumn(null), 2500);
                }}
              />
            </div>

            {/* Column Stats Table */}
            <div>
              <SectionHeader
                title="Column Explorer"
                sub={`${analysis.total_columns} columns · Click any row to see distribution chart`}
              />
              <ColumnStatsTable
                analysis={analysis}
                highlightColumn={highlightColumn}
              />
            </div>
          </>
        )}

      </div>
    </>
  );
}
