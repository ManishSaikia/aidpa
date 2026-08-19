'use client';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts';
import type { ColumnStats } from '@/types/api';

interface Props {
  columnName: string;
  column: ColumnStats;
}

// ── Numeric: approximate distribution using mean±std buckets ─────────────────

function numericBuckets(col: ColumnStats): { label: string; value: number; isOutlier: boolean }[] {
  const { min = 0, max = 0, mean = 0, std = 1 } = col;
  if (min === max) return [{ label: String(min), value: 1, isOutlier: false }];

  const NUM_BUCKETS = 10;
  const step = (max - min) / NUM_BUCKETS;

  // Generate approximate gaussian distribution weights
  const buckets = Array.from({ length: NUM_BUCKETS }, (_, i) => {
    const lo = min + i * step;
    const mid = lo + step / 2;
    // Gaussian approximation: higher near mean, lower at extremes
    const z = std > 0 ? (mid - mean) / std : 0;
    const weight = Math.exp(-0.5 * z * z);
    const isOutlier = Math.abs(z) > 3;
    return {
      label: mid >= 1_000_000
        ? `${(mid / 1_000_000).toFixed(1)}M`
        : mid >= 1_000
          ? `${(mid / 1_000).toFixed(0)}K`
          : mid.toFixed(1),
      value: Math.max(1, Math.round(weight * 100)),
      isOutlier,
    };
  });
  return buckets;
}

// ── Categorical: top_values bar chart ────────────────────────────────────────

function categoricalData(col: ColumnStats) {
  return (col.top_values ?? []).slice(0, 8).map((tv) => ({
    label: String(tv.value).length > 12
      ? String(tv.value).slice(0, 12) + '…'
      : String(tv.value),
    fullLabel: String(tv.value),
    value: tv.count,
  }));
}

// ── Custom tooltip ────────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      backgroundColor: 'var(--color-ink)',
      color: 'white',
      padding: '6px 10px',
      borderRadius: 'var(--radius-sm)',
      fontFamily: 'var(--font-body)',
      fontSize: 12,
    }}>
      <p style={{ margin: 0 }}>{label}</p>
      <p style={{ margin: '2px 0 0', fontWeight: 600 }}>{payload[0].value.toLocaleString()}</p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ColumnChart({ columnName, column }: Props) {
  const isNumeric = column.inferred_type === 'numeric';

  if (isNumeric) {
    const numData = numericBuckets(column);

    return (
      <div style={{ padding: '16px 0' }}>
        <p style={{
          fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600,
          letterSpacing: '0.6px', textTransform: 'uppercase',
          color: 'var(--color-muted)', marginBottom: 12,
        }}>
          Approximate Distribution
        </p>

        {/* Numeric summary stats */}
        <div style={{ display: 'flex', gap: 24, marginBottom: 12 }}>
          {([
            { k: 'Min', v: column.min },
            { k: 'Mean', v: column.mean },
            { k: 'Max', v: column.max },
            { k: 'Std', v: column.std },
          ] as const).map(({ k, v }) => (
            <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{k}</span>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 500, color: 'var(--color-ink)' }}>
                {v !== undefined && v !== null
                  ? Math.abs(v) >= 1_000_000 ? `${(v / 1_000_000).toFixed(2)}M`
                    : Math.abs(v) >= 1_000 ? `${(v / 1_000).toFixed(1)}K`
                      : v.toFixed(2)
                  : '—'}
              </span>
            </div>
          ))}
        </div>

        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={numData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <XAxis
              dataKey="label"
              tick={{ fontFamily: 'var(--font-body)', fontSize: 11, fill: '#a8a29e' }}
              axisLine={false} tickLine={false}
            />
            <YAxis hide />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
            <Bar dataKey="value" radius={[3, 3, 0, 0]}>
              {numData.map((entry, i) => (
                <Cell
                  key={i}
                  fill={entry.isOutlier ? '#f87171' : 'var(--color-ink)'}
                  opacity={entry.isOutlier ? 0.7 : 0.15 + (entry.value / 100) * 0.7}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // Categorical
  const catData = categoricalData(column);

  if (catData.length === 0) {
    return (
      <div style={{ padding: 16, color: 'var(--color-muted)', fontFamily: 'var(--font-body)', fontSize: 13 }}>
        No top values available.
      </div>
    );
  }

  return (
    <div style={{ padding: '16px 0' }}>
      <p style={{
        fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600,
        letterSpacing: '0.6px', textTransform: 'uppercase',
        color: 'var(--color-muted)', marginBottom: 12,
      }}>
        Top Values by Count
      </p>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={catData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
          <XAxis
            dataKey="label"
            tick={{ fontFamily: 'var(--font-body)', fontSize: 11, fill: '#a8a29e' }}
            axisLine={false} tickLine={false}
          />
          <YAxis hide />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
          <Bar dataKey="value" radius={[3, 3, 0, 0]}>
            {catData.map((_, i) => (
              <Cell key={i} fill="var(--color-ink)" opacity={0.1 + (i === 0 ? 0.7 : Math.max(0.05, 0.5 - i * 0.07))} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
