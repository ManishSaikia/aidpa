'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

const FEATURES = [
  {
    id: 'instant-analysis',
    label: 'Instant Analysis',
    desc: 'Column types, null rates, duplicates, and outliers detected in seconds.',
    orb: 'var(--color-orb-mint)',
    href: '/datasets',
  },
  {
    id: 'ask-in-english',
    label: 'Ask in English',
    desc: 'Turn plain-language questions into SQL queries. No SQL knowledge needed.',
    orb: 'var(--color-orb-sky)',
    href: null,
  },
  {
    id: 'ai-chat-memory',
    label: 'AI Chat + Memory',
    desc: 'A stateful agent that recalls your past analyses and answers follow-ups.',
    orb: 'var(--color-orb-lavender)',
    href: null,
  },
];

export function FeatureStrip() {
  const { user } = useAuth();
  const router = useRouter();

  const handleFeatureClick = (href: string) => {
    if (!user) {
      router.push(`/login?returnUrl=${encodeURIComponent(href)}`);
    } else {
      router.push(href);
    }
  };

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
      gap: 16,
    }}>
      {FEATURES.map((f) => {
        const sharedStyle: React.CSSProperties = {
          padding: 24,
          position: 'relative',
          overflow: 'hidden',
          display: 'block',
          textDecoration: 'none',
          backgroundColor: 'var(--color-surface-card)',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--color-hairline)',
          boxShadow: 'var(--shadow-card)',
          transition: 'box-shadow 200ms ease',
          cursor: f.href ? 'pointer' : 'default',
        };

        const inner = (
          <>
            <div style={{
              position: 'absolute', width: 120, height: 120, borderRadius: '50%',
              background: `radial-gradient(circle, ${f.orb} 0%, transparent 70%)`,
              top: -30, right: -30, opacity: 0.5, pointerEvents: 'none',
            }} />
            <p style={{
              fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 600,
              color: 'var(--color-ink)', margin: '0 0 8px', position: 'relative',
            }}>
              {f.label}
              {f.href && (
                <span style={{
                  marginLeft: 8, fontSize: 11, fontWeight: 500,
                  color: 'var(--color-muted)', letterSpacing: '0.4px', textTransform: 'uppercase',
                }}>
                  ↗
                </span>
              )}
            </p>
            <p style={{
              fontFamily: 'var(--font-body)', fontSize: 14,
              color: 'var(--color-body)', margin: 0, lineHeight: 1.55, position: 'relative',
            }}>
              {f.desc}
            </p>
          </>
        );

        return f.href ? (
          <div
            key={f.id}
            role="link"
            tabIndex={0}
            style={sharedStyle}
            onClick={() => handleFeatureClick(f.href!)}
            onKeyDown={(e) => e.key === 'Enter' && handleFeatureClick(f.href!)}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-card-hover)')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-card)')}
          >
            {inner}
          </div>
        ) : (
          <div key={f.id} style={sharedStyle}>
            {inner}
          </div>
        );
      })}
    </div>
  );
}
