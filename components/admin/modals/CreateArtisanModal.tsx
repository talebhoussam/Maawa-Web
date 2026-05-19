'use client';

import { closeModal } from '@/lib/modal';
import { toast } from '@/lib/toast';

const MODAL_ID = 'create-artisan-modal';
const close = () => closeModal(MODAL_ID);

export default function CreateArtisanModal() {
  return (
    <div className="modal-bg" id={MODAL_ID}>
      <div className="modal" style={{ maxWidth: '520px' }}>
        <div className="modal-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--or)" strokeWidth="2">
            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="8.5" cy="7" r="4" />
            <line x1="20" y1="8" x2="20" y2="14" />
            <line x1="23" y1="11" x2="17" y2="11" />
          </svg>
          Créer un compte Artisan
          <button className="modal-close" onClick={close}>✕</button>
        </div>
        <div style={{ background: 'var(--ol)', borderLeft: '3px solid var(--or)', borderRadius: 'var(--rs)', padding: '9px 13px', marginBottom: '14px', fontSize: '.77rem', color: 'var(--text2)' }}>
          ⚙️ Création directe d'un artisan vérifié, sans processus de candidature standard.
        </div>
        <div className="form-row">
          <div className="form-group"><label className="label">Prénom *</label><input className="input" type="text" placeholder="Ahmed" style={{ width: '100%' }} /></div>
          <div className="form-group"><label className="label">Nom *</label><input className="input" type="text" placeholder="Benali" style={{ width: '100%' }} /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label className="label">Téléphone *</label><input className="input" type="tel" placeholder="+213 6XX XXX XXX" style={{ width: '100%' }} /></div>
          <div className="form-group"><label className="label">Email</label><input className="input" type="email" placeholder="artisan@exemple.com" style={{ width: '100%' }} /></div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="label">Métier *</label>
            <select className="select" style={{ width: '100%' }} defaultValue="— Choisir —">
              <option>— Choisir —</option>
              <option>🔧 Plombier</option>
              <option>⚡ Électricien</option>
              <option>🎨 Peintre</option>
              <option>🧱 Maçon</option>
              <option>🪚 Menuisier</option>
              <option>🏠 Carreleur</option>
              <option>❄️ Technicien CVC</option>
              <option>🌿 Jardinier</option>
            </select>
          </div>
          <div className="form-group">
            <label className="label">Wilaya *</label>
            <select className="select" style={{ width: '100%' }} defaultValue="16 - Alger">
              <option>16 - Alger</option>
              <option>31 - Oran</option>
              <option>25 - Constantine</option>
              <option>06 - Béjaïa</option>
              <option>15 - Tizi Ouzou</option>
              <option>23 - Annaba</option>
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group"><label className="label">NIN *</label><input className="input" type="text" placeholder="XXXXXXXXXXXXXXXXXX" style={{ width: '100%' }} /></div>
          <div className="form-group"><label className="label">Années d'exp.</label><input className="input" type="number" placeholder="8" min="0" max="60" style={{ width: '100%' }} /></div>
        </div>
        <div className="form-group">
          <label className="label">Statut NIN</label>
          <select className="select" style={{ width: '100%' }} defaultValue="✅ Approuver directement">
            <option>✅ Approuver directement</option>
            <option>⏳ En attente de vérification</option>
          </select>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={close}>Annuler</button>
          <button className="btn btn-green" onClick={() => { toast('✅ Compte artisan créé !'); close(); }}>✓ Créer le compte</button>
        </div>
      </div>
    </div>
  );
}
