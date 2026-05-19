'use client';

import { useRouter } from 'next/navigation';

export default function NotFound() {
  const router = useRouter();

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: '100vh',
      background: 'linear-gradient(160deg, #05101a 0%, #071a2b 60%, #0c2540 100%)',
      fontFamily: "'Sora', 'Inter', sans-serif", textAlign: 'center', padding: '30px',
      gap: '0',
    }}>
      {/* Animated logo */}
      <div style={{ marginBottom: '24px', position: 'relative' }}>
        <div style={{
          width: '80px', height: '80px', borderRadius: '22px',
          background: 'linear-gradient(135deg, rgba(41,182,246,.15), rgba(41,182,246,.05))',
          border: '1px solid rgba(41,182,246,.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px',
          boxShadow: '0 0 40px rgba(41,182,246,.15)',
        }}>
          <svg width="40" height="36" viewBox="0 0 60 55" fill="none">
            <path d="M30 5L55 27L50 27L50 50L35 50L35 36L25 36L25 50L10 50L10 27L5 27Z" stroke="#29B6F6" strokeWidth="3" fill="none" strokeLinejoin="round" />
            <path d="M18 42L18 22L30 34L42 22L42 42" stroke="#29B6F6" strokeWidth="3" fill="none" strokeLinecap="round" />
            <path d="M10 50Q30 60 50 50" stroke="#29B6F6" strokeWidth="2.2" fill="none" strokeLinecap="round" />
          </svg>
        </div>
        <div style={{ fontSize: '5rem', lineHeight: 1, fontWeight: 900, color: 'transparent', backgroundClip: 'text', WebkitBackgroundClip: 'text', backgroundImage: 'linear-gradient(135deg,#29B6F6,#0277BD)', letterSpacing: '-4px' }}>
          404
        </div>
      </div>

      <div style={{ fontWeight: 800, fontSize: '1.3rem', color: '#fff', marginBottom: '8px' }}>
        Page introuvable
      </div>
      <div style={{ fontSize: '.88rem', color: 'rgba(255,255,255,.55)', maxWidth: '280px', lineHeight: 1.7, marginBottom: '28px' }}>
        Cette page n'existe pas ou a été déplacée. Revenez à l'accueil Maawa.
      </div>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
        <button
          onClick={() => router.push('/feed')}
          style={{
            padding: '11px 22px', background: 'linear-gradient(135deg,#29B6F6,#0277BD)',
            color: '#fff', border: 'none', borderRadius: '50px',
            fontWeight: 700, fontSize: '.88rem', cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(41,182,246,.3)',
            fontFamily: "'Sora',sans-serif",
          }}
        >
          🏠 Retour à l'accueil
        </button>
        <button
          onClick={() => router.back()}
          style={{
            padding: '11px 22px', background: 'rgba(255,255,255,.08)',
            color: 'rgba(255,255,255,.8)', border: '1px solid rgba(255,255,255,.15)',
            borderRadius: '50px', fontWeight: 600, fontSize: '.88rem',
            cursor: 'pointer', fontFamily: "'Sora',sans-serif",
          }}
        >
          ← Page précédente
        </button>
      </div>

      <div style={{ marginTop: '40px', fontSize: '.72rem', color: 'rgba(255,255,255,.25)' }}>
        © 2026 Maawa · ustal.dev 🇩🇿
      </div>
    </div>
  );
}
