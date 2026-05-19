'use client';

import { useState } from 'react';
import { closeModal } from '@/lib/modal';
import { toast } from '@/lib/toast';

const MODAL_ID = 'create-ad-modal';
const close = () => closeModal(MODAL_ID);

const EMOJIS = ['🚀', '🔧', '🏆', '💎', '🇩🇿', '🎓'];

const emojiOnStyle = {
  fontSize: '1.4rem',
  cursor: 'pointer',
  padding: '4px 8px',
  borderRadius: '6px',
  border: '2px solid var(--b500)',
  background: 'var(--b50)',
};
const emojiOffStyle = {
  fontSize: '1.4rem',
  cursor: 'pointer',
  padding: '4px 8px',
  borderRadius: '6px',
  border: '2px solid var(--border2)',
};

export default function CreateAdModal() {
  // Source uses inline JS to toggle borderColor/background on the emoji spans.
  // We track the picked emoji in state and pick the style from there — same effect.
  const [picked, setPicked] = useState('🚀');

  return (
    <div className="modal-bg" id={MODAL_ID}>
      <div className="modal" style={{ maxWidth: '560px' }}>
        <div className="modal-title">
          📣 Créer une publicité
          <button className="modal-close" onClick={close}>✕</button>
        </div>
        <div className="form-row">
          <div className="form-group"><label className="label">Titre FR *</label><input className="input" type="text" id="ad-title-fr" placeholder="Maawa Pro — Devenez Elite" style={{ width: '100%' }} /></div>
          <div className="form-group"><label className="label">Titre EN</label><input className="input" type="text" id="ad-title-en" placeholder="Maawa Pro — Go Elite" style={{ width: '100%' }} /></div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="label">Titre AR</label>
            <input className="input" type="text" id="ad-title-ar" placeholder="ماوا برو..." dir="rtl" style={{ width: '100%' }} />
          </div>
          <div className="form-group">
            <label className="label">Emoji / Visuel mock</label>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
              {EMOJIS.map(e => (
                <span
                  key={e}
                  className={'ad-emoji-opt' + (picked === e ? ' sel' : '')}
                  onClick={() => setPicked(e)}
                  style={picked === e ? emojiOnStyle : emojiOffStyle}
                >
                  {e}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group"><label className="label">Texte CTA</label><input className="input" type="text" id="ad-cta" placeholder="Découvrir →" style={{ width: '100%' }} /></div>
          <div className="form-group"><label className="label">URL destination</label><input className="input" type="url" id="ad-url" placeholder="https://…" style={{ width: '100%' }} /></div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="label">Audience cible</label>
            <select className="select" id="ad-audience" style={{ width: '100%' }} defaultValue="Tous les utilisateurs">
              <option>Tous les utilisateurs</option>
              <option>Clients uniquement</option>
              <option>Artisans uniquement</option>
              <option>Wilaya spécifique</option>
            </select>
          </div>
          <div className="form-group">
            <label className="label">Placement</label>
            <select className="select" id="ad-placement" style={{ width: '100%' }} defaultValue="Fil d'actualité">
              <option>Fil d'actualité</option>
              <option>Explore</option>
              <option>Fil + Explore</option>
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group"><label className="label">Date début</label><input className="input" type="date" id="ad-start" style={{ width: '100%' }} /></div>
          <div className="form-group"><label className="label">Date fin</label><input className="input" type="date" id="ad-end" style={{ width: '100%' }} /></div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={close}>Annuler</button>
          <button className="btn btn-primary" onClick={() => { toast('✅ Publicité créée et diffusée !'); close(); }}>✓ Publier la publicité</button>
        </div>
      </div>
    </div>
  );
}
