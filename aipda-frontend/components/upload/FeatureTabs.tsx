'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

type TabId = 'analysis' | 'ask' | 'agent';

// ── Mock preview: Instant Analysis ────────────────────────────────────────────
function AnalysisPreview() {
  const COLS = [
    { name: 'revenue_total', type: 'FLOAT',  nulls: '0%',   ok: true },
    { name: 'customer_id',   type: 'INT',    nulls: '0%',   ok: true },
    { name: 'region',        type: 'STRING', nulls: '3.1%', ok: false },
    { name: 'order_date',    type: 'DATE',   nulls: '0%',   ok: true },
    { name: 'churn_flag',    type: 'BOOL',   nulls: '0.8%', ok: false },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 22 }}>📄</span>
        <div>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 600, color: 'var(--color-ink)' }}>
            sales_q4_2024.csv
          </div>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-muted)' }}>
            1,284 rows · 12 columns · 2 issues found
          </div>
        </div>
      </div>

      <div style={{ borderRadius: 8, border: '1px solid var(--color-hairline)', overflow: 'hidden' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr auto auto',
          padding: '7px 14px',
          backgroundColor: 'var(--color-surface-strong)',
          borderBottom: '1px solid var(--color-hairline)',
        }}>
          {['column', 'type', 'nulls'].map(h => (
            <span key={h} style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>{h}</span>
          ))}
        </div>
        {COLS.map((col, i) => (
          <div key={col.name} style={{
            display: 'grid', gridTemplateColumns: '1fr auto auto',
            padding: '9px 14px', gap: 12,
            borderTop: i > 0 ? '1px solid var(--color-hairline-soft)' : 'none',
          }}>
            <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--color-ink)', fontWeight: 500 }}>{col.name}</span>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--color-muted)' }}>{col.type}</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: col.ok ? 'var(--color-success)' : 'var(--color-error)' }}>
              {col.ok ? `✓ ${col.nulls}` : `⚠ ${col.nulls}`}
            </span>
          </div>
        ))}
      </div>

      <div style={{
        padding: '8px 12px', borderRadius: 6,
        backgroundColor: '#fff7ed', border: '1px solid #fed7aa',
        fontSize: 12, color: '#c2410c', fontFamily: 'var(--font-body)',
      }}>
        ⚠ 2 duplicate rows detected in customer_id
      </div>
    </div>
  );
}

// ── Mock preview: Ask in English ──────────────────────────────────────────────
function AskPreview() {
  const ROWS = [
    { region: 'North America', avg: '$48,291' },
    { region: 'Europe',        avg: '$31,847' },
    { region: 'Asia-Pacific',  avg: '$22,103' },
    { region: 'Latin America', avg: '$14,562' },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{
        padding: '10px 16px',
        borderRadius: 'var(--radius-lg)',
        backgroundColor: 'var(--color-surface-card)',
        border: '1px solid var(--color-hairline)',
        fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-body)',
      }}>
        💬 What's the average revenue by region?
      </div>

      <div style={{
        backgroundColor: '#1c1917', borderRadius: 'var(--radius-md)',
        padding: '12px 16px',
        fontFamily: 'monospace', fontSize: 12, color: '#a8a29e', lineHeight: 1.7,
      }}>
        <span style={{ color: '#60a5fa' }}>SELECT</span>{' '}
        <span style={{ color: '#fbbf24' }}>region</span>,{' '}
        <span style={{ color: '#34d399' }}>AVG</span>(revenue_total)<br />
        <span style={{ color: '#60a5fa' }}>FROM</span>{' '}sales_q4_2024<br />
        <span style={{ color: '#60a5fa' }}>GROUP BY</span>{' '}region{' '}
        <span style={{ color: '#60a5fa' }}>ORDER BY</span>{' '}2{' '}
        <span style={{ color: '#60a5fa' }}>DESC</span>
      </div>

      <div style={{ borderRadius: 8, border: '1px solid var(--color-hairline)', overflow: 'hidden' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr auto',
          padding: '7px 14px',
          backgroundColor: 'var(--color-surface-strong)',
          borderBottom: '1px solid var(--color-hairline)',
        }}>
          {['region', 'avg_revenue'].map(h => (
            <span key={h} style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>{h}</span>
          ))}
        </div>
        {ROWS.map((r, i) => (
          <div key={r.region} style={{
            display: 'grid', gridTemplateColumns: '1fr auto',
            padding: '8px 14px',
            borderTop: i > 0 ? '1px solid var(--color-hairline-soft)' : 'none',
            fontFamily: 'var(--font-body)', fontSize: 13,
          }}>
            <span style={{ color: 'var(--color-body)' }}>{r.region}</span>
            <span style={{ color: 'var(--color-ink)', fontWeight: 600, fontFamily: 'monospace', fontSize: 12 }}>{r.avg}</span>
          </div>
        ))}
        <div style={{
          padding: '6px 14px', borderTop: '1px solid var(--color-hairline)',
          fontSize: 11, color: 'var(--color-muted)', fontFamily: 'var(--font-body)',
        }}>
          4 rows · 18ms
        </div>
      </div>
    </div>
  );
}

// ── Mock preview: AI Agent ────────────────────────────────────────────────────
function AgentPreview() {
  const MESSAGES: { role: 'user' | 'agent'; text: string }[] = [
    { role: 'user',  text: 'Which region had the highest churn in Q4?' },
    { role: 'agent', text: 'Europe had the highest churn at 8.2%, up from 5.1% in Q3. The spike coincides with the pricing change on Oct 14th — revenue dropped 18% in the two weeks following the update.' },
    { role: 'user',  text: 'Which customers were most affected?' },
    { role: 'agent', text: 'The top 12 affected accounts are SMBs in the €5k–€20k ARR range. Want me to filter by churn date or by ARR?' },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {MESSAGES.map((msg, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
          <div style={{
            maxWidth: '82%',
            padding: '10px 14px',
            borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
            backgroundColor: msg.role === 'user' ? 'var(--color-ink)' : 'var(--color-surface-card)',
            border: msg.role === 'agent' ? '1px solid var(--color-hairline)' : 'none',
            color: msg.role === 'user' ? '#fff' : 'var(--color-body)',
            fontFamily: 'var(--font-body)', fontSize: 13, lineHeight: 1.55,
          }}>
            {msg.text}
          </div>
        </div>
      ))}
      {/* Typing dots */}
      <div style={{ display: 'flex', gap: 4, alignItems: 'center', paddingLeft: 4, paddingTop: 4 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: 6, height: 6, borderRadius: '50%',
            backgroundColor: 'var(--color-muted-soft)',
            animation: `bounce 1.2s ${i * 0.2}s ease-in-out infinite`,
          }} />
        ))}
      </div>
    </div>
  );
}

// ── Tab definitions ───────────────────────────────────────────────────────────

const TABS: { id: TabId; label: string; orb: string; desc: string }[] = [
  {
    id: 'analysis',
    label: 'Instant Analysis',
    orb: 'var(--color-orb-mint)',
    desc: 'Column types, null rates, duplicates, and statistical outliers — detected the moment your file lands.',
  },
  {
    id: 'ask',
    label: 'Ask in English',
    orb: 'var(--color-orb-sky)',
    desc: 'Turn plain-language questions into SQL queries and get results instantly. No SQL knowledge needed.',
  },
  {
    id: 'agent',
    label: 'AI Agent',
    orb: 'var(--color-orb-lavender)',
    desc: 'A stateful agent that recalls your past analyses, answers follow-ups, and builds context across sessions.',
  },
];

const PREVIEW_MAP: Record<TabId, React.ReactElement> = {
  analysis: <AnalysisPreview />,
  ask:      <AskPreview />,
  agent:    <AgentPreview />,
};

// ── Main component ────────────────────────────────────────────────────────────

export function FeatureTabs() {
  const [active, setActive] = useState<TabId>('analysis');
  const { user } = useAuth();
  const router = useRouter();

  const activeTab = TABS.find(t => t.id === active)!;

  const handleCTA = () => {
    if (!user) router.push('/login?returnUrl=/datasets');
    else router.push('/datasets');
  };

  return (
    <div>
      {/* Section label */}
      <p style={{
        fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 600,
        letterSpacing: '1px', textTransform: 'uppercase',
        color: 'var(--color-muted)', margin: '0 0 14px',
      }}>
        What you get
      </p>

      {/* Tab switcher */}
      <div className="tab-bar" style={{ marginBottom: 24 }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            className="tab-pill"
            data-active={String(active === tab.id)}
            onClick={() => setActive(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Preview card — split layout */}
      <div style={{
        backgroundColor: 'var(--color-surface-card)',
        border: '1px solid var(--color-hairline)',
        borderRadius: 'var(--radius-xxl)',
        boxShadow: 'var(--shadow-card)',
        overflow: 'hidden',
        display: 'grid',
        gridTemplateColumns: '1fr 1.3fr',
        minHeight: 380,
      }}>
        {/* Left pane — text + CTA */}
        <div style={{
          padding: 40,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          borderRight: '1px solid var(--color-hairline)',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Orb */}
          <div className="orb" style={{
            width: 220, height: 220,
            background: `radial-gradient(circle, ${activeTab.orb} 0%, transparent 70%)`,
            bottom: -70, left: -70, opacity: 0.55,
          }} />

          <div style={{ position: 'relative' }}>
            <p style={{
              fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 600,
              color: 'var(--color-muted)', letterSpacing: '1px',
              textTransform: 'uppercase', margin: '0 0 16px',
            }}>
              {activeTab.label}
            </p>
            <p style={{
              fontFamily: 'var(--font-body)', fontSize: 15,
              color: 'var(--color-body)', lineHeight: 1.65,
              margin: 0,
            }}>
              {activeTab.desc}
            </p>
          </div>

          <button
            onClick={handleCTA}
            className="btn-primary"
            style={{ width: 'fit-content', marginTop: 32, position: 'relative' }}
          >
            Open dashboard →
          </button>
        </div>

        {/* Right pane — mock preview */}
        <div
          key={active}
          className="fade-in-up"
          style={{
            padding: 32,
            backgroundColor: 'var(--color-canvas-soft)',
            overflowY: 'auto',
          }}
        >
          {PREVIEW_MAP[active]}
        </div>
      </div>
    </div>
  );
}
