'use client';

import { closeModal } from '@/lib/modal';
import { toast } from '@/lib/toast';

const MODAL_ID = 'user-modal';
const close = () => closeModal(MODAL_ID);

export default function UserModal() {
  return (
    <div className="modal-bg" id={MODAL_ID}>
      <div className="modal">
        <div className="modal-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--b500)" strokeWidth="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          <span id="modal-user-title">Profil Utilisateur</span>
          <button className="modal-close" onClick={close}>✕</button>
        </div>
        <div style={{ display: 'flex', gap: '14px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <div className="avatar" id="modal-user-av" style={{ width: '56px', height: '56px', fontSize: '.9rem', flexShrink: 0 }}>KP</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: '1rem', color: 'var(--text)' }} id="modal-user-name">Karim Plombier</div>
            <div style={{ fontSize: '.8rem', color: 'var(--text2)', marginTop: '2px' }} id="modal-user-email">karim@maawa.dz · #A-1042</div>
            <div style={{ display: 'flex', gap: '5px', marginTop: '6px' }}>
              <span className="badge badge-green">✓ NIN Vérifié</span>
              <span className="badge badge-green">● Actif</span>
              <span className="badge badge-blue">🔧 Artisan</span>
            </div>
          </div>
        </div>
        <div className="stat-row" style={{ marginBottom: '14px' }}>
          <div className="stat-mini"><div className="stat-mini-v">137</div><div className="stat-mini-l">Missions</div></div>
          <div className="stat-mini"><div className="stat-mini-v" style={{ color: 'var(--go)' }}>4.9★</div><div className="stat-mini-l">Note</div></div>
          <div className="stat-mini"><div className="stat-mini-v" style={{ color: 'var(--b500)' }}>350 MC</div><div className="stat-mini-l">Coins</div></div>
          <div className="stat-mini"><div className="stat-mini-v">12</div><div className="stat-mini-l">Ans exp.</div></div>
        </div>
        <div className="form-row">
          <div>
            <div className="label" data-i18n="user_joined">Inscrit le</div>
            <div style={{ fontSize: '.82rem', color: 'var(--text2)' }}>12 janvier 2024</div>
          </div>
          <div>
            <div className="label" data-i18n="user_last_login">Dernière connexion</div>
            <div style={{ fontSize: '.82rem', color: 'var(--text2)' }}>Aujourd'hui 14:21</div>
          </div>
        </div>
        <div className="form-group">
          <label className="label">Note interne</label>
          <textarea className="textarea" placeholder="Note visible seulement par les admins…" data-i18n-ph="user_modal_note_ph" />
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={close}>Fermer</button>
          <button className="btn btn-orange" onClick={() => { toast('⚠️ Compte suspendu 24h'); close(); }}>Suspendre 24h</button>
          <button className="btn btn-red" onClick={() => { toast('🚫 Compte banni'); close(); }}>Bannir</button>
          <button className="btn btn-primary" onClick={() => { toast('✉️ Email envoyé'); close(); }}>Contacter</button>
        </div>
      </div>
    </div>
  );
}
