'use client';

import { toast } from '@/lib/toast';
import { useAdminUsers } from '@/lib/hooks';

const openPayoutConfirm = () => {
  if (typeof document === 'undefined') return;
  document.getElementById('payout-confirm-modal')?.classList.add('on');
};

export default function AdminFinancePage() {
  const { users } = useAdminUsers();
  const totalCoins = users.reduce((sum, u) => sum + (u.maawaCoinBalance || 0), 0);

  return (
    <div className="page on" id="page-finance">
      <div className="page-header au">
        <div>
          <div className="page-h1" data-i18n="pt_finance">Finance &amp; SafePay 💰</div>
          <div className="page-sub" data-i18n="pt_finance_sub">Gestion des paiements, escrow et Maawa Coins</div>
        </div>
      </div>

      <div className="kpi-grid au1">
        <div className="kpi-card">
          <div className="kpi-top"><div className="kpi-icon" style={{ background: 'var(--gl)' }}>💰</div></div>
          <div className="kpi-val">0</div>
          <div className="kpi-label" data-i18n="kpi_escrow_active">DZD en escrow actif</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-top"><div className="kpi-icon" style={{ background: 'var(--b100)' }}>🪙</div></div>
          <div className="kpi-val">{totalCoins} MC</div>
          <div className="kpi-label" data-i18n="kpi_coins_circ">Coins en circulation</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-top"><div className="kpi-icon" style={{ background: 'var(--pl)' }}>📊</div></div>
          <div className="kpi-val">0</div>
          <div className="kpi-label" data-i18n="kpi_commissions">DZD commissions ce mois</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-top"><div className="kpi-icon" style={{ background: 'var(--gol)' }}>⏳</div></div>
          <div className="kpi-val">0</div>
          <div className="kpi-label" data-i18n="kpi_payout_pending">Demandes de paiement en attente</div>
        </div>
      </div>

      <div className="grid-2 au2">
        <div className="card">
          <div className="card-header">
            <div className="card-title" data-i18n="payout_requests">Demandes de paiement artisans</div>
            <span className="badge badge-green">0 en attente</span>
          </div>
          <div className="card-body" style={{ padding: '30px', textAlign: 'center', color: 'var(--text3)' }}>
            Aucune demande de paiement pour le moment.
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title" data-i18n="coin_transactions">Soldes Maawa Coins</div>
            <span style={{ fontSize: '.76rem', color: 'var(--b500)', fontWeight: 600 }} data-i18n="coin_rate">Taux : 1 MC = 50 DZD</span>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Utilisateur</th>
                  <th>Rôle</th>
                  <th>Solde MC</th>
                  <th>Valeur DZD</th>
                </tr>
              </thead>
              <tbody>
                {users.filter(u => (u.maawaCoinBalance || 0) > 0).length === 0 ? (
                  <tr><td colSpan={4} style={{ textAlign: 'center', padding: '20px' }}>Aucune transaction.</td></tr>
                ) : users.filter(u => (u.maawaCoinBalance || 0) > 0).map(user => (
                  <tr key={user.uid || user.id}>
                    <td className="name">{user.displayName || 'Utilisateur'}</td>
                    <td><span className={`badge badge-${user.role === 'artisan' ? 'blue' : 'purple'}`}>{user.role}</span></td>
                    <td style={{ color: 'var(--gn)', fontWeight: 700 }}>{user.maawaCoinBalance} MC</td>
                    <td>{(user.maawaCoinBalance || 0) * 50} DZD</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
