'use client';

import { closeModal } from '@/lib/modal';
import { toast } from '@/lib/toast';

const MODAL_ID = 'reject-app-modal';
const close = () => closeModal(MODAL_ID);

export default function RejectAppModal() {
  return (
    <div className="modal-bg" id={MODAL_ID}>
      <div className="modal" style={{ maxWidth: '440px' }}>
        <div className="modal-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--rd)" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          Rejeter — <span id="reject-app-name">Artisan</span>
          <button className="modal-close" onClick={close}>✕</button>
        </div>
        <div className="form-group">
          <label className="label">Raison du rejet *</label>
          <select className="select" style={{ width: '100%' }} defaultValue="— Sélectionner —">
            <option>— Sélectionner —</option>
            <option>Documents illisibles ou incomplets</option>
            <option>NIN non correspondant à l'identité</option>
            <option>Selfie de vérification non conforme</option>
            <option>Documents expirés</option>
            <option>Suspicion de fraude (score IA élevé)</option>
            <option>Métier non disponible dans cette wilaya</option>
            <option>Informations incomplètes</option>
          </select>
        </div>
        <div className="form-group">
          <label className="label">Message à l'artisan (optionnel)</label>
          <textarea className="textarea" placeholder="Corrections à apporter pour une nouvelle candidature…" style={{ height: '80px' }} />
        </div>
        <div style={{ background: 'var(--gol)', borderRadius: 'var(--rs)', padding: '9px 12px', marginBottom: '14px', fontSize: '.76rem', color: 'var(--text2)' }}>
          📧 Un email automatique sera envoyé avec la raison du rejet.
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={close}>Annuler</button>
          <button className="btn btn-red" onClick={() => { toast('✕ Candidature rejetée — Email envoyé'); close(); }}>✕ Confirmer le rejet</button>
        </div>
      </div>
    </div>
  );
}
