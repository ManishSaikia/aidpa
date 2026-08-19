'use client';
import type { AnalysisResult } from '@/types/api';

interface Props {
  analysis: AnalysisResult;
}

interface BadgeCardProps {
  label: string;
  value: string | number;
  sub?: string;
  color: 'ink' | 'success' | 'warning' | 'error';
}

function BadgeCard({ label, value, sub, color }: BadgeCardProps) {
  const colors = {
    ink: { bg: 'var(--color-surface-card)', dot: 'var(--color-muted-soft)', text: 'var(--color-ink)' },
    success: { bg: '#f0fdf4', dot: 'var(--color-success)', text: '#15803d' },
    warning: { bg: '#fffbeb', dot: '#d97706', text: '#92400e' },
    error: { bg: '#fff5f5', dot: 'var(--color-error)', text: '#b91c1c' },
  };
  const c = colors[color];

  return (
    <div style={{
      backgroundColor: c.bg,
      borderRadius: 'var(--radius-xl)',
      border: '1px solid var(--color-hairline)',
      padding: '20px 24px',
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      flex: 1,
      minWidth: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          width: 8, height: 8, borderRadius: '50%',
          backgroundColor: c.dot, flexShrink: 0,
        }} />
        <span style={{
          fontFamily: 'var(--font-body)',
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: '0.8px',
          textTransform: 'uppercase',
          color: 'var(--color-muted)',
        }}>
          {label}
        </span>
      </div>
      <span style={{
        fontFamily: 'var(--font-display)',
        fontSize: 32,
        fontWeight: 300,
        lineHeight: 1.1,
        color: c.text,
        letterSpacing: '-0.5px',
      }}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </span>
      {sub && (
        <span style={{
          fontFamily: 'var(--font-body)',
          fontSize: 13,
          color: 'var(--color-muted)',
        }}>
          {sub}
        </span>
      )}
    </div>
  );
}

export function QualityBadgeRow({ analysis }: Props) {
  const {
    total_rows, total_columns, duplicate_rows,
    high_null_columns, null_threshold_pct,
  } = analysis;

  const dupPct = total_rows > 0 ? (duplicate_rows / total_rows) * 100 : 0;
  const dupColor = duplicate_rows === 0 ? 'success' : dupPct < 5 ? 'warning' : 'error';

  const nullColor =
    high_null_columns.length === 0 ? 'success' :
      high_null_columns.length <= 2 ? 'warning' : 'error';

  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
      <BadgeCard
        label="Total Rows"
        value={total_rows}
        sub={`${total_columns} columns total`}
        color="ink"
      />
      <BadgeCard
        label="Duplicate Rows"
        value={duplicate_rows}
        sub={duplicate_rows === 0 ? 'No duplicates found' : `${dupPct.toFixed(1)}% of dataset`}
        color={dupColor}
      />
      <BadgeCard
        label="High-Null Columns"
        value={high_null_columns.length}
        sub={`Threshold: ${null_threshold_pct}% null`}
        color={nullColor}
      />
      <BadgeCard
        label="Column Types"
        value={`${analysis.numeric_columns}N / ${analysis.categorical_columns}C`}
        sub="Numeric / Categorical"
        color="ink"
      />
    </div>
  );
}
