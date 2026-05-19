'use client';

import { toast } from '@/lib/toast';
import { useAdminUsers } from '@/lib/hooks';

const openModal = (id: string) => {
  if (typeof document === 'undefined') return;
  document.getElementById(id)?.classList.add('on');
};

const PERMISSIONS = {
  super: ['dashboard', 'analytics', 'users', 'verification', 'missions', 'finance', 'disputes', 'moderation', 'broadcast', 'settings', 'audit', 'categories', 'applications', 'bookings', 'admins', 'ads', 'heatmap'],
  manager: ['dashboard', 'analytics', 'users', 'verification', 'missions', 'moderation', 'broadcast', 'audit', 'categories', 'applications', 'ads'],
  ops: ['dashboard', 'missions', 'verification', 'disputes', 'applications', 'bookings', 'audit'],
};

const PAGES = [
  { id: 'dashboard', label: 'Dashboard 📊' },
  { id: 'analytics', label: 'Analytics 📈' },
  { id: 'users', label: 'Utilisateurs 👥' },
  { id: 'verification', label: 'Vérification NIN 🪪' },
  { id: 'missions', label: 'Missions 📋' },
  { id: 'finance', label: 'Finance & SafePay 💰' },
  { id: 'disputes', label: 'Litiges ⚖️' },
  { id: 'moderation', label: 'Modération 🛡️' },
  { id: 'broadcast', label: 'Diffusions 📣' },
  { id: 'settings', label: 'Paramètres ⚙️' },
  { id: 'audit', label: "Journal d'audit 📄" },
  { id: 'categories', label: 'Catégories 🗂️' },
  { id: 'applications', label: 'Candidatures Artisans 🔧' },
  { id: 'bookings', label: 'Réservations 📅' },
  { id: 'admins', label: 'Gestion Admins 🔐' },
];

export default function AdminAdminsPage() {
  const { users, loading } = useAdminUsers();
  const admins = users.filter(u => u.role === 'admin');

  return (
    <div className="page on" id="page-admins">
      <div className="page-header au">
        <div>
          <div id="pt-admins" className="page-h1" data-i18n="pt_admins">Gestion des Admins 🔐</div>
          <div id="pt-admins-sub" className="page-sub" data-i18n="pt_admins_sub">Super Admin uniquement · {admins.length} admin(s) actif(s)</div>
        </div>
        <button className="btn btn-primary" onClick={() => openModal('create-admin-modal')}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Créer un admin
        </button>
      </div>

      <div className="card au2">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Admin</th>
                <th>Rôle</th>
                <th>Permissions actives</th>
                <th>Inscrit le</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '20px' }}>Chargement...</td></tr>
              ) : admins.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '20px' }}>Aucun administrateur trouvé.</td></tr>
              ) : admins.map(admin => (
                <tr key={admin.uid || admin.id}>
                  <td className="name">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                      <div className="avatar" style={{ width: '34px', height: '34px', fontSize: '.7rem', background: 'linear-gradient(135deg,#7c3aed,#4c1d95)' }}>
                        {admin.displayName?.substring(0, 2).toUpperCase() || 'AD'}
                      </div>
                      <div>
                        <div>{admin.displayName || 'Admin'}</div>
                        <div style={{ fontSize: '.68rem', color: 'var(--text3)' }}>{admin.email}</div>
                      </div>
                    </div>
                  </td>
                  <td><span className="badge" style={{ background: '#f3e8ff', color: '#7c3aed' }}>🔐 Super Admin</span></td>
                  <td><span style={{ fontSize: '.75rem', color: 'var(--gn)', fontWeight: 600 }}>Toutes les permissions ({PERMISSIONS.super.length})</span></td>
                  <td style={{ fontSize: '.76rem', color: 'var(--text3)' }}>
                    {admin.createdAt ? new Date(admin.createdAt).toLocaleDateString() : 'N/A'}
                  </td>
                  <td><span className="badge badge-green">● Actif</span></td>
                  <td>
                    <div className="btn-row">
                      <button className="btn btn-ghost btn-sm" onClick={() => openModal('manage-admin-modal')}>Gérer perms</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card au3" style={{ marginTop: '14px' }}>
        <div className="card-header">
          <div className="card-title">📊 Matrice des permissions par rôle</div>
        </div>
        <div className="card-body" style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ minWidth: '480px' }}>
            <thead>
              <tr>
                <th style={{ minWidth: '160px' }}>Permission</th>
                <th style={{ textAlign: 'center' }}>🔐 Super Admin</th>
                <th style={{ textAlign: 'center' }}>🛡️ Manager</th>
                <th style={{ textAlign: 'center' }}>⚙️ Opérationnel</th>
              </tr>
            </thead>
            <tbody id="perm-matrix">
              {PAGES.map(p => {
                const s = PERMISSIONS.super.includes(p.id);
                const m = PERMISSIONS.manager.includes(p.id);
                const o = PERMISSIONS.ops.includes(p.id);
                return (
                  <tr key={p.id}>
                    <td>{p.label}</td>
                    <td className={s ? 'perm-yes' : 'perm-no'}>{s ? '✓' : '—'}</td>
                    <td className={m ? 'perm-yes' : 'perm-no'}>{m ? '✓' : '—'}</td>
                    <td className={o ? 'perm-yes' : 'perm-no'}>{o ? '✓' : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
