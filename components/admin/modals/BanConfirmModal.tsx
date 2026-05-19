'use client';

import { useState } from 'react';
import { closeModal } from '@/lib/modal';
import { toast } from '@/lib/toast';

const MODAL_ID = 'ban-confirm-modal';
const close = () => closeModal(MODAL_ID);

export default function BanConfirmModal() {
  const [reason, setReason] = useState('');

  return (
    <div
      className="modal-bg"
      id={MODAL_ID}
      onClick={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      <div className="modal" style={{ maxWidth: '420px' }}>
        <div className="modal-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--rd)" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
          </svg>
          <span data-i18n="modal_ban_title">Bannir l'utilisateur</span>
          <button className="modal-close" onClick={close}>✕</button>
        </div>
        <div style={{ background: 'var(--rl)', borderRadius: 'var(--rs)', padding: '11px 13px', marginBottom: '14px', borderLeft: '3px solid var(--rd)' }}>
          <div style={{ fontSize: '.8rem', fontWeight: 600, color: 'var(--rd)' }} data-i18n="ban_warning_title">⚠️ Action irréversible</div>
          <div style={{ fontSize: '.77rem', color: 'var(--text2)', marginTop: '3px' }} data-i18n="ban_warning_desc">
            L'utilisateur sera banni définitivement et ne pourra plus créer de compte avec cette identité.
          </div>
        </div>
        <div className="form-group">
          <label className="label" data-i18n="ban_reason_label">Raison du bannissement *</label>
          <select
            className="select"
            id="ban-reason-select"
            style={{ width: '100%' }}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          >
            <option value="" data-i18n="select_reason">— Sélectionner —</option>
            <option data-i18n="ban_fraud">Fraude avérée</option>
            <option data-i18n="ban_fake">Faux profil / Usurpation d'identité</option>
            <option data-i18n="ban_abuse">Comportement abusif répété</option>
            <option data-i18n="ban_scam">Arnaque / Escroquerie</option>
            <option data-i18n="ban_illegal">Contenu illégal</option>
          </select>
        </div>
        <div className="form-group">
          <label className="label" data-i18n="ban_note_label">Note interne (optionnel)</label>
          <textarea className="textarea" id="ban-note" rows={2} data-i18n-ph="ban_note_ph" placeholder="Détails supplémentaires pour l'audit…" />
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={close} data-i18n="btn_cancel">Annuler</button>
          <button
            className="btn btn-red"
            onClick={() => {
              if (!reason) { toast('⚠️ Sélectionnez une raison'); return; }
              close();
              toast('🚫 Compte banni définitivement — Email de notification envoyé');
            }}
          >
            🚫 <span data-i18n="btn_ban_confirm">Bannir définitivement</span>
          </button>
        </div>
      </div>
    </div>
  );
}
