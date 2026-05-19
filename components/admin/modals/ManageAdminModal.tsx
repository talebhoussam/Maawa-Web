'use client';

import { closeModal } from '@/lib/modal';
import { toast } from '@/lib/toast';

const MODAL_ID = 'manage-admin-modal';
const close = () => closeModal(MODAL_ID);

// Identical perm list to CreateAdminModal — preserved verbatim with the same
// defaultChecked pattern (L7194-7229 of source). Padding differs slightly (6px vs 5px).
const PERMS: { name: string; checked: boolean }[] = [
  { name: 'Dashboard',     checked: true  },
  { name: 'Analytics',     checked: true  },
  { name: 'Utilisateurs',  checked: true  },
  { name: 'NIN',           checked: true  },
  { name: 'Missions',      checked: true  },
  { name: 'Finance',       checked: false },
  { name: 'Litiges',       checked: true  },
  { name: 'Modération',    checked: true  },
  { name: 'Catégories',    checked: true  },
  { name: 'Candidatures',  checked: false },
  { name: 'Réservations',  checked: false },
  { name: 'Paramètres',    checked: false },
];

const permCellStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '7px',
  fontSize: '.78rem',
  padding: '6px',
  borderRadius: '5px',
  background: 'var(--surface2)',
  cursor: 'pointer',
};

export default function ManageAdminModal() {
  return (
    <div className="modal-bg" id={MODAL_ID}>
      <div className="modal" style={{ maxWidth: '460px' }}>
        <div className="modal-title">
          🔐 Permissions — <span id="manage-admin-name">Admin</span>
          <button className="modal-close" onClick={close}>✕</button>
        </div>
        <div style={{ background: 'var(--b50)', border: '1px solid var(--b200)', borderRadius: 'var(--rs)', padding: '9px 13px', marginBottom: '14px', fontSize: '.77rem' }}>
          <strong>Rôle :</strong> <span id="manage-admin-role-display">Manager Admin</span>
        </div>
        <div className="form-group">
          <label className="label">Changer de rôle</label>
          <select className="select" style={{ width: '100%' }} defaultValue="🛡️ Manager Admin">
            <option>🛡️ Manager Admin</option>
            <option>⚙️ Opérationnel Admin</option>
          </select>
        </div>
        <div className="form-group">
          <label className="label">Permissions</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginTop: '6px' }}>
            {PERMS.map(p => (
              <label key={p.name} style={permCellStyle}>
                <input type="checkbox" defaultChecked={p.checked} style={{ accentColor: 'var(--b500)' }} /> {p.name}
              </label>
            ))}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={close}>Annuler</button>
          <button className="btn btn-primary" onClick={() => { toast('✅ Permissions mises à jour'); close(); }}>Sauvegarder</button>
        </div>
      </div>
    </div>
  );
}
