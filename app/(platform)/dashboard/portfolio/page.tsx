'use client';

import { toast } from '@/lib/toast';

export default function DashboardPortfolioPage() {
  return (
    <div className="screen on" id="s-aportfolio">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '15px', flexWrap: 'wrap', gap: '8px' }} className="au">
        <div>
          <div className="pg-title" id="t-port-title">Portfolio &amp; Reels</div>
          <div className="pg-sub" style={{ marginBottom: 0 }} id="t-port-sub">Partagez vos réalisations et boostez votre visibilité</div>
        </div>
        <button className="btn-primary" onClick={() => toast('📤 Publier')} id="t-add-btn">+ Ajouter</button>
      </div>

      <div className="mission-tabs au1">
        <button className="mt on" onClick={() => {}} id="t-all-tab">Tous (18)</button>
        <button className="mt" onClick={() => {}} id="t-reels-tab">📹 Reels (6)</button>
        <button className="mt" onClick={() => {}} id="t-photos-tab">🖼️ Photos (9)</button>
        <button className="mt" onClick={() => {}} id="t-ba-tab">↔️ Avant/Après (3)</button>
      </div>

      <div className="portfolio-grid au2">
        <div className="portf-thumb" style={{ background: 'linear-gradient(135deg,#b3e5fc,#0288d1)' }} onClick={() => toast('▶ 34k vues')}>
          🔧
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,.5)', padding: '5px', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '.62rem', color: '#fff', fontWeight: 600 }}>▶ 34k</span>
            <span style={{ background: 'var(--rd)', color: '#fff', fontSize: '.57rem', fontWeight: 700, padding: '1px 5px', borderRadius: '50px' }}>VIDEO</span>
          </div>
        </div>
        <div className="portf-thumb" style={{ background: 'linear-gradient(135deg,#d1fae5,#6ee7b7)' }} onClick={() => toast('📸 Avant/Après')}>↔️</div>
        <div className="portf-thumb" style={{ background: 'linear-gradient(135deg,#fef3c7,#fbbf24)' }} onClick={() => toast('📸')}>🚿</div>
        <div className="portf-thumb" style={{ background: 'linear-gradient(135deg,#cceaff,#29b5f6)' }} onClick={() => toast('📸')}>💧</div>
        <div className="portf-thumb" style={{ background: 'linear-gradient(135deg,#ede9fe,#c4b5fd)' }} onClick={() => toast('📸')}>🛁</div>
        <div className="portf-add-btn" onClick={() => toast('📤 Ajouter')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span id="t-add-portf">Ajouter</span>
        </div>
      </div>

      <div style={{ background: 'var(--b50)', border: '1.5px solid var(--b200)', borderRadius: 'var(--r)', padding: '13px' }} className="au3">
        <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: '.86rem', color: 'var(--b700)', marginBottom: '9px' }} id="t-boost-content">🚀 Booster votre contenu</div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '130px', background: 'var(--surface)', borderRadius: 'var(--rx)', padding: '10px', border: '1px solid var(--border)' }}>
            <div style={{ fontWeight: 600, fontSize: '.8rem', color: 'var(--text)', marginBottom: '2px' }} id="t-boost-reel-name">Boost Reel 24h</div>
            <div style={{ fontSize: '.7rem', color: 'var(--text3)', marginBottom: '7px' }} id="t-boost-reel-d">Mise en avant vidéo</div>
            <button className="btn-primary sm" onClick={() => toast('📹 Reel boosté — 20 MC')}>20 MC</button>
          </div>
          <div style={{ flex: 1, minWidth: '130px', background: 'var(--surface)', borderRadius: 'var(--rx)', padding: '10px', border: '1px solid var(--border)' }}>
            <div style={{ fontWeight: 600, fontSize: '.8rem', color: 'var(--text)', marginBottom: '2px' }} id="t-boost-prof-name">Boost Profil 7j</div>
            <div style={{ fontSize: '.7rem', color: 'var(--text3)', marginBottom: '7px' }} id="t-boost-prof-d">Top résultats recherche</div>
            <button className="btn-primary sm" onClick={() => toast('🚀 Profil boosté — 50 MC')}>50 MC</button>
          </div>
        </div>
      </div>
    </div>
  );
}
