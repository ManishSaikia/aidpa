import Link from 'next/link';
import { DashboardView } from '@/components/analysis/DashboardView';

interface Props {
  params: Promise<{ datasetId: string }>;
}

export default async function DashboardPage({ params }: Props) {
  const { datasetId } = await params;

  return (
    <main style={{ minHeight: '100vh', backgroundColor: 'var(--color-canvas)' }}>

      {/* ── Sticky top nav ───────────────────────────────────────────────── */}
      <nav style={{
        height: 64,
        borderBottom: '1px solid var(--color-hairline)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 32px',
        backgroundColor: 'var(--color-canvas)',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <span style={{
            fontFamily: 'var(--font-display)',
            fontSize: 20,
            fontWeight: 300,
            color: 'var(--color-ink)',
            letterSpacing: '-0.3px',
          }}>
            AIDPA
          </span>
        </Link>

        {/* Breadcrumb */}
        <span style={{
          fontFamily: 'var(--font-body)',
          fontSize: 13,
          color: 'var(--color-muted)',
          marginLeft: 12,
        }}>
          › Dashboard
        </span>

        {/* Back to all datasets */}
        <Link
          href="/datasets"
          style={{
            marginLeft: 'auto',
            fontFamily: 'var(--font-body)',
            fontSize: 13,
            color: 'var(--color-muted)',
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          ← All datasets
        </Link>
      </nav>

      {/* ── Client-side dashboard content (tabs + data) ──────────────────── */}
      <DashboardView datasetId={datasetId} />

    </main>
  );
}
