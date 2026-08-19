'use client';

import { Suspense, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

type Tab = 'signin' | 'signup';

// ── Shared styles ─────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px',
  borderRadius: 8, border: '1px solid var(--color-hairline)',
  background: 'var(--color-canvas-soft)',
  fontFamily: 'var(--font-body)', fontSize: 14,
  color: 'var(--color-ink)', outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 150ms',
};

const labelStyle: React.CSSProperties = {
  fontFamily: 'var(--font-body)', fontSize: 12,
  fontWeight: 500, color: 'var(--color-muted)',
  display: 'block', marginBottom: 6,
  letterSpacing: '0.04em', textTransform: 'uppercase',
};

// ── Inner form ─────────────────────────────────────────────────────────────

function LoginContent() {
  const { signIn, signUp } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get('returnUrl') ?? '/';

  const [tab, setTab] = useState<Tab>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (tab === 'signup' && password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (tab === 'signup' && !displayName.trim()) {
      setError('Display name is required.');
      return;
    }

    setLoading(true);
    if (tab === 'signin') {
      const { error: err } = await signIn(email, password);
      if (err) { setError(err); setLoading(false); return; }
      router.push(returnUrl);
    } else {
      const { error: err } = await signUp(email, password, displayName.trim());
      if (err) { setError(err); setLoading(false); return; }
      setInfo('Check your email to confirm your account, then sign in.');
      setTab('signin');
      setLoading(false);
    }
  }, [tab, email, password, confirm, displayName, signIn, signUp, router, returnUrl]);

  const btnPrimary: React.CSSProperties = {
    width: '100%', padding: '11px 0',
    borderRadius: 8, border: 'none',
    background: 'var(--color-ink)', color: '#fff',
    fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 500,
    cursor: loading ? 'not-allowed' : 'pointer',
    opacity: loading ? 0.6 : 1,
    transition: 'opacity 150ms',
    marginTop: 8,
  };

  return (
    <div style={{
      position: 'relative', zIndex: 1,
      width: '100%', maxWidth: 400,
      background: 'var(--color-surface-card)',
      borderRadius: 'var(--radius-xl)',
      border: '1px solid var(--color-hairline)',
      boxShadow: 'var(--shadow-card)',
      padding: '36px 32px 40px',
    }}>
      {/* Logo */}
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <span style={{
          fontFamily: 'var(--font-display)',
          fontSize: 22, fontWeight: 300,
          color: 'var(--color-ink)', letterSpacing: '-0.3px',
        }}>
          AIDPA
        </span>
        <p style={{
          fontFamily: 'var(--font-body)', fontSize: 13,
          color: 'var(--color-muted)', margin: '4px 0 0',
        }}>
          AI-powered data analysis
        </p>
      </div>

      {/* Tab switcher */}
      <div style={{
        display: 'flex', gap: 0, marginBottom: 28,
        borderRadius: 8, overflow: 'hidden',
        border: '1px solid var(--color-hairline)',
      }}>
        {(['signin', 'signup'] as Tab[]).map((t) => (
          <button key={t} onClick={() => { setTab(t); setError(null); setInfo(null); }}
            style={{
              flex: 1, padding: '9px 0',
              border: 'none', cursor: 'pointer',
              fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 500,
              background: tab === t ? 'var(--color-ink)' : 'transparent',
              color: tab === t ? '#fff' : 'var(--color-muted)',
              transition: 'background 150ms, color 150ms',
            }}
          >
            {t === 'signin' ? 'Sign In' : 'Sign Up'}
          </button>
        ))}
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Display Name — sign-up only */}
        {tab === 'signup' && (
          <div>
            <label style={labelStyle}>Display Name</label>
            <input id="auth-display-name" type="text" required
              value={displayName} onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name" style={inputStyle}
              autoComplete="name"
            />
          </div>
        )}

        <div>
          <label style={labelStyle}>Email</label>
          <input id="auth-email" type="email" required
            value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com" style={inputStyle}
            autoComplete="email"
          />
        </div>

        <div>
          <label style={labelStyle}>Password</label>
          <input id="auth-password" type="password" required
            value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••" style={inputStyle}
            autoComplete={tab === 'signin' ? 'current-password' : 'new-password'}
          />
        </div>

        {tab === 'signup' && (
          <div>
            <label style={labelStyle}>Confirm Password</label>
            <input id="auth-confirm" type="password" required
              value={confirm} onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••" style={inputStyle}
              autoComplete="new-password"
            />
          </div>
        )}

        {error && (
          <p style={{
            fontFamily: 'var(--font-body)', fontSize: 13,
            color: '#e05252', margin: 0,
            padding: '8px 12px', borderRadius: 6,
            background: 'rgba(224,82,82,0.08)',
            border: '1px solid rgba(224,82,82,0.2)',
          }}>{error}</p>
        )}

        {info && (
          <p style={{
            fontFamily: 'var(--font-body)', fontSize: 13,
            color: '#2fa86b', margin: 0,
            padding: '8px 12px', borderRadius: 6,
            background: 'rgba(47,168,107,0.08)',
            border: '1px solid rgba(47,168,107,0.2)',
          }}>{info}</p>
        )}

        <button id="auth-submit" type="submit" disabled={loading} style={btnPrimary}>
          {loading
            ? (tab === 'signin' ? 'Signing in…' : 'Creating account…')
            : (tab === 'signin' ? 'Sign In' : 'Create Account')
          }
        </button>
      </form>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────────────

export default function LoginPage() {
  return (
    <main style={{
      minHeight: '100vh',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: 'var(--color-canvas)',
      padding: '0 24px',
    }}>
      {/* Ambient orbs */}
      <div className="orb" style={{
        width: 400, height: 400,
        background: 'radial-gradient(circle, var(--color-orb-mint) 0%, transparent 70%)',
        top: -100, left: '-5%',
      }} />
      <div className="orb" style={{
        width: 320, height: 320,
        background: 'radial-gradient(circle, var(--color-orb-lavender) 0%, transparent 70%)',
        bottom: -60, right: '5%',
      }} />

      <Suspense fallback={
        <div style={{
          width: '100%', maxWidth: 400,
          background: 'var(--color-surface-card)',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--color-hairline)',
          height: 360,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-muted)' }}>
            Loading…
          </span>
        </div>
      }>
        <LoginContent />
      </Suspense>
    </main>
  );
}
