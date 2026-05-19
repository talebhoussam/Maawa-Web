'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const callMaawa = () => {
  if (typeof window !== 'undefined') {
    window.location.href = process.env.NEXT_PUBLIC_SUPPORT_PHONE
      ? `tel:${process.env.NEXT_PUBLIC_SUPPORT_PHONE}`
      : 'tel:+213233000000';
  }
};

interface Stats {
  artisans: number;
  clients: number;
  threshold: number;
}

/**
 * Landing stats hook. Fetches /api/public/stats once on mount.
 *
 * Returns null while loading or on error, so the UI can fall back to
 * qualitative copy without showing zeros to anonymous visitors.
 */
function usePublicStats(): Stats | null {
  const [stats, setStats] = useState<Stats | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/public/stats')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (!cancelled && d) setStats(d); })
      .catch(() => { /* silent — fall back to qualitative copy */ });
    return () => { cancelled = true; };
  }, []);
  return stats;
}

export default function AuthLanding() {
  const router = useRouter();
  const stats = usePublicStats();

  /* Show a number only if it clears the credibility threshold. Below that,
     showing "3 artisans" looks worse than showing nothing. The 58-wilayas
     stat is a static administrative fact, not user data — always shown. */
  const showArtisans = stats && stats.artisans >= stats.threshold;
  const showClients  = stats && stats.clients  >= stats.threshold;
  const fmt = (n: number) => n >= 1000 ? `${Math.floor(n / 1000)}K+` : `${n}`;

  return (
    <div id="v-land" className="landing au">
      <div className="land-h" id="t-tagline">
        La plateforme <em>artisanale</em><br />de référence en Algérie 🇩🇿
      </div>
      <div className="land-s" id="t-desc">
        Connectez-vous avec des artisans vérifiés NIN, suivez vos chantiers en temps réel et payez en toute sécurité avec{' '}
        <strong style={{ color: 'var(--b300)' }}>Maawa SafePay</strong>.
      </div>
      <div className="land-stats">
        {showArtisans ? (
          <div className="lst">
            <div className="lst-v">{fmt(stats.artisans)}</div>
            <div className="lst-l" id="t-s-artisans">Artisans</div>
          </div>
        ) : (
          /* Below threshold or stats failed to load: qualitative copy.
             Two adjacent tiles for visual balance — verified + nationwide. */
          <div className="lst">
            <div className="lst-v" style={{ fontSize: '1.4rem' }}>✓</div>
            <div className="lst-l">Artisans vérifiés</div>
          </div>
        )}
        {showClients ? (
          <div className="lst">
            <div className="lst-v">{fmt(stats.clients)}</div>
            <div className="lst-l" id="t-s-clients">Clients</div>
          </div>
        ) : (
          <div className="lst">
            <div className="lst-v" style={{ fontSize: '1.4rem' }}>🇩🇿</div>
            <div className="lst-l">Partout en Algérie</div>
          </div>
        )}
        {/* 58 wilayas — administrative fact, always real. */}
        <div className="lst">
          <div className="lst-v">58</div>
          <div className="lst-l" id="t-s-wilayas">Wilayas</div>
        </div>
        <div className="lst">
          <div className="lst-v" style={{ fontSize: '1.4rem' }}>🔒</div>
          <div className="lst-l">SafePay</div>
        </div>
      </div>
      <div className="land-cta">
        <button className="btn-land-w" id="t-btn-create" onClick={() => router.push('/register')}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <line x1="19" y1="8" x2="19" y2="14" />
            <line x1="22" y1="11" x2="16" y2="11" />
          </svg>
          <span>Créer un compte gratuit</span>
        </button>
        <button className="btn-land-g" id="t-btn-login" onClick={() => router.push('/login')}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
            <polyline points="10 17 15 12 10 7" />
            <line x1="15" y1="12" x2="3" y2="12" />
          </svg>
          <span>Se connecter</span>
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '2px 0' }}>
          <div style={{ height: '1px', flex: 1, background: 'rgba(255,255,255,.16)' }}></div>
          <span style={{ fontSize: '.71rem', color: 'rgba(255,255,255,.4)' }} id="t-or-land">ou</span>
          <div style={{ height: '1px', flex: 1, background: 'rgba(255,255,255,.16)' }}></div>
        </div>
        <button className="btn-land-call" onClick={callMaawa}>
          <div className="call-dot"></div>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.62 3.38C1.62 2.18 2.53 1 3.72 1h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
          </svg>
          <span id="t-btn-call">📞 Appeler Maawa directement</span>
        </button>
      </div>
      <div className="land-footer">
        <span id="t-already">Déjà un compte ?</span>{' '}
        <a id="t-signin-link" onClick={() => router.push('/login')}>Se connecter →</a>
      </div>
      <div className="land-trust">
        <div className="lt" id="t-trust1">🔒 Paiement sécurisé</div>
        <div className="lt" id="t-trust2">✅ Artisans vérifiés NIN</div>
        <div className="lt" id="t-trust3">⚖️ Médiation Maawa</div>
      </div>
    </div>
  );
}
