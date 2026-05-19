'use client';

import { closeModal } from '@/lib/modal';
import { toast } from '@/lib/toast';

const MODAL_ID = 'mission-modal';
const close = () => closeModal(MODAL_ID);

export default function MissionModal() {
  return (
    <div className="modal-bg" id={MODAL_ID}>
      <div className="modal" style={{ maxWidth: '600px' }}>
        <div className="modal-title">
          📋 Mission #MW-4821
          <button className="modal-close" onClick={close}>✕</button>
        </div>
        <div className="stat-row" style={{ marginBottom: '14px' }}>
          <div className="stat-mini"><div className="stat-mini-v" style={{ color: 'var(--b500)' }}>9 500</div><div className="stat-mini-l">DZD Total</div></div>
          <div className="stat-mini"><div className="stat-mini-v" style={{ color: 'var(--gn)' }}>950</div><div className="stat-mini-l">DZD Commission</div></div>
          <div className="stat-mini"><div className="stat-mini-v" style={{ color: 'var(--or)' }}>8 550</div><div className="stat-mini-l">DZD Artisan</div></div>
        </div>
        <div className="form-row">
          <div>
            <div className="label">Client</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginTop: '4px' }}>
              <div className="avatar av4" style={{ width: '26px', height: '26px', fontSize: '.62rem' }}>YO</div>
              <div>
                <div style={{ fontSize: '.82rem', fontWeight: 600, color: 'var(--text)' }}>Youssef Omar</div>
                <div style={{ fontSize: '.69rem', color: 'var(--text3)' }}>#C-8812</div>
              </div>
            </div>
          </div>
          <div>
            <div className="label">Artisan</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginTop: '4px' }}>
              <div className="avatar av1" style={{ width: '26px', height: '26px', fontSize: '.62rem' }}>KP</div>
              <div>
                <div style={{ fontSize: '.82rem', fontWeight: 600, color: 'var(--text)' }}>Karim Plombier</div>
                <div style={{ fontSize: '.69rem', color: 'var(--text3)' }}>#A-1042</div>
              </div>
            </div>
          </div>
        </div>
        <div style={{ background: 'var(--surface2)', borderRadius: 'var(--rs)', padding: '12px', margin: '12px 0', border: '1px solid var(--border)' }}>
          <div className="label">Description de la mission</div>
          <div style={{ fontSize: '.82rem', color: 'var(--text2)', lineHeight: 1.65, marginTop: '4px' }}>
            Réparation fuite salle de bain · F4 · 3ème étage · Bab Ezzouar, Alger. Fuite sous lavabo + remplacement joint mitigeur.
          </div>
        </div>
        <div className="form-row">
          <div>
            <div className="label">Créée le</div>
            <div style={{ fontSize: '.82rem', color: 'var(--text2)' }}>24/03/2026 à 14:15</div>
          </div>
          <div>
            <div className="label">Statut actuel</div>
            <span className="badge badge-blue" style={{ marginTop: '4px' }}>🔧 Sur place</span>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={close}>Fermer</button>
          <button className="btn btn-orange" onClick={() => { toast('⚠️ Litige ouvert sur cette mission'); close(); }}>Ouvrir litige</button>
          <button className="btn btn-red" onClick={() => { toast('❌ Mission annulée — Remboursement initié'); close(); }}>Annuler &amp; Rembourser</button>
          <button className="btn btn-green" onClick={() => { toast('✅ Mission marquée terminée — SafePay libéré'); close(); }}>Forcer fin &amp; Libérer</button>
        </div>
      </div>
    </div>
  );
}
