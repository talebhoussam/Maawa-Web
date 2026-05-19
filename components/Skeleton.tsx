'use client';

/** Skeleton card for mission/feed/notification loading states */
export function SkeletonCard({ lines = 2 }: { lines?: number }) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid rgba(255,255,255,.06)',
      borderRadius: 'var(--r)',
      padding: '14px 16px',
      marginBottom: '10px',
      animation: 'sk-pulse 1.4s ease-in-out infinite',
    }}>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(255,255,255,.07)', flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ height: '13px', background: 'rgba(255,255,255,.07)', borderRadius: '6px', marginBottom: '8px', width: '65%' }} />
          {Array.from({ length: lines }).map((_, i) => (
            <div key={i} style={{ height: '10px', background: 'rgba(255,255,255,.05)', borderRadius: '6px', marginBottom: '6px', width: i === lines - 1 ? '40%' : '90%' }} />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Full-page loading state with 3 skeleton cards */
export function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <>
      <style>{`
        @keyframes sk-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </>
  );
}
