'use client';

import { useState } from 'react';
import { closeModal } from '@/lib/modal';
import { toast } from '@/lib/toast';

const MODAL_ID = 'assign-modal';
const close = () => closeModal(MODAL_ID);

export default function AssignModal() {
  // Source toggles a `selected` class on the radio cards via inline JS.
  // We bind that to a small piece of state; the .disabled card is not selectable.
  const [picked, setPicked] = useState<'KB' | 'LH'>('KB');

  return (
    <div className="modal-bg" id={MODAL_ID}>
      <div className="modal" style={{ maxWidth: '500px' }}>
        <div className="modal-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--b500)" strokeWidth="2">
            <path d="M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z" />
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
          </svg>
          Assigner — <span id="assign-booking-id">#BK-2891</span>
          <button className="modal-close" onClick={close}>✕</button>
        </div>
        <div style={{ background: 'var(--b50)', border: '1px solid var(--b200)', borderRadius: 'var(--rs)', padding: '10px 13px', marginBottom: '14px' }}>
          <div style={{ fontSize: '.8rem' }}>
            <strong>Client :</strong> <span id="assign-client">Client</span> · <strong>Service :</strong> <span id="assign-service">Service</span>
          </div>
          <div style={{ fontSize: '.73rem', color: 'var(--text2)', marginTop: '3px' }}>📍 Alger · 🚨 Urgent</div>
        </div>
        <label className="label">Artisans disponibles</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '260px', overflowY: 'auto', marginBottom: '14px' }}>
          <label className={'assign-radio-card' + (picked === 'KB' ? ' selected' : '')} id="arc-kb" onClick={() => setPicked('KB')}>
            <input type="radio" name="assign-art" value="KB" checked={picked === 'KB'} onChange={() => setPicked('KB')} style={{ accentColor: 'var(--b500)' }} />
            <div className="avatar av1" style={{ width: '36px', height: '36px', fontSize: '.7rem', flexShrink: 0 }}>KB</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: '.82rem' }}>
                Karim Boualem <span className="badge badge-green" style={{ fontSize: '.58rem', marginLeft: '3px' }}>✓ NIN</span>
              </div>
              <div style={{ fontSize: '.7rem', color: 'var(--text2)' }}>
                ⭐ 4.9 · 2.1 km · <span style={{ color: 'var(--gn)', fontWeight: 600 }}>Disponible</span>
              </div>
            </div>
            <div style={{ textAlign: 'right', fontSize: '.7rem', color: 'var(--text3)' }}>3 missions<br />ce mois</div>
          </label>
          <label className={'assign-radio-card' + (picked === 'LH' ? ' selected' : '')} id="arc-lh" onClick={() => setPicked('LH')}>
            <input type="radio" name="assign-art" value="LH" checked={picked === 'LH'} onChange={() => setPicked('LH')} style={{ accentColor: 'var(--b500)' }} />
            <div className="avatar av5" style={{ width: '36px', height: '36px', fontSize: '.7rem', flexShrink: 0 }}>LH</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: '.82rem' }}>
                Lina Hamza <span className="badge badge-green" style={{ fontSize: '.58rem', marginLeft: '3px' }}>✓ NIN</span>
              </div>
              <div style={{ fontSize: '.7rem', color: 'var(--text2)' }}>
                ⭐ 4.8 · 4.7 km · <span style={{ color: 'var(--gn)', fontWeight: 600 }}>Disponible</span>
              </div>
            </div>
            <div style={{ textAlign: 'right', fontSize: '.7rem', color: 'var(--text3)' }}>7 missions<br />ce mois</div>
          </label>
          <div className="assign-radio-card disabled">
            <input type="radio" name="assign-art" disabled style={{ accentColor: 'var(--b500)' }} />
            <div className="avatar av6" style={{ width: '36px', height: '36px', fontSize: '.7rem', flexShrink: 0 }}>MO</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: '.82rem' }}>Mehdi Ouali</div>
              <div style={{ fontSize: '.7rem', color: 'var(--text2)' }}>
                ⭐ 4.6 · 6.2 km · <span style={{ color: 'var(--or)', fontWeight: 600 }}>Occupé</span>
              </div>
            </div>
            <div style={{ textAlign: 'right', fontSize: '.7rem', color: 'var(--text3)' }}>Mission<br />#MW-4830</div>
          </div>
        </div>
        <div className="form-group">
          <label className="label">Note pour l'artisan</label>
          <textarea className="textarea" placeholder="Instructions spécifiques…" style={{ height: '60px' }} />
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={close}>Annuler</button>
          <button className="btn btn-primary" onClick={() => { toast('🔧 Artisan assigné — Notification envoyée'); close(); }}>🔧 Assigner et notifier</button>
        </div>
      </div>
    </div>
  );
}
