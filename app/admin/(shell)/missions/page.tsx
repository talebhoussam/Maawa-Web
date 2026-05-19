'use client';

import { useRouter } from 'next/navigation';
import { toast } from '@/lib/toast';
import { useAdminMissions } from '@/lib/hooks';
import { WILAYAS, displayLabel } from '@/lib/wilayas';
const openMissionModal = () => {
  if (typeof document === 'undefined') return;
  document.getElementById('mission-modal')?.classList.add('on');
};

export default function AdminMissionsPage() {
  const router = useRouter();
  const { missions, loading } = useAdminMissions();

  return (
    <div className="page on" id="page-missions">
      <div className="page-header au">
        <div>
          <div className="page-h1" data-i18n="pt_missions">Contrôle Missions 📋</div>
          <div className="page-sub" data-i18n="pt_missions_sub">{missions.length} missions au total · {missions.filter(m => m.status === 'in_progress').length} actives</div>
        </div>
        <button className="btn btn-primary" onClick={() => toast('📊 Export CSV en cours…')}>Exporter</button>
      </div>

      <div className="kpi-grid au1">
        <div className="kpi-card">
          <div className="kpi-top"><div className="kpi-icon" style={{ background: 'var(--b100)' }}>🔄</div><span className="kpi-trend neutral">Aujourd'hui</span></div>
          <div className="kpi-val">{missions.filter(m => m.status === 'in_progress').length}</div>
          <div className="kpi-label" data-i18n="kpi_active_miss">Missions actives</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-top"><div className="kpi-icon" style={{ background: 'var(--gl)' }}>✅</div><span className="kpi-trend up">↑</span></div>
          <div className="kpi-val">{missions.filter(m => m.status === 'completed').length}</div>
          <div className="kpi-label" data-i18n="kpi_done_today">Terminées au total</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-top"><div className="kpi-icon" style={{ background: 'var(--rl)' }}>⚠️</div></div>
          <div className="kpi-val">{missions.filter(m => m.status === 'dispute').length}</div>
          <div className="kpi-label" data-i18n="kpi_litige">En litige</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-top"><div className="kpi-icon" style={{ background: 'var(--gol)' }}>⏳</div></div>
          <div className="kpi-val">{missions.filter(m => m.status === 'pending' || !m.artisanId).length}</div>
          <div className="kpi-label" data-i18n="kpi_dispatch">En dispatch (non assignées)</div>
        </div>
      </div>

      <div className="filter-bar au2">
        <input className="input" type="text" placeholder="Rechercher #MW-, artisan, client…" />
        <select className="select" defaultValue="Tous statuts">
          <option>Tous statuts</option>
          <option>✅ Confirmée</option>
          <option>🚗 En route</option>
          <option>🔧 Sur place</option>
          <option>✓ Terminée</option>
          <option>⚠️ Litige</option>
        </select>
        <select className="select" defaultValue="">
          <option value="">Toutes wilayas</option>
          {WILAYAS.map(w => (
            <option key={w.code} value={displayLabel(w)}>{displayLabel(w)}</option>
          ))}
        </select>
        <select className="select" defaultValue="Tous métiers">
          <option>Tous métiers</option>
          <option>Plomberie</option>
          <option>Électricité</option>
          <option>Peinture</option>
        </select>
      </div>

      <div className="card au3">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th data-i18n="th_mission">#Mission</th>
                <th>Client</th>
                <th>Artisan</th>
                <th>Métier</th>
                <th>Wilaya</th>
                <th data-i18n="th_amount">Montant</th>
                <th data-i18n="th_commission">Commission</th>
                <th>Statut</th>
                <th>SafePay</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} style={{ textAlign: 'center', padding: '20px' }}>Chargement...</td></tr>
              ) : missions.length === 0 ? (
                <tr><td colSpan={10} style={{ textAlign: 'center', padding: '20px' }}>Aucune mission trouvée.</td></tr>
              ) : missions.map(mission => (
                <tr key={mission.id}>
                  <td style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, color: 'var(--b500)' }}>
                    {mission.id.substring(0, 8).toUpperCase()}
                  </td>
                  <td className="name">{mission.clientName || 'Client'}</td>
                  <td className="name">
                    {mission.artisanId ? mission.artisanName : <span style={{ color: 'var(--text3)', fontStyle: 'italic' }}>En dispatch</span>}
                  </td>
                  <td>{mission.trade || 'Service'}</td>
                  <td>{mission.wilaya || 'Alger'}</td>
                  <td>{mission.amount || 0} DZD</td>
                  <td style={{ color: 'var(--gn)' }}>{(mission.amount || 0) * 0.1} DZD</td>
                  <td>
                    <span className={`badge badge-${mission.status === 'completed' ? 'green' : mission.status === 'in_progress' ? 'blue' : mission.status === 'dispute' ? 'red' : 'orange'}`}>
                      {mission.status === 'completed' ? '✅ Terminée' : mission.status === 'in_progress' ? '🔄 En cours' : mission.status === 'dispute' ? '⚠️ Litige' : '⏳ Attente'}
                    </span>
                  </td>
                  <td>
                    <span className={`badge badge-${mission.status === 'completed' ? 'green' : 'orange'}`}>
                      {mission.status === 'completed' ? 'Libéré' : '⏳ Escrow'}
                    </span>
                  </td>
                  <td>
                    <div className="btn-row">
                      <button className="btn btn-ghost btn-sm" onClick={openMissionModal}>Détails</button>
                      {mission.status === 'in_progress' && (
                        <button className="btn btn-green btn-sm" onClick={() => toast('✅ Mission forcée terminée')}>Forcer fin</button>
                      )}
                      {mission.status === 'pending' && !mission.artisanId && (
                        <button className="btn btn-primary btn-sm" onClick={() => toast('🔧 Artisan assigné manuellement')}>Assigner</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
