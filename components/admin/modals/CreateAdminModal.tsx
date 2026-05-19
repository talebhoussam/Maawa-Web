'use client';

import { closeModal } from '@/lib/modal';
import { toast } from '@/lib/toast';

const MODAL_ID = 'create-admin-modal';
const close = () => closeModal(MODAL_ID);

// Permission checkboxes from L7129-7166 of source. The labels and the
// `defaultChecked` state on each box are preserved verbatim.
const PERMS: { name: string; checked: boolean }[] = [
  { name: 'Dashboard',     checked: true  },
  { name: 'Analytics',     checked: true  },
  { name: 'Utilisateurs',  checked: true  },
  { name: 'NIN',           checked: true  },
  { name: 'Missions',      checked: true  },
  { name: 'Finance',       checked: false },
  { name: 'Litiges',       checked: true  },
  { name: 'Modération',    checked: true  },
  { name: 'Catégories',    checked: false },
  { name: 'Candidatures',  checked: false },
  { name: 'Réservations',  checked: false },
  { name: 'Paramètres',    checked: false },
];

const permCellStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  fontSize: '.78rem',
  cursor: 'pointer',
  padding: '5px',
  borderRadius: '5px',
  background: 'var(--surface2)',
};

export default function CreateAdminModal() {
  return (
    <div className="modal-bg" id={MODAL_ID}>
      <div className="modal" style={{ maxWidth: '460px' }}>
        <div className="modal-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--pu)" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          Créer un Admin
          <button className="modal-close" onClick={close}>✕</button>
        </div>
        <div className="form-row">
          <div className="form-group"><label className="label">Prénom *</label><input className="input" type="text" placeholder="Mohamed" style={{ width: '100%' }} /></div>
          <div className="form-group"><label className="label">Nom *</label><input className="input" type="text" placeholder="Aissa" style={{ width: '100%' }} /></div>
        </div>
        <div className="form-group">
          <label className="label">Email Maawa *</label>
          <input className="input" type="email" placeholder="m.aissa@maawa.dz" style={{ width: '100%' }} />
        </div>
        <div className="form-group">
          <label className="label">Rôle *</label>
          <select className="select" style={{ width: '100%' }} id="new-admin-role" defaultValue="">
            <option value="">— Choisir —</option>
            <option value="manager">🛡️ Manager Admin</option>
            <option value="ops">⚙️ Opérationnel Admin</option>
          </select>
        </div>
        <div className="form-group">
          <label className="label">Permissions</label>
          <div id="perm-checkboxes" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginTop: '6px' }}>
            {PERMS.map(p => (
              <label key={p.name} style={permCellStyle}>
                <input type="checkbox" defaultChecked={p.checked} style={{ accentColor: 'var(--b500)' }} /> {p.name}
              </label>
            ))}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={close}>Annuler</button>
          <button className="btn btn-primary" onClick={() => { toast("✅ Compte admin créé"); close(); }}>Créer l'admin</button>
        </div>
      </div>
    </div>
  );
}
