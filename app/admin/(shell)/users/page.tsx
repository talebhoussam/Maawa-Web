'use client';

import { useState } from 'react';
import { toast } from '@/lib/toast';
import { useAdminUsers } from '@/lib/hooks';
import { WILAYAS, displayLabel } from '@/lib/wilayas';
const openUserModal = () => {
  if (typeof document === 'undefined') return;
  document.getElementById('user-modal')?.classList.add('on');
};

const SearchIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.35-4.35" />
  </svg>
);
const MailIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <polyline points="22,6 12,13 2,6" />
  </svg>
);
const TrashIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  </svg>
);
const CheckIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M20 6L9 17l-5-5" />
  </svg>
);

export default function AdminUsersPage() {
  const { users, loading } = useAdminUsers();
  /* Soft-delete confirmation modal state. We don't use the existing
     #user-modal id because it's a generic Edit modal; the delete
     flow needs its own reason field. */
  const [deleteFor, setDeleteFor] = useState<{ uid: string; name: string } | null>(null);
  const [reason, setReason]       = useState('');
  const [submitting, setSubmitting] = useState(false);

  const performDelete = async () => {
    if (!deleteFor) return;
    if (reason.trim().length < 5) {
      toast('⚠️ La raison doit faire au moins 5 caractères');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/users/delete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ uid: deleteFor.uid, reason: reason.trim() }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast('❌ ' + (j.message ?? 'Erreur'));
      } else {
        toast('✅ Compte supprimé');
        setDeleteFor(null);
        setReason('');
      }
    } catch {
      toast('❌ Erreur réseau');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page on" id="page-users">
      <div className="page-header au">
        <div>
          <div className="page-h1" data-i18n="pt_users">Gestion Utilisateurs 👥</div>
          <div className="page-sub" data-i18n="pt_users_sub">{users.length} utilisateurs enregistrés</div>
        </div>
        <button className="btn btn-primary" onClick={() => toast('📊 Export CSV en cours…')}>Exporter</button>
      </div>

      <div className="tabs au1">
        <div className="tab on" onClick={() => {}}>Tous ({users.length})</div>
        <div className="tab" onClick={() => {}}>Artisans ({users.filter(u => u.role === 'artisan').length})</div>
        <div className="tab" onClick={() => {}}>Clients ({users.filter(u => u.role === 'client').length})</div>
        <div className="tab" onClick={() => {}}>Admins ({users.filter(u => u.role === 'admin').length})</div>
      </div>

      <div className="filter-bar au2">
        <input className="input" type="text" placeholder="Rechercher nom, email, NIN, #ID…" style={{ maxWidth: '280px' }} />
        <select className="select" defaultValue="">
          <option value="">Toutes les wilayas</option>
          {WILAYAS.map(w => (
            <option key={w.code} value={displayLabel(w)}>{displayLabel(w)}</option>
          ))}
        </select>
        <select className="select" defaultValue="Tous les statuts">
          <option>Tous les statuts</option>
          <option>✅ Actif</option>
          <option>⚠️ Suspendu</option>
          <option>🚫 Banni</option>
        </select>
        <select className="select" defaultValue="Trier par : Date inscription">
          <option>Trier par : Date inscription</option>
          <option>Note ↓</option>
          <option>Missions ↓</option>
        </select>
      </div>

      <div className="card au3">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th><input type="checkbox" /></th>
                <th data-i18n="th_user">Utilisateur</th>
                <th data-i18n="th_type">Type</th>
                <th>Wilaya</th>
                <th data-i18n="th_joined">Inscrit le</th>
                <th>Missions</th>
                <th data-i18n="th_nin_status">Statut NIN</th>
                <th data-i18n="th_account_status">Statut compte</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: '20px' }}>Chargement...</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: '20px' }}>Aucun utilisateur trouvé.</td></tr>
              ) : users.map(user => (
                <tr key={user.uid || user.id}>
                  <td><input type="checkbox" /></td>
                  <td className="name">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div className="avatar av1">{user.displayName?.substring(0,2).toUpperCase() || 'U'}</div>
                      <div>
                        <div>{user.displayName || 'Utilisateur'}</div>
                        <div style={{ fontSize: '.68rem', color: 'var(--text3)' }}>{user.email} · #{user.uid?.substring(0,6).toUpperCase()}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    {user.role === 'artisan' ? (
                      <span className="badge badge-blue">🔧 Artisan</span>
                    ) : user.role === 'admin' ? (
                       <span className="badge badge-red">🛡️ Admin</span>
                    ) : (
                      <span className="badge badge-purple">👤 Client</span>
                    )}
                  </td>
                  <td>{user.wilaya?.split('-')[1]?.trim() || user.wilaya || 'N/A'}</td>
                  <td style={{ color: 'var(--text3)' }}>
                    {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                  </td>
                  <td><strong>{user.missions?.length || 0}</strong></td>
                  <td>
                    {user.role === 'artisan' ? (
                      <span className="badge badge-green">✓ Vérifié</span>
                    ) : (
                      <span className="badge badge-gray">N/A</span>
                    )}
                  </td>
                  <td><span className="badge badge-green">● Actif</span></td>
                  <td>
                    <div className="btn-row">
                      <button className="btn-icon" onClick={openUserModal} title="Voir profil"><SearchIcon /></button>
                      <button className="btn-icon" onClick={() => toast('✉️ Email envoyé')} title="Contacter"><MailIcon /></button>
                      <button
                        className="btn-icon"
                        style={{ color: 'var(--rd)', borderColor: 'var(--rd)' }}
                        onClick={() => setDeleteFor({ uid: user.id, name: user.displayName ?? user.email ?? user.id })}
                        title="Supprimer le compte"
                      ><TrashIcon /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="pagination" style={{ padding: '10px 16px' }}>
          <button className="pg-btn">‹</button>
          <button className="pg-btn on">1</button>
          <button className="pg-btn">2</button>
          <span style={{ fontSize: '.78rem', color: 'var(--text3)', padding: '0 8px' }}>Total: {users.length}</span>
          <button className="pg-btn">›</button>
        </div>
      </div>

      {/* Soft-delete confirmation modal — captures reason (audited). */}
      {deleteFor && (
        <div
          className="modal-bg on"
          onClick={(e) => { if (e.target === e.currentTarget) setDeleteFor(null); }}
        >
          <div className="modal-box" style={{ maxWidth: 460, padding: 22 }}>
            <div className="modal-header">
              <div className="modal-title">⚠️ Supprimer le compte</div>
              <button className="modal-close" onClick={() => setDeleteFor(null)} aria-label="Fermer">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div style={{ fontSize: '.85rem', color: 'var(--text2)', lineHeight: 1.55, marginBottom: 12 }}>
              Vous êtes sur le point de supprimer le compte de <strong>{deleteFor.name}</strong>.
              <br />
              Cette action désactive l&apos;accès, anonymise le profil et révoque les tokens.
              Les publications et transactions sont conservées pour l&apos;audit.
            </div>
            <label style={{ display: 'block', fontSize: '.76rem', fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
              Raison (audit) <span style={{ color: 'var(--rd)' }}>*</span>
            </label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value.slice(0, 500))}
              rows={3}
              maxLength={500}
              placeholder="Ex. Violation des conditions d&apos;utilisation — spam massif"
              style={{
                width: '100%', padding: 9,
                border: '1.5px solid var(--border2)', borderRadius: 'var(--rx)',
                background: 'var(--surface)', color: 'var(--text)',
                fontSize: '.85rem', fontFamily: 'inherit', resize: 'vertical',
              }}
            />
            <div style={{ fontSize: '.7rem', color: 'var(--text3)', textAlign: 'right', marginTop: 4 }}>
              {reason.length} / 500
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button className="btn-outline" onClick={() => setDeleteFor(null)} disabled={submitting} style={{ flex: 1, justifyContent: 'center' }}>
                Annuler
              </button>
              <button
                className="btn-primary"
                onClick={performDelete}
                disabled={submitting || reason.trim().length < 5}
                style={{ flex: 2, justifyContent: 'center', background: 'var(--rd)' }}
              >
                {submitting ? 'Suppression…' : 'Confirmer la suppression'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
