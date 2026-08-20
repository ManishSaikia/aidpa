'use client';

import { useRef, useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { UploadZone } from '@/components/upload/UploadZone';
import { FeatureTabs } from '@/components/upload/FeatureTabs';
import Link from 'next/link';

function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 5000); return () => clearTimeout(t); }, [onDone]);
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 1000,
      backgroundColor: 'var(--color-ink)', color: '#fff',
      fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 500,
      padding: '12px 20px', borderRadius: 'var(--radius-lg)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.18)', animation: 'fadeInUp 200ms ease both',
    }}>
      {message}
    </div>
  );
}

const STATS = [
  { icon: '⚡', stat: '< 2s', label: 'Instant column analysis' },
  { icon: '💬', stat: 'Zero SQL', label: 'Ask in plain English' },
  { icon: '🧠', stat: 'Persistent', label: 'AI memory across sessions' },
];

const HOW_IT_WORKS = [
  { num: '01', title: 'Upload', desc: 'Drop any CSV file. Instant column analysis, anomaly detection, and quality scoring in under 2 seconds.' },
  { num: '02', title: 'Ask', desc: 'Type your question in plain English. The AI writes the SQL, runs it, and explains the result clearly.' },
  { num: '03', title: 'Chat', desc: 'Your AI analyst remembers every session and every dataset. Ask follow-ups. Build on past context.' },
];

function HomePageContent() {
  const { user, signOut, loading } = useAuth();
  const router = useRouter();
  const uploadRef = useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get('account_deleted') === '1') {
      setToast('Your account has been permanently deleted.');
      router.replace('/');
    }
  }, [searchParams, router]);

  const scrollToUpload = () => uploadRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });

  return (
    <main style={{ minHeight: '100vh', backgroundColor: 'var(--color-canvas)' }}>

      {toast && <Toast message={toast} onDone={() => setToast(null)} />}

      {/* ── Nav ────────────────────────────────────────────────────────────── */}
      <nav style={{
        height: 64,
        borderBottom: '1px solid var(--color-hairline)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 32px',
        backgroundColor: 'var(--color-canvas)',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <span style={{
          fontFamily: 'var(--font-display)', fontSize: 20,
          fontWeight: 300, color: 'var(--color-ink)', letterSpacing: '-0.3px',
        }}>
          AIDPA
        </span>

        {!loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {user ? (
              <>
                <Link href="/account" style={{
                  padding: '6px 16px', borderRadius: 8,
                  border: '1px solid var(--color-hairline)',
                  background: 'transparent',
                  fontFamily: 'var(--font-body)', fontSize: 13,
                  color: 'var(--color-ink)', textDecoration: 'none',
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                }}>
                  <span style={{ color: 'var(--color-muted)' }}>Account:</span>
                  {user.user_metadata?.display_name || (user.email ?? '').split('@')[0]}
                </Link>
                <button
                  onClick={() => signOut().then(() => router.refresh())}
                  style={{
                    padding: '6px 16px', borderRadius: 8,
                    border: '1px solid var(--color-hairline)',
                    background: 'transparent',
                    fontFamily: 'var(--font-body)', fontSize: 13,
                    color: 'var(--color-ink)', cursor: 'pointer',
                  }}
                >
                  Sign Out
                </button>
              </>
            ) : (
              <button
                onClick={() => router.push('/login')}
                style={{
                  padding: '7px 18px', borderRadius: 8, border: 'none',
                  background: 'var(--color-ink)',
                  fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 500,
                  color: '#fff', cursor: 'pointer',
                }}
              >
                Sign In
              </button>
            )}
          </div>
        )}
      </nav>

      {/* ── Hero — Split Layout ─────────────────────────────────────────────── */}
      <section style={{ position: 'relative', paddingTop: 88, paddingBottom: 72, overflow: 'hidden' }}>
        <div className="orb" style={{ width: 500, height: 500, background: 'radial-gradient(circle, var(--color-orb-mint) 0%, transparent 70%)', top: -140, left: '2%' }} />
        <div className="orb" style={{ width: 380, height: 380, background: 'radial-gradient(circle, var(--color-orb-lavender) 0%, transparent 70%)', top: -80, right: '8%' }} />
        <div className="orb" style={{ width: 260, height: 260, background: 'radial-gradient(circle, var(--color-orb-peach) 0%, transparent 70%)', bottom: 0, right: '20%', opacity: 0.35 }} />

        <div className="hero-grid container" style={{ position: 'relative', zIndex: 1 }}>
          {/* Left */}
          <div>
            <span className="badge" style={{ marginBottom: 24, display: 'inline-flex' }}>AI Data Platform</span>
            <h1 className="display-xl" style={{ color: 'var(--color-ink)', margin: '0 0 20px' }}>
              Understand your data<br />in plain English.
            </h1>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 16, color: 'var(--color-body)', lineHeight: 1.65, margin: '0 0 36px', maxWidth: 400, letterSpacing: '0.16px' }}>
              Upload a CSV. Ask questions. Let the AI remember every insight.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button className="btn-primary" onClick={scrollToUpload}>↑ Upload a dataset</button>
              {user ? (
                <button className="btn-outline" onClick={() => router.push('/datasets')}>My Datasets →</button>
              ) : (
                <button className="btn-outline" onClick={() => router.push('/login')}>Sign in →</button>
              )}
            </div>
          </div>

          {/* Right — stat proof points */}
          <div style={{
            backgroundColor: 'var(--color-surface-card)', border: '1px solid var(--color-hairline)',
            borderRadius: 'var(--radius-xl)', padding: '8px 32px',
            boxShadow: 'var(--shadow-card)', position: 'relative', overflow: 'hidden',
          }}>
            <div className="orb" style={{ width: 220, height: 220, background: 'radial-gradient(circle, var(--color-orb-sky) 0%, transparent 70%)', top: -60, right: -60, opacity: 0.35 }} />
            {STATS.map((s, i) => (
              <div key={s.stat} style={{
                display: 'flex', alignItems: 'center', gap: 16,
                padding: '22px 0',
                borderBottom: i < STATS.length - 1 ? '1px solid var(--color-hairline-soft)' : 'none',
                position: 'relative',
              }}>
                <span style={{ fontSize: 24, flexShrink: 0 }}>{s.icon}</span>
                <div>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 700, color: 'var(--color-ink)' }}>{s.stat}</span>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--color-muted)', marginLeft: 10 }}>{s.label}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Upload Zone ─────────────────────────────────────────────────────── */}
      <section className="container" style={{ paddingBottom: 72 }}>
        <div className="labelled-divider">or start right now</div>
        <div ref={uploadRef}><UploadZone /></div>
      </section>

      {/* ── Feature Tabs ────────────────────────────────────────────────────── */}
      <section className="container" style={{ paddingBottom: 88 }}>
        <FeatureTabs />
      </section>

      {/* ── How It Works ────────────────────────────────────────────────────── */}
      <section style={{ borderTop: '1px solid var(--color-hairline)', padding: '80px 0 100px' }}>
        <div className="container">
          <div style={{ marginBottom: 52 }}>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--color-muted)', margin: '0 0 12px' }}>How it works</p>
            <h2 className="display-lg" style={{ color: 'var(--color-ink)', margin: 0 }}>Three steps to insight.</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 48 }}>
            {HOW_IT_WORKS.map((step) => (
              <div key={step.num} className="step-card">
                <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--color-muted)' }}>{step.num}</span>
                <h3 className="display-sm" style={{ color: 'var(--color-ink)', margin: '10px 0 12px' }}>{step.title}</h3>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--color-body)', lineHeight: 1.65, margin: 0 }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

    </main>
  );
}

export default function HomePage() {
  return (
    <Suspense>
      <HomePageContent />
    </Suspense>
  );
}
