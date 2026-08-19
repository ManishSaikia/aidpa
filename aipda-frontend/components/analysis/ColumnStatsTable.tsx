'use client';
import React, { useState, useEffect, useRef } from 'react';
import type { AnalysisResult, ColumnStats } from '@/types/api';
import { ColumnChart } from './ColumnChart';

interface Props {
  analysis: AnalysisResult;
  highlightColumn?: string | null;
}

type SortKey = 'name' | 'type' | 'null_pct' | 'outliers';
type SortDir = 'asc' | 'desc';

function fmt(n: number | undefined | null, decimals = 1): string {
  if (n === undefined || n === null) return '—';
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(decimals)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(decimals)}K`;
  return n.toFixed(decimals);
}

function TypeBadge({ type }: { type: string }) {
  const isNum = type === 'numeric';
  return (
    <span style={{
      fontFamily: 'var(--font-body)', fontSize: 10, fontWeight: 600,
      letterSpacing: '0.6px', textTransform: 'uppercase',
      padding: '2px 7px', borderRadius: 'var(--radius-pill)',
      backgroundColor: isNum ? '#eff6ff' : '#fdf4ff',
      color: isNum ? '#1d4ed8' : '#7e22ce',
    }}>
      {isNum ? 'NUM' : 'CAT'}
    </span>
  );
}

function NullBar({ pct, flagged }: { pct: number; flagged: boolean }) {
  const color = flagged ? 'var(--color-error)' : pct > 5 ? '#f59e0b' : 'var(--color-success)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{
        width: 48, height: 4, borderRadius: 2,
        backgroundColor: 'var(--color-hairline)', overflow: 'hidden', flexShrink: 0,
      }}>
        <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', backgroundColor: color, borderRadius: 2 }} />
      </div>
      <span style={{
        fontFamily: 'var(--font-body)', fontSize: 13,
        color: flagged ? 'var(--color-error)' : 'var(--color-body)',
        fontWeight: flagged ? 500 : 400,
      }}>
        {pct.toFixed(1)}%
      </span>
    </div>
  );
}

export function ColumnStatsTable({ analysis, highlightColumn }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'numeric' | 'categorical' | 'flagged'>('all');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});

  // Scroll to highlighted column when AnomalyPanel clicks
  useEffect(() => {
    if (highlightColumn && rowRefs.current[highlightColumn]) {
      rowRefs.current[highlightColumn]!.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setExpanded(highlightColumn);
    }
  }, [highlightColumn]);

  const cols = Object.entries(analysis.columns) as [string, ColumnStats][];

  const filtered = cols.filter(([name, col]) => {
    if (filter === 'numeric' && col.inferred_type !== 'numeric') return false;
    if (filter === 'categorical' && col.inferred_type !== 'categorical') return false;
    if (filter === 'flagged' && !col.flagged_quality) return false;
    if (search && !name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const sorted = [...filtered].sort(([nameA, colA], [nameB, colB]) => {
    let a: number | string, b: number | string;
    switch (sortKey) {
      case 'name': a = nameA; b = nameB; break;
      case 'type': a = colA.inferred_type; b = colB.inferred_type; break;
      case 'null_pct': a = colA.null_pct; b = colB.null_pct; break;
      case 'outliers': a = (colA.zscore_outlier_count ?? 0); b = (colB.zscore_outlier_count ?? 0); break;
    }
    const cmp = a < b ? -1 : a > b ? 1 : 0;
    return sortDir === 'asc' ? cmp : -cmp;
  });

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }

  const SortArrow = ({ k }: { k: SortKey }) =>
    sortKey === k ? <span style={{ marginLeft: 4, opacity: 0.6 }}>{sortDir === 'asc' ? '↑' : '↓'}</span> : null;

  const thStyle: React.CSSProperties = {
    fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 600,
    letterSpacing: '0.7px', textTransform: 'uppercase',
    color: 'var(--color-muted)', padding: '10px 16px',
    textAlign: 'left', borderBottom: '1px solid var(--color-hairline)',
    whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none',
    backgroundColor: 'var(--color-canvas-soft)',
  };

  return (
    <div style={{
      borderRadius: 'var(--radius-xl)',
      border: '1px solid var(--color-hairline)',
      overflow: 'hidden',
      backgroundColor: 'var(--color-surface-card)',
    }}>
      {/* Toolbar */}
      <div style={{
        padding: '12px 16px', display: 'flex', gap: 10,
        borderBottom: '1px solid var(--color-hairline)',
        flexWrap: 'wrap', alignItems: 'center',
      }}>
        {/* Filter tabs */}
        {(['all', 'numeric', 'categorical', 'flagged'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 500,
              padding: '4px 12px', borderRadius: 'var(--radius-pill)',
              border: '1px solid',
              borderColor: filter === f ? 'var(--color-ink)' : 'var(--color-hairline)',
              backgroundColor: filter === f ? 'var(--color-ink)' : 'transparent',
              color: filter === f ? 'white' : 'var(--color-muted)',
              cursor: 'pointer',
            }}
          >
            {f === 'all' ? `All (${cols.length})` :
              f === 'numeric' ? `Numeric (${cols.filter(([, c]) => c.inferred_type === 'numeric').length})` :
                f === 'categorical' ? `Categorical (${cols.filter(([, c]) => c.inferred_type === 'categorical').length})` :
                  `Flagged (${cols.filter(([, c]) => c.flagged_quality).length})`}
          </button>
        ))}

        {/* Search */}
        <input
          className="input"
          placeholder="Search columns…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ height: 32, fontSize: 13, padding: '4px 12px', marginLeft: 'auto', width: 180 }}
        />
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thStyle} onClick={() => toggleSort('name')}>Column <SortArrow k="name" /></th>
              <th style={thStyle} onClick={() => toggleSort('type')}>Type <SortArrow k="type" /></th>
              <th style={thStyle} onClick={() => toggleSort('null_pct')}>Null % <SortArrow k="null_pct" /></th>
              <th style={thStyle}>Mean</th>
              <th style={thStyle}>Min</th>
              <th style={thStyle}>Max</th>
              <th style={thStyle} onClick={() => toggleSort('outliers')}>Outliers <SortArrow k="outliers" /></th>
              <th style={thStyle}>Top Values / Cardinality</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(([name, col]) => {
              const isExpanded = expanded === name;
              const isHighlighted = highlightColumn === name;
              const rowBg = col.flagged_quality ? '#fffbeb' : isHighlighted ? '#f0f9ff' : 'transparent';

              return (
                <React.Fragment key={name}>
                  <tr
                    ref={(el) => { rowRefs.current[name] = el; }}
                    onClick={() => setExpanded(isExpanded ? null : name)}
                    style={{
                      backgroundColor: rowBg,
                      cursor: 'pointer',
                      borderTop: '1px solid var(--color-hairline-soft)',
                      transition: 'background-color 100ms ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!col.flagged_quality && !isHighlighted)
                        (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-canvas-soft)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.backgroundColor = rowBg;
                    }}
                  >
                    <td style={{ padding: '10px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 500,
                          color: 'var(--color-ink)', overflow: 'hidden', textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap', maxWidth: 180,
                        }}>
                          {name}
                        </span>
                        {col.flagged_quality && (
                          <span style={{ fontSize: 10, color: '#f59e0b' }} title="High null rate">⚠</span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <TypeBadge type={col.inferred_type} />
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <NullBar pct={col.null_pct} flagged={col.flagged_quality} />
                    </td>
                    <td style={{ padding: '10px 16px', fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-body)' }}>
                      {fmt(col.mean)}
                    </td>
                    <td style={{ padding: '10px 16px', fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-body)' }}>
                      {fmt(col.min)}
                    </td>
                    <td style={{ padding: '10px 16px', fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-body)' }}>
                      {fmt(col.max)}
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      {col.zscore_outlier_count !== undefined && col.zscore_outlier_count !== null ? (
                        <span style={{
                          fontFamily: 'var(--font-body)', fontSize: 13,
                          color: col.zscore_outlier_count > 0 ? 'var(--color-error)' : 'var(--color-success)',
                          fontWeight: col.zscore_outlier_count > 0 ? 500 : 400,
                        }}>
                          {col.zscore_outlier_count > 0 ? `${col.zscore_outlier_count.toLocaleString()} (${col.zscore_outlier_pct?.toFixed(1)}%)` : '0'}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--color-muted-soft)', fontSize: 13 }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '10px 16px', fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-body)' }}>
                      {col.inferred_type === 'categorical'
                        ? col.top_values?.slice(0, 2).map(tv => String(tv.value)).join(', ') + (col.cardinality ? ` (+${col.cardinality - 2} more)` : '')
                        : '—'}
                    </td>
                  </tr>

                  {/* Expanded chart row */}
                  {isExpanded && (
                    <tr style={{ backgroundColor: 'var(--color-canvas-soft)' }}>
                      <td colSpan={8} style={{ padding: '0 16px 8px' }}>
                        <ColumnChart columnName={name} column={col} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}

            {sorted.length === 0 && (
              <tr>
                <td colSpan={8} style={{
                  padding: 32, textAlign: 'center',
                  fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--color-muted)',
                }}>
                  No columns match your filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer count */}
      <div style={{
        padding: '8px 16px', borderTop: '1px solid var(--color-hairline)',
        fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-muted)',
        backgroundColor: 'var(--color-canvas-soft)',
      }}>
        Showing {sorted.length} of {cols.length} columns
        {search && ` matching "${search}"`}
        · Click any row to view chart
      </div>
    </div>
  );
}
