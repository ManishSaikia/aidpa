'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useAccount } from '@/hooks/useAccount';
import { useAdminUsers, type AdminUser } from '@/hooks/useAdminUsers';
import { useAdminCosts, type AdminCosts } from '@/hooks/useAdminCosts';
import { api } from '@/lib/api';

// ── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 4000);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 1000,
      backgroundColor: 'var(--color-ink)', color: '#fff',
      fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 500,
      padding: '12px 20px', borderRadius: 'var(--radius-lg)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
      animation: 'fadeInUp 200ms ease both',
      maxWidth: 360,
    }}>
      {message}
    </div>
  );
}

// ── Storage gauge ─────────────────────────────────────────────────────────────

function StorageBar({ percent, usedMb, quotaMb }: { percent: number; usedMb: number; quotaMb: number }) {
  const pct = Math.min(percent, 100);
  const color = pct > 90 ? 'var(--color-error)' : pct > 70 ? '#f59e0b' : 'var(--color-ink)';
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, color: 'var(--color-ink)' }}>
          {usedMb.toFixed(1)} MB
        </span>
        <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-muted)' }}>
          of {quotaMb.toFixed(0)} MB
        </span>
      </div>
      <div style={{ height: 6, borderRadius: 99, backgroundColor: 'var(--color-hairline)', overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct}%`, borderRadius: 99,
          backgroundColor: color,
          transition: 'width 600ms ease',
        }} />
      </div>
      <div style={{ marginTop: 6, fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--color-muted)' }}>
        {pct.toFixed(1)}% used
      </div>
    </div>
  );
}

// ── Mini storage bar (for admin table) ───────────────────────────────────────

function MiniBar({ percent }: { percent: number }) {
  const pct = Math.min(percent, 100);
  const color = pct > 90 ? 'var(--color-error)' : pct > 70 ? '#f59e0b' : 'var(--color-ink)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 64, height: 4, borderRadius: 99, backgroundColor: 'var(--color-hairline)', overflow: 'hidden', flexShrink: 0 }}>
        <div style={{ height: '100%', width: `${pct}%`, borderRadius: 99, backgroundColor: color }} />
      </div>
      <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-muted)', whiteSpace: 'nowrap' }}>
        {pct.toFixed(0)}%
      </span>
    </div>
  );
}

// ── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ icon, value, label }: { icon: string; value: string | number; label: string }) {
  return (
    <div style={{
      backgroundColor: 'var(--color-surface-card)',
      border: '1px solid var(--color-hairline)',
      borderRadius: 'var(--radius-xl)',
      padding: '20px 24px',
      boxShadow: 'var(--shadow-card)',
    }}>
      <div style={{ fontSize: 22, marginBottom: 10 }}>{icon}</div>
      <div style={{ fontFamily: 'var(--font-body)', fontSize: 22, fontWeight: 700, color: 'var(--color-ink)', lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-muted)', marginTop: 4 }}>
        {label}
      </div>
    </div>
  );
}

// ── Delete confirmation modal ─────────────────────────────────────────────────

function DeleteSelfModal({
  userEmail,
  onCancel,
  onConfirm,
  isDeleting,
}: {
  userEmail: string;
  onCancel: () => void;
  onConfirm: () => void;
  isDeleting: boolean;
}) {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => inputRef.current?.focus(), []);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500,
      backgroundColor: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{
        backgroundColor: 'var(--color-surface-card)',
        borderRadius: 'var(--radius-xxl)',
        border: '1px solid var(--color-hairline)',
        padding: '36px 40px',
        maxWidth: 440, width: '100%',
        boxShadow: '0 24px 64px rgba(0,0,0,0.12)',
      }}>
        <div style={{ fontSize: 28, marginBottom: 12 }}>⚠️</div>
        <h2 style={{
          fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 300,
          color: 'var(--color-ink)', margin: '0 0 12px', letterSpacing: '-0.3px',
        }}>
          Delete your account
        </h2>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--color-body)', lineHeight: 1.6, margin: '0 0 24px' }}>
          This will permanently delete all your datasets, sessions, queries, and memory.
          <strong> This cannot be undone.</strong>
        </p>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-muted)', margin: '0 0 8px' }}>
          Type <strong>{userEmail}</strong> to confirm:
        </p>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={userEmail}
          className="input"
          style={{ marginBottom: 20 }}
        />
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onCancel}
            className="btn-outline"
            style={{ flex: 1 }}
            disabled={isDeleting}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={input !== userEmail || isDeleting}
            style={{
              flex: 1, padding: '10px 20px', borderRadius: 'var(--radius-pill)',
              border: 'none', cursor: input !== userEmail || isDeleting ? 'not-allowed' : 'pointer',
              backgroundColor: input === userEmail ? 'var(--color-error)' : 'var(--color-hairline)',
              color: input === userEmail ? '#fff' : 'var(--color-muted-soft)',
              fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 500,
              transition: 'all 150ms ease',
            }}
          >
            {isDeleting ? 'Deleting…' : 'Delete account'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Admin users table ─────────────────────────────────────────────────────────

function AdminSection({ currentUserId, onToast }: { currentUserId: string; onToast: (msg: string) => void }) {
  const { users, isLoading, error, deletingId, deleteUser } = useAdminUsers(true);
  return (
    <>
      <div style={{ marginBottom: 24 }}>
        <AdminUsersTable
          currentUserId={currentUserId}
          onDelete={onToast}
          users={users}
          isLoading={isLoading}
          error={error}
          deletingId={deletingId}
          deleteUser={deleteUser}
        />
      </div>
      <div style={{ marginBottom: 40 }}>
        <CostOverview adminUsers={users} />
      </div>
    </>
  );
}
function AdminUsersTable({
  currentUserId,
  onDelete,
  users,
  isLoading,
  error,
  deletingId,
  deleteUser,
}: {
  currentUserId: string;
  onDelete: (msg: string) => void;
  users: AdminUser[];
  isLoading: boolean;
  error: Error | null;
  deletingId: string | null;
  deleteUser: (userId: string) => Promise<void>;
}) {
  const [search, setSearch] = useState('');
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const filtered = users.filter((u) =>
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.display_name.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async (u: AdminUser) => {
    try {
      await deleteUser(u.user_id);
      setConfirmId(null);
      onDelete(`${u.email || 'User'} has been permanently deleted.`);
    } catch {
      // error is surfaced by hook
    }
  };

  const fmtDate = (s: string) => {
    try { return new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }
    catch { return '—'; }
  };

  return (
    <div style={{
      backgroundColor: 'var(--color-surface-card)',
      border: '1px solid var(--color-hairline)',
      borderRadius: 'var(--radius-xl)',
      boxShadow: 'var(--shadow-card)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '20px 24px 16px',
        borderBottom: '1px solid var(--color-hairline)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap',
      }}>
        <div>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--color-muted)', margin: '0 0 4px' }}>
            Admin Panel
          </p>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 300, color: 'var(--color-ink)', margin: 0 }}>
            All Users — {users.length}
          </h3>
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by email or name…"
          className="input"
          style={{ width: 240, height: 36, fontSize: 13, padding: '8px 14px' }}
        />
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: '12px 24px', backgroundColor: 'var(--color-canvas-soft)', fontSize: 13, color: 'var(--color-muted)', fontFamily: 'var(--font-body)', borderTop: '1px solid var(--color-hairline)' }}>
          Cost data unavailable — run migration <code style={{ fontFamily: 'monospace', fontSize: 12 }}>011_api_cost_log.sql</code> in Supabase to enable tracking.
        </div>
      )}

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--color-canvas-soft)' }}>
              {['Email / Name', 'Joined', 'Storage', 'Datasets', ''].map((h) => (
                <th key={h} style={{
                  fontFamily: 'var(--font-body)', fontSize: 10, fontWeight: 600,
                  letterSpacing: '0.7px', textTransform: 'uppercase',
                  color: 'var(--color-muted)', padding: '10px 20px',
                  textAlign: 'left', borderBottom: '1px solid var(--color-hairline)',
                  whiteSpace: 'nowrap',
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && [1, 2, 3].map((i) => (
              <tr key={i} style={{ borderTop: '1px solid var(--color-hairline-soft)' }}>
                {[180, 80, 100, 40, 60].map((w, j) => (
                  <td key={j} style={{ padding: '14px 20px' }}>
                    <div style={{ width: w, height: 12, borderRadius: 4, backgroundColor: 'var(--color-hairline)', opacity: 0.6 }} />
                  </td>
                ))}
              </tr>
            ))}

            {!isLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: '32px 20px', textAlign: 'center', fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--color-muted)' }}>
                  No users found.
                </td>
              </tr>
            )}

            {!isLoading && filtered.map((u, i) => {
              const isSelf = u.user_id === currentUserId;
              const isConfirming = confirmId === u.user_id;
              const isDeleting = deletingId === u.user_id;

              return (
                <tr key={u.user_id} style={{
                  borderTop: i > 0 ? '1px solid var(--color-hairline-soft)' : 'none',
                  backgroundColor: isSelf ? 'var(--color-canvas-soft)' : 'transparent',
                }}>
                  {/* Email / Name */}
                  <td style={{ padding: '14px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%',
                        backgroundColor: u.is_admin ? 'var(--color-ink)' : 'var(--color-surface-strong)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 600,
                        color: u.is_admin ? '#fff' : 'var(--color-muted)', flexShrink: 0,
                      }}>
                        {(u.display_name || u.email || '?')[0].toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 500, color: 'var(--color-ink)' }}>
                          {u.email}
                          {u.is_admin && (
                            <span style={{
                              marginLeft: 6, fontSize: 9, fontWeight: 600, letterSpacing: '0.6px',
                              textTransform: 'uppercase', color: 'var(--color-ink)',
                              backgroundColor: 'var(--color-surface-strong)',
                              padding: '1px 5px', borderRadius: 3,
                            }}>
                              Admin
                            </span>
                          )}
                          {isSelf && (
                            <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--color-muted)' }}>
                              (you)
                            </span>
                          )}
                        </div>
                        {u.display_name && (
                          <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-muted)' }}>
                            {u.display_name}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Joined */}
                  <td style={{ padding: '14px 20px', fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-muted)', whiteSpace: 'nowrap' }}>
                    {fmtDate(u.created_at)}
                  </td>

                  {/* Storage */}
                  <td style={{ padding: '14px 20px' }}>
                    <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-ink)', fontWeight: 500, marginBottom: 4 }}>
                      {u.storage_used_mb.toFixed(1)} MB
                    </div>
                    <MiniBar percent={u.storage_percent} />
                  </td>

                  {/* Datasets */}
                  <td style={{ padding: '14px 20px', fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 600, color: 'var(--color-ink)', textAlign: 'center' }}>
                    {u.datasets_count}
                  </td>

                  {/* Delete */}
                  <td style={{ padding: '14px 20px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {isSelf ? (
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--color-muted)' }}>
                        Admin User
                      </span>
                    ) : isConfirming ? (
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => setConfirmId(null)}
                          style={{
                            padding: '4px 10px', borderRadius: 6, border: '1px solid var(--color-hairline)',
                            background: 'transparent', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-muted)',
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleDelete(u)}
                          disabled={isDeleting}
                          style={{
                            padding: '4px 10px', borderRadius: 6, border: 'none',
                            backgroundColor: isDeleting ? 'var(--color-muted-soft)' : 'var(--color-error)',
                            cursor: isDeleting ? 'not-allowed' : 'pointer',
                            fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 500, color: '#fff',
                          }}
                        >
                          {isDeleting ? '…' : 'Delete'}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmId(u.user_id)}
                        style={{
                          padding: '5px 12px', borderRadius: 6,
                          border: '1px solid var(--color-hairline)',
                          background: 'transparent', cursor: 'pointer',
                          fontFamily: 'var(--font-body)', fontSize: 12,
                          color: 'var(--color-body)',
                          transition: 'border-color 150ms, color 150ms',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--color-error)'; e.currentTarget.style.color = 'var(--color-error)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--color-hairline)'; e.currentTarget.style.color = 'var(--color-body)'; }}
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}


// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCost(usd: number): string {
  if (usd === 0) return '$0.00';
  if (usd < 0.0001) return `$${usd.toFixed(8)}`;
  if (usd < 0.01)   return `$${usd.toFixed(6)}`;
  if (usd < 1)      return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}

function fmtK(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function fmtDay(dateStr: string): string {
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  } catch { return dateStr.slice(5); }
}

// ── CostOverview ──────────────────────────────────────────────────────────────

function CostOverview({ adminUsers }: { adminUsers: AdminUser[] }) {
  const { data: costs, isLoading, error } = useAdminCosts(true);

  const emailById = Object.fromEntries(adminUsers.map((u) => [u.user_id, u.email]));

  // Last 14 calendar days (ascending)
  // Generate the full 14-day window — fill missing days with zero so we always
  // have 14 bars instead of a single full-width bar when only 1 day has data.
  const dayDataMap = new Map(
    (costs?.by_day ?? []).map((d) => [d.date, d])
  );
  const last14 = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    const dateStr = d.toISOString().slice(0, 10);
    return dayDataMap.get(dateStr) ?? { date: dateStr, cost_usd: 0, calls: 0 };
  });

  const maxDayCost = Math.max(...last14.map((d) => d.cost_usd), 0.000001);
  const maxEndpointCost = Math.max(...(costs?.by_endpoint ?? []).map((e) => e.cost_usd), 0.000001);

  const totalCalls = (costs?.by_endpoint ?? []).reduce((s, e) => s + e.calls, 0);

  const Skel = ({ w, h = 14 }: { w: number | string; h?: number }) => (
    <div style={{ width: w, height: h, borderRadius: 4, backgroundColor: 'var(--color-hairline)', opacity: 0.6 }} />
  );

  return (
    <div style={{
      backgroundColor: 'var(--color-surface-card)',
      border: '1px solid var(--color-hairline)',
      borderRadius: 'var(--radius-xl)',
      boxShadow: 'var(--shadow-card)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '20px 24px 16px',
        borderBottom: '1px solid var(--color-hairline)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
      }}>
        <div>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--color-muted)', margin: '0 0 4px' }}>
            Admin Panel
          </p>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 300, color: 'var(--color-ink)', margin: 0, letterSpacing: '-0.2px' }}>
            API Cost Overview
          </h3>
        </div>
        <div style={{
          fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-muted)',
          backgroundColor: 'var(--color-canvas-soft)', border: '1px solid var(--color-hairline)',
          borderRadius: 'var(--radius-pill)', padding: '4px 12px',
        }}>
          Last 30 days
        </div>
      </div>

      {error && (
        <div style={{ padding: '12px 24px', backgroundColor: 'var(--color-canvas-soft)', fontSize: 13, color: 'var(--color-muted)', fontFamily: 'var(--font-body)', borderTop: '1px solid var(--color-hairline)' }}>
          Cost data unavailable — run migration <code style={{ fontFamily: 'monospace', fontSize: 12 }}>011_api_cost_log.sql</code> in Supabase to enable tracking.
        </div>
      )}

      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 28 }}>

        {/* ── Metric cards ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
          {[
            { label: 'Total Cost',     value: isLoading ? null : formatCost(costs?.total_cost_usd ?? 0),         icon: '💰' },
            { label: 'Input Tokens',   value: isLoading ? null : fmtK(costs?.total_input_tokens ?? 0),           icon: '📥' },
            { label: 'Output Tokens',  value: isLoading ? null : fmtK(costs?.total_output_tokens ?? 0),          icon: '📤' },
            { label: 'Total Calls',    value: isLoading ? null : String(totalCalls),                             icon: '🔁' },
          ].map((card) => (
            <div key={card.label} style={{
              backgroundColor: 'var(--color-canvas-soft)', borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--color-hairline)', padding: '14px 16px',
            }}>
              <div style={{ fontSize: 16, marginBottom: 8 }}>{card.icon}</div>
              {card.value === null
                ? <Skel w={80} h={20} />
                : <div style={{ fontFamily: 'var(--font-body)', fontSize: 18, fontWeight: 700, color: 'var(--color-ink)', lineHeight: 1, marginBottom: 4 }}>{card.value}</div>
              }
              <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--color-muted)', marginTop: 4 }}>{card.label}</div>
            </div>
          ))}
        </div>

        {/* ── Endpoint breakdown ── */}
        <div>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--color-muted)', margin: '0 0 12px' }}>
            By Endpoint
          </p>
          {isLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[1,2,3].map((i) => <Skel key={i} w="100%" h={36} />)}
            </div>
          ) : !costs?.by_endpoint.length ? (
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-muted)', margin: 0 }}>No calls recorded yet.</p>
          ) : (
            <div style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-hairline)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--color-canvas-soft)' }}>
                    {['Endpoint', 'Calls', 'In tokens', 'Out tokens', 'Cost'].map((h) => (
                      <th key={h} style={{ fontFamily: 'var(--font-body)', fontSize: 10, fontWeight: 600, letterSpacing: '0.7px', textTransform: 'uppercase', color: 'var(--color-muted)', padding: '8px 14px', textAlign: 'left', borderBottom: '1px solid var(--color-hairline)', whiteSpace: 'nowrap' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {costs.by_endpoint.map((ep, i) => {
                    const barPct = (ep.cost_usd / maxEndpointCost) * 100;
                    return (
                      <tr key={ep.endpoint} style={{ borderTop: i > 0 ? '1px solid var(--color-hairline-soft)' : 'none' }}>
                        <td style={{ padding: '10px 14px', fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 500, color: 'var(--color-ink)' }}>
                          <code style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--color-muted)', backgroundColor: 'var(--color-canvas-soft)', padding: '2px 6px', borderRadius: 3 }}>
                            {ep.endpoint}
                          </code>
                        </td>
                        <td style={{ padding: '10px 14px', fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-body)', textAlign: 'center' }}>{ep.calls}</td>
                        <td style={{ padding: '10px 14px', fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-muted)' }}>{fmtK(ep.input_tokens)}</td>
                        <td style={{ padding: '10px 14px', fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-muted)' }}>{fmtK(ep.output_tokens)}</td>
                        <td style={{ padding: '10px 14px', minWidth: 120 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ flex: 1, height: 4, borderRadius: 99, backgroundColor: 'var(--color-hairline)', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${barPct}%`, borderRadius: 99, backgroundColor: 'var(--color-ink)' }} />
                            </div>
                            <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600, color: 'var(--color-ink)', whiteSpace: 'nowrap' }}>
                              {formatCost(ep.cost_usd)}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── 14-day bar chart ── */}
        <div>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--color-muted)', margin: '0 0 12px' }}>
            Daily Spend — Last 14 Days
          </p>
          {isLoading ? (
            <Skel w="100%" h={80} />
          ) : (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4 }}>
              {last14.map((day) => {
                const BAR_MAX_PX = 60;  // px reserved for bars
                const barPx = day.cost_usd === 0
                  ? 2
                  : Math.max(Math.round((day.cost_usd / maxDayCost) * BAR_MAX_PX), 3);
                return (
                  <div key={day.date}
                    title={`${fmtDay(day.date)}: ${formatCost(day.cost_usd)} (${day.calls} call${day.calls !== 1 ? 's' : ''})`}
                    style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
                  >
                    <div style={{
                      width: '100%', borderRadius: '3px 3px 0 0',
                      height: barPx,
                      backgroundColor: day.cost_usd === 0 ? 'var(--color-hairline)' : 'var(--color-ink)',
                      transition: 'height 300ms ease',
                    }} />
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: 9, color: 'var(--color-muted)', whiteSpace: 'nowrap', overflow: 'hidden', maxWidth: '100%', textAlign: 'center', lineHeight: 1 }}>
                      {fmtDay(day.date)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Top users by cost ── */}
        {!isLoading && (costs?.by_user ?? []).length > 0 && (
          <div>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--color-muted)', margin: '0 0 12px' }}>
              Top Users by Cost
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {costs!.by_user.slice(0, 5).map((u) => {
                const email = emailById[u.user_id] ?? u.user_id.slice(0, 8) + '…';
                const maxUserCost = costs!.by_user[0]?.cost_usd || 0.000001;
                const barPct = (u.cost_usd / maxUserCost) * 100;
                return (
                  <div key={u.user_id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-body)', minWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {email}
                    </span>
                    <div style={{ flex: 1, height: 4, borderRadius: 99, backgroundColor: 'var(--color-hairline)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${barPct}%`, borderRadius: 99, backgroundColor: 'var(--color-ink)' }} />
                    </div>
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600, color: 'var(--color-ink)', whiteSpace: 'nowrap', minWidth: 70, textAlign: 'right' }}>
                      {formatCost(u.cost_usd)}
                    </span>
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--color-muted)', whiteSpace: 'nowrap' }}>
                      {u.calls} call{u.calls !== 1 ? 's' : ''}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
// ── Main page ─────────────────────────────────────────────────────────────────

export default function AccountPage() {
  const router = useRouter();
  const { user, signOut, loading: authLoading } = useAuth();
  const { stats, isLoading: statsLoading } = useAccount();
  const [toast, setToast] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeletingSelf, setIsDeletingSelf] = useState(false);

  // Redirect if not signed in
  useEffect(() => {
    if (!authLoading && !user) router.push('/login?returnUrl=%2Faccount');
  }, [authLoading, user, router]);

  const handleSelfDelete = async () => {
    setIsDeletingSelf(true);
    try {
      await api.deleteMyAccount();
      setShowDeleteModal(false);
      await signOut();
      router.push('/?account_deleted=1');
    } catch (err: unknown) {
      setIsDeletingSelf(false);
      setShowDeleteModal(false);
      setToast(err instanceof Error ? err.message : 'Deletion failed. Please try again.');
    }
  };

  if (authLoading || !user) {
    return (
      <main style={{ minHeight: '100vh', backgroundColor: 'var(--color-canvas)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--color-muted)' }}>Loading…</div>
      </main>
    );
  }

  const displayName = user.user_metadata?.display_name || user.user_metadata?.full_name || '';
  const initials = (displayName || user.email || '?')[0].toUpperCase();

  return (
    <main style={{ minHeight: '100vh', backgroundColor: 'var(--color-canvas)' }}>

      {/* Toast */}
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}

      {/* Delete modal */}
      {showDeleteModal && (
        <DeleteSelfModal
          userEmail={user.email!}
          onCancel={() => setShowDeleteModal(false)}
          onConfirm={handleSelfDelete}
          isDeleting={isDeletingSelf}
        />
      )}

      {/* ── Nav ────────────────────────────────────────────────────────────── */}
      <nav style={{
        height: 64, borderBottom: '1px solid var(--color-hairline)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 32px', backgroundColor: 'var(--color-canvas)',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 300, color: 'var(--color-ink)', letterSpacing: '-0.3px' }}>
            AIDPA
          </span>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{
            fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-ink)', fontWeight: 500,
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
            <span style={{ color: 'var(--color-muted)', fontWeight: 400 }}>Account:</span>
            {displayName || (user.email ?? '').split('@')[0]}
            {stats?.is_admin && (
              <span style={{
                fontSize: 9, fontWeight: 600, letterSpacing: '0.6px', textTransform: 'uppercase',
                backgroundColor: 'var(--color-ink)', color: '#fff',
                padding: '1px 5px', borderRadius: 3,
              }}>Admin</span>
            )}
          </span>
          <button
            onClick={() => signOut().then(() => router.push('/'))}
            style={{
              padding: '6px 16px', borderRadius: 8,
              border: '1px solid var(--color-hairline)', background: 'transparent',
              fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-ink)', cursor: 'pointer',
            }}
          >
            Sign Out
          </button>
        </div>
      </nav>

      {/* ── Content ────────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '48px 32px 96px' }}>

        {/* Page title */}
        <div style={{ marginBottom: 40 }}>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--color-muted)', margin: '0 0 10px' }}>
            Account
          </p>
          <h1 className="display-lg" style={{ color: 'var(--color-ink)', margin: 0 }}>
            Your profile & settings
          </h1>
        </div>

        {/* ── Profile card ──────────────────────────────────────────────── */}
        <div style={{
          backgroundColor: 'var(--color-surface-card)',
          border: '1px solid var(--color-hairline)',
          borderRadius: 'var(--radius-xl)',
          padding: '28px 32px',
          boxShadow: 'var(--shadow-card)',
          marginBottom: 24,
          display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap',
        }}>
          {/* Avatar */}
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            backgroundColor: 'var(--color-ink)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 300, color: '#fff',
            flexShrink: 0,
          }}>
            {initials}
          </div>
          {/* Name / email */}
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
              {displayName && (
                <span style={{ fontFamily: 'var(--font-body)', fontSize: 17, fontWeight: 600, color: 'var(--color-ink)' }}>
                  {displayName}
                </span>
              )}
              {stats?.is_admin && (
                <span style={{
                  fontSize: 10, fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase',
                  backgroundColor: 'var(--color-ink)', color: '#fff',
                  padding: '2px 7px', borderRadius: 4,
                }}>
                  Admin
                </span>
              )}
            </div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--color-body)', marginBottom: 8 }}>
              {user.email}
            </div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-muted)' }}>
                Member since {user.created_at ? new Date(user.created_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) : '—'}
              </span>
              <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--color-muted)', userSelect: 'all' }}>
                ID: {user.id?.slice(0, 8)}…
              </span>
            </div>
          </div>
        </div>

        {/* ── Stats row ──────────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
          {/* Storage */}
          <div style={{
            backgroundColor: 'var(--color-surface-card)',
            border: '1px solid var(--color-hairline)',
            borderRadius: 'var(--radius-xl)',
            padding: '20px 24px',
            boxShadow: 'var(--shadow-card)',
          }}>
            <div style={{ fontSize: 22, marginBottom: 10 }}>💾</div>
            {statsLoading ? (
              <div style={{ height: 40, backgroundColor: 'var(--color-hairline)', borderRadius: 4 }} />
            ) : stats ? (
              <StorageBar
                percent={stats.storage_percent}
                usedMb={stats.storage_used_mb}
                quotaMb={stats.storage_quota_mb}
              />
            ) : null}
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-muted)', marginTop: 8 }}>
              Storage quota
            </div>
          </div>

          <StatCard icon="📄" value={statsLoading ? '…' : stats?.datasets_count ?? 0} label="Datasets uploaded" />
          <StatCard icon="💬" value={statsLoading ? '…' : stats?.sessions_count ?? 0} label="Chat sessions" />
          <StatCard icon="🔍" value={statsLoading ? '…' : stats?.queries_count ?? 0} label="Queries run" />
        </div>

        {/* Admin section */}
        {stats?.is_admin && (
          <AdminSection
            currentUserId={user.id!}
            onToast={(msg) => setToast(msg)}
          />
        )}

        {/* ── Danger zone ────────────────────────────────────────────────── */}
        <div style={{
          border: '1px solid #fecaca',
          borderRadius: 'var(--radius-xl)',
          padding: '24px 32px',
          backgroundColor: '#fff5f5',
        }}>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: '#dc2626', margin: '0 0 10px' }}>
            Danger Zone
          </p>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
            <div>
              <h3 style={{ fontFamily: 'var(--font-body)', fontSize: 16, fontWeight: 600, color: 'var(--color-ink)', margin: '0 0 4px' }}>
                Delete your account
              </h3>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-body)', margin: 0, maxWidth: 440 }}>
                Permanently removes your account, all datasets, sessions, queries, and AI memory. This action is irreversible.
              </p>
            </div>
            <button
              onClick={() => setShowDeleteModal(true)}
              style={{
                padding: '10px 20px', borderRadius: 'var(--radius-pill)',
                border: '1px solid #fca5a5',
                backgroundColor: 'transparent', cursor: 'pointer',
                fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 500,
                color: '#dc2626',
                transition: 'background-color 150ms ease',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fef2f2'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              Delete my account
            </button>
          </div>
        </div>

      </div>
    </main>
  );
}






