'use client';

import { useRouter } from 'next/navigation';
import { WILAYAS } from '@/lib/wilayas';

const openTender = () => {
  if (typeof document === 'undefined') return;
  document.getElementById('tender-modal')?.classList.add('on');
};

export default function CatResultsPage() {
  const router = useRouter();
  return (
    <div className="screen on" id="s-cat-results">
      {/* Header */}
      <div className="page-title-row" style={{ marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button className="ib" onClick={() => router.push('/categories')} aria-label="Retour">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div>
            <div className="pt-head" id="cat-results-title">🔧 Plomberie</div>
            {/* Real-count placeholder: rendered by the result fetcher once
                it lands. The fake "1 247 artisans disponibles" was
                removed in Phase 2. */}
            <div style={{ fontSize: '.74rem', color: 'var(--text3)' }} id="cat-results-count"></div>
          </div>
        </div>
        <button className="btn-primary sm" onClick={openTender} id="t-cat-tender">📋 Appel d&apos;offres</button>
      </div>

      {/* Sort / Filter bar */}
      <div className="filter-strip" style={{ marginBottom: '12px' }} id="cat-sort-strip">
        <button className="fc on" onClick={() => {}} id="t-cat-sort-top">⭐ Mieux notés</button>
        <button className="fc" onClick={() => {}} id="t-cat-sort-fast">⚡ Réponse rapide</button>
        <button className="fc" onClick={() => {}} id="t-cat-sort-cheap">💰 Moins cher</button>
        <button className="fc" onClick={() => {}} id="t-cat-sort-miss">📋 Plus de missions</button>
        <button className="fc" onClick={() => {}} id="t-cat-sort-new">🌟 Nouveaux</button>
        <button className="fc" onClick={() => {}} id="t-cat-filter-nin">✓ NIN seul</button>
      </div>

      {/* Wilaya quick filter — full 58-wilaya list via the canonical
          source. The strip is horizontally scrollable so the row stays
          mobile-friendly. */}
      <div className="filter-strip" style={{ marginBottom: '14px' }} id="cat-wilaya-strip">
        <button className="fc on" onClick={() => {}} id="t-cat-w-all">📍 Toutes wilayas</button>
        {WILAYAS.map(w => (
          <button key={w.code} className="fc" onClick={() => {}}>{w.name}</button>
        ))}
      </div>

      {/* Results grid */}
      <div className="art-grid" id="cat-results-grid"></div>

      {/* Empty state */}
      <div id="cat-empty-state" style={{ display: 'none', textAlign: 'center', padding: '40px 20px' }}>
        <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🔍</div>
        <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: '1rem', color: 'var(--text)', marginBottom: '6px' }} id="t-cat-empty-title">Aucun artisan trouvé</div>
        <div style={{ fontSize: '.82rem', color: 'var(--text3)', marginBottom: '16px' }} id="t-cat-empty-sub">Essayez une autre wilaya ou lancez un appel d&apos;offres</div>
        <button className="btn-primary" onClick={openTender}>📋 Lancer un appel d&apos;offres</button>
      </div>

      {/* Load more */}
      <div style={{ textAlign: 'center', marginTop: '8px' }} id="cat-load-more-wrap">
        <button className="btn-outline" onClick={() => {}} id="t-cat-load-more">Charger plus →</button>
      </div>
    </div>
  );
}
