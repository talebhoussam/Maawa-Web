'use client';

import { closeModal, openModal } from '@/lib/modal';
import { toast } from '@/lib/toast';

const MODAL_ID = 'content-modal';
const close = () => closeModal(MODAL_ID);

export default function ContentModal() {
  return (
    <div
      className="modal-bg"
      id={MODAL_ID}
      onClick={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      <div className="modal" style={{ maxWidth: '620px' }}>
        <div className="modal-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
          <span data-i18n="modal_content_preview">Aperçu du contenu signalé</span>
          <button className="modal-close" onClick={close}>✕</button>
        </div>
        <div style={{ background: 'var(--surface2)', borderRadius: 'var(--rs)', padding: '14px 16px', marginBottom: '14px', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '10px' }}>
            <div className="avatar" style={{ background: 'var(--b500)', width: '32px', height: '32px', fontSize: '.64rem' }}>SM</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '.84rem' }}>@sofiane.m</div>
              <div style={{ fontSize: '.71rem', color: 'var(--text3)' }}>Reel · Il y a 18 min</div>
            </div>
            <span className="badge badge-red" style={{ marginLeft: 'auto' }}>⚠️ 85% IA</span>
          </div>
          <div style={{ background: 'linear-gradient(135deg,#1a1a2e,#16213e)', borderRadius: 'var(--rs)', height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem', position: 'relative', overflow: 'hidden' }}>
            📹
            <div style={{ position: 'absolute', bottom: '10px', left: '10px', color: '#fff', fontSize: '.75rem', fontWeight: 600, background: 'rgba(0,0,0,.5)', padding: '3px 8px', borderRadius: '50px' }}>
              Contenu trompeur signalé
            </div>
          </div>
          <div style={{ marginTop: '10px', fontSize: '.8rem', color: 'var(--text2)', lineHeight: 1.6 }}>
            "Reel présentant des before/after falsifiés avec photomontage — signalé par 3 utilisateurs. Score IA fraude: 85/100."
          </div>
        </div>
        <div className="form-group">
          <label className="label" data-i18n="mod_action">Action à appliquer</label>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button className="btn btn-ghost" onClick={() => { close(); toast('✅ Signalement ignoré — Contenu conservé'); }}>
              ✅ <span data-i18n="btn_ignore">Ignorer</span>
            </button>
            <button className="btn btn-orange" onClick={() => { close(); toast('⚠️ Avertissement envoyé à @sofiane.m'); }}>
              ⚠️ <span data-i18n="btn_warn">Avertir</span>
            </button>
            <button className="btn btn-red" onClick={() => { close(); toast('🗑️ Contenu supprimé définitivement'); }}>
              🗑️ <span data-i18n="btn_delete">Supprimer</span>
            </button>
            <button className="btn btn-primary" onClick={() => { close(); openModal('user-modal'); }}>
              👤 <span data-i18n="btn_see_profile">Voir profil</span>
            </button>
          </div>
        </div>
        <div className="modal-footer" style={{ justifyContent: 'flex-start', gap: '8px' }}>
          <div style={{ fontSize: '.75rem', color: 'var(--text3)' }}>
            <span data-i18n="mod_reporter">Signalé par</span>: <strong>3 utilisateurs</strong>
          </div>
        </div>
      </div>
    </div>
  );
}
