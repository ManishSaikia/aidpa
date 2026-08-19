'use client';
import type { AnalysisResult } from '@/types/api';

interface Props {
  analysis: AnalysisResult;
  onColumnClick?: (columnName: string) => void;
}

export function AnomalyPanel({ analysis, onColumnClick }: Props) {
  const flagged = Object.entries(analysis.columns)
    .filter(([, col]) =>
      col.inferred_type === 'numeric' &&
      ((col.zscore_outlier_count ?? 0) > 0 || (col.iqr_outlier_count ?? 0) > 0)
    )
    .map(([name, col]) => ({
      name,
      zscore: col.zscore_outlier_count ?? 0,
      zscorePct: col.zscore_outlier_pct ?? 0,
      iqr: col.iqr_outlier_count ?? 0,
      iqrPct: col.iqr_outlier_pct ?? 0,
    }))
    .sort((a, b) => b.zscore - a.zscore);

  if (flagged.length === 0) {
    return (
      <div style={{
        padding: '16px 20px',
        borderRadius: 'var(--radius-xl)',
        border: '1px solid var(--color-hairline)',
        backgroundColor: '#f0fdf4',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}>
        <span style={{ fontSize: 16 }}>✓</span>
        <span style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: '#15803d' }}>
          No outliers detected in any numeric column.
        </span>
      </div>
    );
  }

  return (
    <div style={{
      borderRadius: 'var(--radius-xl)',
      border: '1px solid var(--color-hairline)',
      backgroundColor: 'var(--color-surface-card)',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '14px 20px',
        borderBottom: '1px solid var(--color-hairline)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{
          fontFamily: 'var(--font-body)',
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--color-ink)',
        }}>
          Outlier Columns
        </span>
        <span style={{
          fontFamily: 'var(--font-body)',
          fontSize: 12,
          color: 'var(--color-muted)',
          backgroundColor: 'var(--color-surface-strong)',
          padding: '2px 8px',
          borderRadius: 'var(--radius-pill)',
        }}>
          {flagged.length} {flagged.length === 1 ? 'column' : 'columns'}
        </span>
      </div>

      {flagged.map((col, i) => {
        const severity = col.zscorePct > 5 ? 'error' : col.zscorePct > 1 ? 'warning' : 'info';
        const colors = {
          error: { bar: 'var(--color-error)', bg: '#fff5f5' },
          warning: { bar: '#f59e0b', bg: '#fffbeb' },
          info: { bar: 'var(--color-muted)', bg: 'var(--color-canvas-soft)' },
        };
        const c = colors[severity];

        return (
          <div
            key={col.name}
            style={{
              padding: '12px 20px',
              borderBottom: i < flagged.length - 1 ? '1px solid var(--color-hairline-soft)' : 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              cursor: onColumnClick ? 'pointer' : 'default',
              backgroundColor: 'transparent',
              transition: 'background-color 150ms ease',
            }}
            onClick={() => onColumnClick?.(col.name)}
            onMouseEnter={(e) => {
              if (onColumnClick) (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-canvas-soft)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
            }}
          >
            {/* Left: severity indicator bar */}
            <div style={{ width: 3, height: 32, borderRadius: 2, backgroundColor: c.bar, flexShrink: 0 }} />

            {/* Column name */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 500,
                color: 'var(--color-ink)', margin: 0,
                overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
              }}>
                {col.name}
              </p>
              <p style={{
                fontFamily: 'var(--font-body)', fontSize: 12,
                color: 'var(--color-muted)', margin: '2px 0 0',
              }}>
                {col.zscore > 0 && `Z-score: ${col.zscore.toLocaleString()} rows (${col.zscorePct.toFixed(1)}%)`}
                {col.zscore > 0 && col.iqr > 0 && ' · '}
                {col.iqr > 0 && `IQR: ${col.iqr.toLocaleString()} rows (${col.iqrPct.toFixed(1)}%)`}
              </p>
            </div>

            {/* Severity badge */}
            <span style={{
              fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 600,
              letterSpacing: '0.5px', textTransform: 'uppercase',
              color: c.bar, padding: '3px 8px',
              backgroundColor: c.bg, borderRadius: 'var(--radius-pill)',
              flexShrink: 0,
            }}>
              {severity === 'error' ? 'High' : severity === 'warning' ? 'Medium' : 'Low'}
            </span>

            {onColumnClick && (
              <span style={{ color: 'var(--color-muted-soft)', fontSize: 12 }}>↗</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
