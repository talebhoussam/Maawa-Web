'use client';

import { closeModal } from '@/lib/modal';
import { toast } from '@/lib/toast';

const MODAL_ID = 'payout-confirm-modal';
const close = () => closeModal(MODAL_ID);

export default function PayoutConfirmModal() {
  return (
    <div
      className="modal-bg"
      id={MODAL_ID}
      onClick={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      <div className="modal" style={{ maxWidth: '440px' }}>
        <div className="modal-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--gn)" strokeWidth="2">
            <rect x="1" y="4" width="22" height="16" rx="2" />
            <line x1="1" y1="10" x2="23" y2="10" />
          </svg>
          <span data-i18n="modal_payout_title">Confirmer le paiement</span>
          <button className="modal-close" onClick={close}>✕</button>
        </div>
        <div style={{ background: 'var(--gl)', borderRadius: 'var(--rs)', padding: '13px', marginBottom: '14px', border: '1px solid rgba(16,185,129,.3)' }}>
          <div style={{ fontSize: '.8rem', color: 'var(--text2)', lineHeight: 1.7 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span data-i18n="payout_artisan">Artisan</span>
              <strong id="payout-artisan-name">Karim Plombier</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span data-i18n="payout_amount">Montant</span>
              <strong style={{ color: 'var(--gn)', fontFamily: "'Sora',sans-serif", fontSize: '.95rem' }} id="payout-amount">84 500 DZD</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span data-i18n="payout_method">Méthode</span>
              <span id="payout-method">CCP</span>
            </div>
          </div>
        </div>
        <div style={{ fontSize: '.8rem', color: 'var(--text2)', lineHeight: 1.65, marginBottom: '14px' }} data-i18n="payout_warning">
          ⚠️ Cette action est irréversible. Le montant sera transféré directement au compte de l'artisan sous 24–72h.
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={close} data-i18n="btn_cancel">Annuler</button>
          <button
            className="btn btn-green"
            onClick={() => {
              close();
              const amt = (typeof document !== 'undefined' && document.getElementById('payout-amount')?.textContent) || '84 500 DZD';
              toast('✅ Paiement de ' + amt + ' approuvé — Virement lancé !');
            }}
          >
            ✓ <span data-i18n="btn_confirm_pay">Confirmer le paiement</span>
          </button>
        </div>
      </div>
    </div>
  );
}
