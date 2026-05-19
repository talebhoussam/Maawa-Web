'use client';

import { closeModal } from '@/lib/modal';
import { toast } from '@/lib/toast';

const MODAL_ID = 'nin-modal';
const close = () => closeModal(MODAL_ID);

export default function NinModal() {
  return (
    <div className="modal-bg" id={MODAL_ID}>
      <div className="modal" style={{ maxWidth: '640px' }}>
        <div className="modal-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--b500)" strokeWidth="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <span id="nin-modal-title">Vérification NIN — Yacine Mabrouk</span>
          <button className="modal-close" onClick={close}>✕</button>
        </div>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '14px', flexWrap: 'wrap' }}>
          <div>
            <div className="label">Métier déclaré</div>
            <div style={{ fontSize: '.84rem', fontWeight: 600, color: 'var(--text)' }} id="nin-trade">⚡ Électricien · Tizi Ouzou</div>
          </div>
          <div>
            <div className="label">Score fraude IA</div>
            <div id="nin-score-val" style={{ fontSize: '.84rem', fontWeight: 700, color: 'var(--gn)' }}>8 / 100 ✅ Faible risque</div>
          </div>
          <div>
            <div className="label">Numéro NIN</div>
            <div style={{ fontSize: '.84rem', fontWeight: 600, color: 'var(--text)' }}>19XX XXXX XXXX XX</div>
          </div>
        </div>
        <div className="score-bar">
          <div className="label" style={{ minWidth: '100px' }}>Risque fraude</div>
          <div className="score-track">
            <div className="score-fill" id="nin-score-bar" style={{ width: '8%', background: 'var(--gn)' }}></div>
          </div>
          <div id="nin-score-num" style={{ fontSize: '.78rem', fontWeight: 700, color: 'var(--gn)', minWidth: '50px', textAlign: 'right' }}>8%</div>
        </div>
        <div className="doc-viewer">
          <div className="doc-box" onClick={() => toast('🔍 CNI Recto en plein écran')}>
            <div className="doc-emoji">📄</div>
            <div className="doc-lbl">CNI RECTO</div>
            <div style={{ fontSize: '.65rem', color: 'var(--text3)' }}>Cliquer pour agrandir</div>
          </div>
          <div className="doc-box" onClick={() => toast('🔍 CNI Verso en plein écran')}>
            <div className="doc-emoji">📄</div>
            <div className="doc-lbl">CNI VERSO</div>
            <div style={{ fontSize: '.65rem', color: 'var(--text3)' }}>Cliquer pour agrandir</div>
          </div>
          <div className="doc-box" onClick={() => toast('🔍 Selfie en plein écran')}>
            <div className="doc-emoji">🤳</div>
            <div className="doc-lbl">SELFIE</div>
            <div style={{ fontSize: '.65rem', color: 'var(--text3)' }}>Cliquer pour agrandir</div>
          </div>
          <div className="doc-box" style={{ background: 'var(--gl)', borderColor: 'var(--gn)' }}>
            <div style={{ fontSize: '1.2rem' }}>✅</div>
            <div className="doc-lbl" style={{ color: 'var(--gn)' }}>CORRESPONDANCE</div>
            <div style={{ fontSize: '.65rem', color: 'var(--gn)', fontWeight: 600 }}>Visage détecté · 92%</div>
          </div>
        </div>
        <div className="form-group">
          <label className="label">Raison du rejet (optionnel)</label>
          <select className="select" style={{ width: '100%' }} defaultValue="">
            <option value="">— Sélectionner une raison —</option>
            <option>Documents illisibles</option>
            <option>NIN non correspondant</option>
            <option>Selfie non conforme</option>
            <option>Documents expirés</option>
            <option>Suspicion de fraude</option>
          </select>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={close}>Annuler</button>
          <button className="btn btn-red" onClick={() => { toast("❌ NIN Rejeté — Email envoyé à l'artisan"); close(); }}>Rejeter</button>
          <button className="btn btn-orange" onClick={() => { toast('📋 Dossier transféré en vérification manuelle'); close(); }}>Vérif. manuelle</button>
          <button className="btn btn-green" onClick={() => { toast('✅ NIN Approuvé ! Artisan notifié 🎉'); close(); }}>Approuver ✓</button>
        </div>
      </div>
    </div>
  );
}
