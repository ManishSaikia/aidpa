export default function DashboardLoading() {
  const Pulse = ({ w = '100%', h = 20, radius = 6 }: { w?: string | number; h?: number; radius?: number }) => (
    <div style={{
      width: w, height: h, borderRadius: radius,
      backgroundColor: 'var(--color-hairline)',
      animation: 'pulse 1.5s ease-in-out infinite',
    }} />
  );

  return (
    <>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>

      <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-canvas)' }}>
        {/* Nav skeleton */}
        <div style={{
          height: 64, borderBottom: '1px solid var(--color-hairline)',
          display: 'flex', alignItems: 'center', padding: '0 32px', gap: 16,
        }}>
          <Pulse w={60} h={18} />
          <div style={{ marginLeft: 24, display: 'flex', gap: 12 }}>
            {[80, 48, 52, 64].map((w, i) => <Pulse key={i} w={w} h={14} />)}
          </div>
        </div>

        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 32px', display: 'flex', flexDirection: 'column', gap: 28 }}>
          {/* Quality badge row skeleton */}
          <div style={{ display: 'flex', gap: 12 }}>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} style={{
                flex: 1, padding: '20px 24px', borderRadius: 'var(--radius-xl)',
                border: '1px solid var(--color-hairline)', display: 'flex', flexDirection: 'column', gap: 10,
              }}>
                <Pulse w={80} h={12} />
                <Pulse w={60} h={32} />
                <Pulse w={120} h={12} />
              </div>
            ))}
          </div>

          {/* Anomaly panel skeleton */}
          <div style={{
            borderRadius: 'var(--radius-xl)', border: '1px solid var(--color-hairline)',
            padding: 20, display: 'flex', flexDirection: 'column', gap: 12,
          }}>
            <Pulse w={140} h={14} />
            {[1, 2, 3].map((i) => <Pulse key={i} h={40} radius={8} />)}
          </div>

          {/* Table skeleton */}
          <div style={{
            borderRadius: 'var(--radius-xl)', border: '1px solid var(--color-hairline)', overflow: 'hidden',
          }}>
            <div style={{ padding: 12, backgroundColor: 'var(--color-canvas-soft)', borderBottom: '1px solid var(--color-hairline)' }}>
              <Pulse w={300} h={28} radius={14} />
            </div>
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} style={{
                padding: '12px 16px', display: 'flex', gap: 16, alignItems: 'center',
                borderBottom: '1px solid var(--color-hairline-soft)',
              }}>
                <Pulse w={140} h={13} />
                <Pulse w={40} h={18} radius={9} />
                <Pulse w={80} h={13} />
                <Pulse w={60} h={13} />
                <Pulse w={60} h={13} />
                <Pulse w={60} h={13} />
                <Pulse w={80} h={13} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
