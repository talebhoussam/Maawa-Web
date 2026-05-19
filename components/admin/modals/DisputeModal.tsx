'use client';

import { useState } from 'react';
import { closeModal } from '@/lib/modal';
import { toast } from '@/lib/toast';

const MODAL_ID = 'dispute-modal';
const close = () => closeModal(MODAL_ID);

export default function DisputeModal() {
  const [decision, setDecision] = useState('');

  return (
    <div className="modal-bg" id={MODAL_ID}>
      <div className="modal" style={{ maxWidth: '600px' }}>
        <div className="modal-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--rd)" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <span id="dispute-title">Litige #D-2041</span>
          <button className="modal-close" onClick={close}>✕</button>
        </div>
        <div style={{ background: 'var(--rl)', borderRadius: 'var(--rs)', padding: '11px 13px', marginBottom: '14px', borderLeft: '3px solid var(--rd)' }}>
          <div style={{ fontSize: '.79rem', fontWeight: 600, color: 'var(--rd)' }}>⚠️ Escaladé au niveau légal</div>
          <div style={{ fontSize: '.74rem', color: 'var(--text2)', marginTop: '3px' }}>Mission #MW-4799 · 42 000 DZD bloqué en escrow · Ouvert il y a 2 jours</div>
        </div>
        <div className="form-row" style={{ marginBottom: '14px' }}>
          <div style={{ background: 'var(--surface2)', borderRadius: 'var(--rs)', padding: '11px', border: '1px solid var(--border)' }}>
            <div className="label" style={{ color: 'var(--b500)' }}>🧑 Client</div>
            <div style={{ fontSize: '.82rem', fontWeight: 600, color: 'var(--text)' }}>Ahmed Benali</div>
            <div style={{ fontSize: '.76rem', color: 'var(--text3)', marginTop: '4px', lineHeight: 1.5 }}>
              "Le maçon n'a pas fini les travaux, il manque l'enduit sur un mur entier. Refus de revenir."
            </div>
          </div>
          <div style={{ background: 'var(--surface2)', borderRadius: 'var(--rs)', padding: '11px', border: '1px solid var(--border)' }}>
            <div className="label" style={{ color: 'var(--or)' }}>🔧 Artisan</div>
            <div style={{ fontSize: '.82rem', fontWeight: 600, color: 'var(--text)' }}>Omar Farhat</div>
            <div style={{ fontSize: '.76rem', color: 'var(--text3)', marginTop: '4px', lineHeight: 1.5 }}>
              "Les travaux sont terminés comme demandé. Le client change ses exigences en cours de route."
            </div>
          </div>
        </div>
        <div className="form-group">
          <label className="label" data-i18n="dispute_mediator_decision">Décision du médiateur</label>
          <select className="select" style={{ width: '100%' }} value={decision} onChange={(e) => setDecision(e.target.value)}>
            <option value="">— Choisir une résolution —</option>
            <option value="full_client" data-i18n="dispute_full_client">Remboursement total → Client</option>
            <option value="full_artisan" data-i18n="dispute_full_artisan">Paiement total → Artisan</option>
            <option value="split" data-i18n="dispute_split">Partage 50/50</option>
            <option value="custom" data-i18n="dispute_custom">Montant personnalisé</option>
            <option value="legal" data-i18n="dispute_legal">Escalader au légal</option>
          </select>
        </div>
        <div id="custom-amount" style={{ display: decision === 'custom' ? 'block' : 'none' }} className="form-group">
          <label className="label" data-i18n="dispute_custom_amount">Montant artisan (DZD)</label>
          <input className="input" type="number" defaultValue={21000} style={{ width: '180px' }} />
          <span style={{ fontSize: '.78rem', color: 'var(--text3)', marginLeft: '8px' }}>/ 42 000 DZD total</span>
        </div>
        <div className="form-group">
          <label className="label" data-i18n="dispute_note">Note de médiation (interne)</label>
          <textarea className="textarea" placeholder="Expliquer la décision pour l'historique…" />
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={close}>Annuler</button>
          <button className="btn btn-primary" onClick={() => { toast('⚖️ Décision appliquée — Les deux parties notifiées'); close(); }}>Appliquer la décision</button>
        </div>
      </div>
    </div>
  );
}
