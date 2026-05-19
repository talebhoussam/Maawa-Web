'use client';

import { useState } from 'react';
import { closeModal } from '@/lib/modal';
import { toast } from '@/lib/toast';

const MODAL_ID = 'cat-modal';
const close = () => closeModal(MODAL_ID);

export default function CatModal() {
  const [icon, setIcon] = useState('🔧');

  return (
    <div className="modal-bg" id={MODAL_ID}>
      <div className="modal" style={{ maxWidth: '480px' }}>
        <div className="modal-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--b500)" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
          </svg>
          <span id="cat-modal-title">Nouvelle catégorie</span>
          <button className="modal-close" onClick={close}>✕</button>
        </div>
        <div className="form-group">
          <label className="label">Icône (emoji)</label>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <span id="cat-icon-preview" style={{ fontSize: '2.2rem', width: '50px', textAlign: 'center' }}>{icon || '?'}</span>
            <input
              className="input"
              type="text"
              id="cat-icon"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              style={{ width: '72px', fontSize: '1.1rem', textAlign: 'center' }}
            />
            <span style={{ fontSize: '.74rem', color: 'var(--text3)' }}>
              Entrez un emoji ou choisissez parmi:<br />🔧 ⚡ 🎨 🧱 🪚 🏠 ❄️ 🌿 🚪 🔩
            </span>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="label">Nom (Français) *</label>
            <input className="input" type="text" id="cat-name-fr" placeholder="Ex: Plomberie" style={{ width: '100%' }} />
          </div>
          <div className="form-group">
            <label className="label">Nom (English)</label>
            <input className="input" type="text" id="cat-name-en" placeholder="Ex: Plumbing" style={{ width: '100%' }} />
          </div>
        </div>
        <div className="form-group">
          <label className="label">Nom (عربي)</label>
          <input className="input" type="text" id="cat-name-ar" placeholder="مثلاً: سباكة" dir="rtl" style={{ width: '100%' }} />
        </div>
        <div className="form-group">
          <label className="label">Slug URL</label>
          <input className="input" type="text" id="cat-slug" placeholder="plomberie" style={{ width: '100%' }} />
          <div style={{ fontSize: '.7rem', color: 'var(--text3)', marginTop: '4px' }}>Généré automatiquement · modifiable manuellement</div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="label">Ordre d'affichage</label>
            <input className="input" type="number" defaultValue={1} min="1" style={{ width: '100%' }} />
          </div>
          <div className="form-group">
            <label className="label">Statut</label>
            <select className="select" style={{ width: '100%' }} defaultValue="✅ Actif">
              <option>✅ Actif</option>
              <option>⏸ Inactif</option>
            </select>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={close}>Annuler</button>
          <button className="btn btn-primary" onClick={() => { toast('✅ Catégorie enregistrée'); close(); }}>Enregistrer</button>
        </div>
      </div>
    </div>
  );
}
