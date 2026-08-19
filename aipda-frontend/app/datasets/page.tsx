'use client';

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { DatasetInfo } from '@/types/api';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function SkeletonRow() {
  const Pulse = ({ w }: { w: string | number }) => (
    <div style={{
      width: w, height: 14, borderRadius: 4,
      backgroundColor: 'var(--color-hairline)',
      animation: 'pulse 1.5s ease-in-out infinite',
    }} />
  );
  return (
    <tr style={{ borderTop: '1px solid var(--color-hairline-soft)' }}>
      {[200, 80, 60, 40].map((w, i) => (
        <td key={i} style={{ padding: '14px 20px' }}>
          <Pulse w={w} />
        </td>
      ))}
    </tr>
  );
}

export default function DatasetsPage() {
  const router = useRouter();
  const { data: datasets, isLoading, error } = useQuery<DatasetInfo[]>({
    queryKey: ['datasets'],
    queryFn: () => api.listDatasets(),
    staleTime: 30_000,
  });

  useEffect(() => {
    if (error && String(error).includes('401')) {
      router.push('/login?returnUrl=%2Fdatasets');
    }
  }, [error, router]);

  return (
    <>
      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>

      <main style={{ minHeight: '100vh', backgroundColor: 'var(--color-canvas)' }}>

        {/* ── Nav ──────────────────────────────────────────────────────────── */}
        <nav style={{
          height: 64, borderBottom: '1px solid var(--color-hairline)',
          display: 'flex', alignItems: 'center', padding: '0 32px',
          backgroundColor: 'var(--color-canvas)', position: 'sticky', top: 0, zIndex: 10,
        }}>
          <Link href="/" style={{ textDecoration: 'none' }}>
            <span style={{
              fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 300,
              color: 'var(--color-ink)', letterSpacing: '-0.3px',
            }}>
              AIDPA
            </span>
          </Link>
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-muted)', marginLeft: 12 }}>
            › Instant Analysis
          </span>
        </nav>

        {/* ── Content ───────────────────────────────────────────────────────── */}
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '48px 32px 80px' }}>

          {/* Header */}
          <div style={{ marginBottom: 32, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <div>
              <h1 style={{
                fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 300,
                color: 'var(--color-ink)', margin: '0 0 6px', letterSpacing: '-0.4px',
              }}>
                Your Datasets
              </h1>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--color-muted)', margin: 0 }}>
                Click any dataset to open its analysis dashboard.
              </p>
            </div>
            <Link
              href="/"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 500,
                color: 'white', backgroundColor: 'var(--color-ink)',
                padding: '8px 16px', borderRadius: 'var(--radius-pill)',
                textDecoration: 'none',
              }}
            >
              + Upload new
            </Link>
          </div>

          {/* ── Error ──────────────────────────────────────────────────────── */}
          {error && (
            <div style={{
              padding: '16px 20px', borderRadius: 'var(--radius-xl)',
              backgroundColor: '#fff5f5', border: '1px solid #fecaca',
              fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--color-error)',
            }}>
              Could not load datasets: {(error as Error).message}
            </div>
          )}

          {/* ── Table ──────────────────────────────────────────────────────── */}
          {!error && (
            <div style={{
              borderRadius: 'var(--radius-xl)', border: '1px solid var(--color-hairline)',
              overflow: 'hidden', backgroundColor: 'var(--color-surface-card)',
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--color-canvas-soft)' }}>
                    {['Filename', 'Dataset ID', 'Size', ''].map((h) => (
                      <th key={h} style={{
                        fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 600,
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
                  {/* Skeleton rows while loading */}
                  {isLoading && [1, 2, 3, 4].map((i) => <SkeletonRow key={i} />)}

                  {/* Empty state */}
                  {!isLoading && datasets?.length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ padding: '48px 20px', textAlign: 'center' }}>
                        <p style={{
                          fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 300,
                          color: 'var(--color-ink)', margin: '0 0 8px',
                        }}>
                          No datasets yet
                        </p>
                        <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--color-muted)', margin: '0 0 20px' }}>
                          Upload a CSV from the home page to get started.
                        </p>
                        <Link href="/" style={{
                          fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 500,
                          color: 'white', backgroundColor: 'var(--color-ink)',
                          padding: '8px 16px', borderRadius: 'var(--radius-pill)',
                          textDecoration: 'none',
                        }}>
                          Go upload →
                        </Link>
                      </td>
                    </tr>
                  )}

                  {/* Dataset rows */}
                  {!isLoading && datasets?.map((ds, i) => (
                    <tr
                      key={ds.dataset_id}
                      style={{
                        borderTop: i > 0 ? '1px solid var(--color-hairline-soft)' : 'none',
                        transition: 'background-color 120ms ease',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-canvas-soft)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      onClick={() => window.location.href = `/dashboard/${ds.dataset_id}`}
                    >
                      {/* Filename */}
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 16, opacity: 0.4 }}>📄</span>
                          <span style={{
                            fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 500,
                            color: 'var(--color-ink)',
                          }}>
                            {ds.filename}
                          </span>
                        </div>
                      </td>

                      {/* Dataset ID */}
                      <td style={{ padding: '14px 20px' }}>
                        <code style={{
                          fontFamily: 'monospace', fontSize: 11,
                          color: 'var(--color-muted)',
                          backgroundColor: 'var(--color-canvas-soft)',
                          padding: '2px 6px', borderRadius: 4,
                        }}>
                          {ds.dataset_id.slice(0, 8)}…
                        </code>
                      </td>

                      {/* Size */}
                      <td style={{
                        padding: '14px 20px',
                        fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-body)',
                      }}>
                        {formatBytes(ds.size_bytes)}
                      </td>

                      {/* Action link */}
                      <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                        <Link
                          href={`/dashboard/${ds.dataset_id}`}
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 500,
                            color: 'var(--color-ink)', textDecoration: 'none',
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            padding: '5px 12px', borderRadius: 'var(--radius-pill)',
                            border: '1px solid var(--color-hairline)',
                          }}
                        >
                          Open dashboard ↗
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Footer */}
              {!isLoading && (datasets?.length ?? 0) > 0 && (
                <div style={{
                  padding: '8px 20px', borderTop: '1px solid var(--color-hairline)',
                  fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-muted)',
                  backgroundColor: 'var(--color-canvas-soft)',
                }}>
                  {datasets!.length} dataset{datasets!.length !== 1 ? 's' : ''} · newest first
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
