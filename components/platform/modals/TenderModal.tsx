'use client';

import { WILAYAS, displayLabel } from '@/lib/wilayas';

const closeTender = () => {
  if (typeof document === 'undefined') return;
  document.getElementById('tender-modal')?.classList.remove('on');
};

export default function TenderModal() {
  return (
    <div className="modal-bg" id="tender-modal" onClick={(e) => { if (e.target === e.currentTarget) closeTender(); }}>
      <div className="modal-box" style={{ maxWidth: '520px' }}>
        <div className="modal-header">
          <div className="modal-title" id="t-tender-modal-title">📋 Maawa Tender — Appel d'offres</div>
          <button className="modal-close" onClick={closeTender}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
        <div style={{ fontSize: '.82rem', color: 'var(--text2)', lineHeight: 1.65, marginBottom: '14px' }} id="t-tender-modal-desc">
          Décrivez votre projet et recevez plusieurs devis d'artisans vérifiés. Comparez, choisissez, et payez en toute sécurité via Maawa SafePay.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '11px' }}>
          <div className="fg2">
            <label className="qf-label" id="t-tender-svc">Service requis *</label>
            <select className="qf-select" id="tender-svc-select" defaultValue="">
              <option value="">-- Choisir un métier --</option>
              <option>🔧 Plomberie</option><option>⚡ Électricité</option>
              <option>🎨 Peinture & Déco</option><option>🧱 Maçonnerie</option>
              <option>🪚 Menuiserie</option><option>🏠 Carrelage</option>
              <option>❄️ Climatisation</option><option>🌿 Jardinage</option>
            </select>
          </div>
          <div className="fg2">
            <label className="qf-label" id="t-tender-desc-lbl">Description du projet *</label>
            <textarea className="qf-textarea" id="tender-desc" style={{ minHeight: '90px' }} placeholder="Décrivez précisément vos travaux, dimensions, matériaux souhaités…" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div className="fg2">
              <label className="qf-label" id="t-tender-wil">Wilaya *</label>
              <select className="qf-select" id="tender-wilaya" defaultValue="16 - Alger">
                {WILAYAS.map(w => (
                  <option key={w.code} value={displayLabel(w)}>{displayLabel(w)}</option>
                ))}
              </select>
            </div>
            <div className="fg2">
              <label className="qf-label" id="t-tender-budget">Budget estimé</label>
              <select className="qf-select" id="tender-budget" defaultValue="Pas de contrainte">
                <option>Pas de contrainte</option>
                <option>&lt; 10 000 DZD</option><option>10K – 30K DZD</option>
                <option>30K – 80K DZD</option><option>&gt; 80K DZD</option>
              </select>
            </div>
          </div>
          <div className="fg2">
            <label className="qf-label" id="t-tender-deadline">Délai souhaité</label>
            <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap' }}>
              <button className="bk-t sel" onClick={() => {}} id="t-td-urgent">🚨 Urgent (24h)</button>
              <button className="bk-t" onClick={() => {}} id="t-td-week">📅 Cette semaine</button>
              <button className="bk-t" onClick={() => {}} id="t-td-month">🗓️ Ce mois</button>
              <button className="bk-t" onClick={() => {}} id="t-td-flex">✨ Flexible</button>
            </div>
          </div>
          <div style={{ background: 'var(--gl)', borderRadius: 'var(--rx)', padding: '9px 12px', fontSize: '.75rem', color: 'var(--text2)', lineHeight: 1.6, display: 'flex', gap: '7px', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '1rem' }}>🔒</span>
            <span id="t-tender-safepay-note">Votre paiement sera sécurisé via <strong>Maawa SafePay</strong>. Aucun versement avant validation de vos travaux.</span>
          </div>
          <button className="btn-primary" style={{ width: '100%', justifyContent: 'center', fontSize: '.9rem' }} onClick={() => {}} id="t-tender-submit">
            📤 Publier mon appel d'offres
          </button>
        </div>
      </div>
    </div>
  );
}
