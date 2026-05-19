'use client';

import { closeModal } from '@/lib/modal';
import { toast } from '@/lib/toast';

const MODAL_ID = 'broadcast-preview-modal';
const close = () => closeModal(MODAL_ID);

export default function BroadcastPreviewModal() {
  return (
    <div
      className="modal-bg"
      id={MODAL_ID}
      onClick={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      <div className="modal" style={{ maxWidth: '420px' }}>
        <div className="modal-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12" />
          </svg>
          <span data-i18n="modal_preview_title">Prévisualisation notification</span>
          <button className="modal-close" onClick={close}>✕</button>
        </div>
        {/* Phone mockup */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
          <div style={{ width: '260px', background: '#1a1a2e', borderRadius: '20px', padding: '16px', boxShadow: '0 8px 32px rgba(0,0,0,.3)' }}>
            <div style={{ background: '#fff', borderRadius: '12px', padding: '12px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '9px', background: '#0d1c28', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="18" height="16" viewBox="0 0 60 55" fill="none">
                  <path d="M30 5L55 27L50 27L50 50L35 50L35 36L25 36L25 50L10 50L10 27L5 27Z" stroke="#29B6F6" strokeWidth="3" fill="none" strokeLinejoin="round" />
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '.82rem', fontWeight: 700, color: '#0f172a' }} id="preview-notif-title">Maawa</div>
                <div style={{ fontSize: '.75rem', color: '#475569', marginTop: '2px', lineHeight: 1.4 }} id="preview-notif-body">Votre message apparaîtra ici…</div>
              </div>
              <div style={{ fontSize: '.65rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>À l'instant</div>
            </div>
            <div style={{ textAlign: 'center', marginTop: '10px', fontSize: '.65rem', color: 'rgba(255,255,255,.4)' }} data-i18n="preview_phone_hint">
              Aperçu push notification
            </div>
          </div>
        </div>
        <div style={{ background: 'var(--b50)', borderRadius: 'var(--rs)', padding: '10px 13px', fontSize: '.78rem', color: 'var(--text2)', marginBottom: '14px', border: '1px solid var(--b200)' }}>
          <strong data-i18n="preview_stats_title">Statistiques estimées :</strong><br />
          <span data-i18n="preview_reach">Portée estimée :</span> <strong>47 218</strong> utilisateurs<br />
          <span data-i18n="preview_open_rate">Taux d'ouverture moyen :</span> <strong>82%</strong>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={close} data-i18n="btn_close">Fermer</button>
          <button
            className="btn btn-primary"
            onClick={() => { close(); toast('📣 Diffusion envoyée à 47 218 utilisateurs !'); }}
            data-i18n="btn_send"
          >
            Envoyer maintenant
          </button>
        </div>
      </div>
    </div>
  );
}
