'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
      {[200, 80, 60, 100].map((w, i) => (
        <td key={i} style={{ padding: '14px 20px' }}>
          <Pulse w={w} />
        </td>
      ))}
    </tr>
  );
}

export default function DatasetsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState<DatasetInfo | null>(null);

  const { data: datasets, isLoading, error } = useQuery<DatasetInfo[]>({
    queryKey: ['datasets'],
    queryFn: () => api.listDatasets(),
    staleTime: 30_000,
  });

  const deleteMutation = useMutation({
    mutationFn: (datasetId: string) => api.deleteDataset(datasetId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['datasets'] });
      setDeleteTarget(null);
    },
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
        .dataset-row:hover { background-color: var(--color-canvas-soft) !important; }
        .del-btn:hover { color: #dc2626 !important; background-color: #fef2f2 !important; border-color: #fecaca !important; }
      `}</style>

      <main style={{ minHeight: '100vh', backgroundColor: 'var(--color-canvas)' }}>

        {/* Nav */}
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
            Instant Analysis
          </span>
          <Link
            href="/account"
            style={{
              marginLeft: 'auto',
              fontFamily: 'var(--font-body)',
              fontSize: 13,
              color: 'var(--color-muted)',
              textDecoration: 'none',
            }}
          >
            Account & Settings
          </Link>
        </nav>

        {/* Content */}
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
                Click any dataset to open its analysis dashboard, Text-to-SQL, or persistent AI agent.
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

          {/* Error */}
          {error && (
            <div style={{
              padding: '16px 20px', borderRadius: 'var(--radius-xl)',
              backgroundColor: '#fff5f5', border: '1px solid #fecaca',
              fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--color-error)',
            }}>
              Could not load datasets: {(error as Error).message}
            </div>
          )}

          {/* Table */}
          {!error && (
            <div style={{
              borderRadius: 'var(--radius-xl)', border: '1px solid var(--color-hairline)',
              overflow: 'hidden', backgroundColor: 'var(--color-surface-card)',
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--color-canvas-soft)' }}>
                    {['Filename', 'Dataset ID', 'Size', 'Actions'].map((h, idx) => (
                      <th key={h} style={{
                        fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 600,
                        letterSpacing: '0.7px', textTransform: 'uppercase',
                        color: 'var(--color-muted)', padding: '10px 20px',
                        textAlign: idx === 3 ? 'right' : 'left', borderBottom: '1px solid var(--color-hairline)',
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
                          Upload a dataset
                        </Link>
                      </td>
                    </tr>
                  )}

                  {/* Dataset rows */}
                  {!isLoading && datasets?.map((ds, i) => (
                    <tr
                      key={ds.dataset_id}
                      className="dataset-row"
                      style={{
                        borderTop: i > 0 ? '1px solid var(--color-hairline-soft)' : 'none',
                        transition: 'background-color 120ms ease',
                        cursor: 'pointer',
                      }}
                      onClick={() => router.push(`/dashboard/${ds.dataset_id}`)}
                    >
                      {/* Filename */}
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
                          {ds.dataset_id.slice(0, 8)}
                        </code>
                      </td>

                      {/* Size */}
                      <td style={{
                        padding: '14px 20px',
                        fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-body)',
                      }}>
                        {formatBytes(ds.size_bytes)}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }} onClick={(e) => e.stopPropagation()}>
                          <Link
                            href={`/dashboard/${ds.dataset_id}`}
                            style={{
                              fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 500,
                              color: 'var(--color-ink)', textDecoration: 'none',
                              padding: '5px 12px', borderRadius: 'var(--radius-pill)',
                              border: '1px solid var(--color-hairline)',
                              backgroundColor: 'white',
                            }}
                          >
                            Open
                          </Link>

                          <button
                            type="button"
                            className="del-btn"
                            onClick={() => setDeleteTarget(ds)}
                            style={{
                              fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 500,
                              color: 'var(--color-muted)',
                              padding: '5px 10px', borderRadius: 'var(--radius-pill)',
                              border: '1px solid var(--color-hairline)',
                              backgroundColor: 'white',
                              cursor: 'pointer',
                              transition: 'all 120ms ease',
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Footer */}
              {!isLoading && (datasets?.length ?? 0) > 0 && (
                <div style={{
                  padding: '10px 20px', borderTop: '1px solid var(--color-hairline)',
                  fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-muted)',
                  backgroundColor: 'var(--color-canvas-soft)',
                }}>
                  {datasets!.length} dataset{datasets!.length !== 1 ? 's' : ''} - newest first
                </div>
              )}
            </div>
          )}
        </div>

        {/* Delete Confirmation Modal */}
        {deleteTarget && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 100,
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 16,
          }}>
            <div style={{
              width: '100%', maxWidth: 440,
              backgroundColor: 'white',
              borderRadius: 16,
              padding: '24px 28px',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
            }}>
              <h3 style={{
                fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 500,
                color: '#111827', margin: '0 0 8px',
              }}>
                Delete Dataset?
              </h3>
              <p style={{
                fontFamily: 'var(--font-body)', fontSize: 14, color: '#6b7280',
                lineHeight: 1.5, margin: '0 0 20px',
              }}>
                Are you sure you want to permanently delete <strong style={{ color: '#111827' }}>{deleteTarget.filename}</strong>? 
                This will remove the dataset table, analysis results, vector embeddings, and all associated chat sessions.
              </p>

              {deleteMutation.isError && (
                <div style={{
                  padding: '10px 14px', borderRadius: 8,
                  backgroundColor: '#fef2f2', border: '1px solid #fecaca',
                  color: '#dc2626', fontSize: 13, marginBottom: 16,
                }}>
                  {(deleteMutation.error as Error).message}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  disabled={deleteMutation.isPending}
                  onClick={() => setDeleteTarget(null)}
                  style={{
                    padding: '8px 16px', borderRadius: 'var(--radius-pill)',
                    border: '1px solid #d1d5db', backgroundColor: 'white',
                    color: '#374151', fontSize: 13, fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={deleteMutation.isPending}
                  onClick={() => deleteMutation.mutate(deleteTarget.dataset_id)}
                  style={{
                    padding: '8px 18px', borderRadius: 'var(--radius-pill)',
                    border: 'none', backgroundColor: '#dc2626',
                    color: 'white', fontSize: 13, fontWeight: 500,
                    cursor: deleteMutation.isPending ? 'not-allowed' : 'pointer',
                    opacity: deleteMutation.isPending ? 0.7 : 1,
                  }}
                >
                  {deleteMutation.isPending ? 'Deleting...' : 'Delete permanently'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
