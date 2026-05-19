'use client';

import { closeModal, openModal } from '@/lib/modal';
import { toast } from '@/lib/toast';

const MODAL_ID = 'booking-detail-modal';
const close = () => closeModal(MODAL_ID);

export default function BookingDetailModal() {
  return (
    <div className="modal-bg" id={MODAL_ID}>
      <div className="modal" style={{ maxWidth: '520px' }}>
        <div className="modal-title">
          📅 Réservation <span id="bk-detail-id">#BK-2891</span>
          <button className="modal-close" onClick={close}>✕</button>
        </div>
        <div className="stat-row" style={{ marginBottom: '14px' }}>
          <div className="stat-mini">
            <div className="stat-mini-v" style={{ color: 'var(--b500)' }} id="bk-detail-client">Client</div>
            <div className="stat-mini-l">Client</div>
          </div>
          <div className="stat-mini">
            <div className="stat-mini-v" style={{ color: 'var(--or)' }}>🏠 Carrelage</div>
            <div className="stat-mini-l">Service</div>
          </div>
          <div className="stat-mini">
            <div className="stat-mini-v" style={{ color: 'var(--gn)' }}>18 500 DZD</div>
            <div className="stat-mini-l">Montant estimé</div>
          </div>
        </div>
        <div style={{ background: 'var(--surface2)', borderRadius: 'var(--rs)', padding: '12px 14px', marginBottom: '12px', border: '1px solid var(--border)' }}>
          <label className="label" style={{ marginBottom: '5px' }}>Description</label>
          <div style={{ fontSize: '.82rem', color: 'var(--text2)', lineHeight: 1.65 }}>
            Carrelage fissuré dans la salle de bain principale (4m²). Remplacement urgent avant visite de locataires.
          </div>
        </div>
        <div className="form-row">
          <div>
            <label className="label">Adresse</label>
            <div style={{ fontSize: '.82rem', color: 'var(--text2)', marginTop: '3px' }}>Cité des Fleurs, Bât. B, Alger-Centre</div>
          </div>
          <div>
            <label className="label">Date souhaitée</label>
            <div style={{ fontSize: '.82rem', color: 'var(--text2)', marginTop: '3px' }}>Aujourd'hui 15:00</div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={close}>Fermer</button>
          <button className="btn btn-red" onClick={() => { toast('❌ Réservation annulée'); close(); }}>Annuler</button>
          <button className="btn btn-primary" onClick={() => { close(); setTimeout(() => openModal('assign-modal'), 100); }}>🔧 Assigner un artisan</button>
        </div>
      </div>
    </div>
  );
}
