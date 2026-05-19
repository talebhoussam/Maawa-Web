'use client';

import { toast } from '@/lib/toast';
import { useAdminMissions } from '@/lib/hooks';
import { WILAYAS, displayLabel } from '@/lib/wilayas';
const openAssignModal = () => {
  if (typeof document === 'undefined') return;
  document.getElementById('assign-modal')?.classList.add('on');
};
const openBookingDetailModal = () => {
  if (typeof document === 'undefined') return;
  document.getElementById('booking-detail-modal')?.classList.add('on');
};

export default function AdminBookingsPage() {
  const { missions, loading } = useAdminMissions();

  return (
    <div className="page on" id="page-bookings">
      <div className="page-header au">
        <div>
          <div id="pt-bookings" className="page-h1" data-i18n="pt_bookings">Réservations &amp; Dispatch 📅</div>
          <div id="pt-bookings-sub" className="page-sub" data-i18n="pt_bookings_sub">8 réservations non assignées · Assignez un artisan disponible</div>
        </div>
        <div className="btn-row">
          <span className="badge badge-orange" style={{ fontSize: '.76rem', padding: '5px 11px' }}>⏳ {missions.filter(m => !m.artisanId).length} non assignées</span>
          <span className="badge badge-blue" style={{ fontSize: '.76rem', padding: '5px 11px' }}>🔄 {missions.filter(m => m.status === 'in_progress').length} en cours</span>
        </div>
      </div>

      <div className="filter-bar au1">
        <input className="input" type="text" placeholder="Rechercher client, artisan, #ID…" style={{ flex: 1, maxWidth: '260px' }} />
        <select className="select" defaultValue="Tous statuts">
          <option>Tous statuts</option>
          <option>⏳ Non assignée</option>
          <option>🔄 Confirmée</option>
          <option>🔧 Sur place</option>
          <option>✅ Terminée</option>
        </select>
        <select className="select" defaultValue="">
          <option value="">Toutes wilayas</option>
          {WILAYAS.map(w => (
            <option key={w.code} value={displayLabel(w)}>{displayLabel(w)}</option>
          ))}
        </select>
        <select className="select" defaultValue="Tous métiers">
          <option>Tous métiers</option>
          <option>🔧 Plomberie</option>
          <option>⚡ Électricité</option>
          <option>🎨 Peinture</option>
        </select>
      </div>

      <div className="card au2">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>#Réservation</th>
                <th>Client</th>
                <th>Service</th>
                <th>Wilaya</th>
                <th>Date / Heure</th>
                <th>Type</th>
                <th>Artisan assigné</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: '20px' }}>Chargement...</td></tr>
              ) : missions.length === 0 ? (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: '20px' }}>Aucune réservation trouvée.</td></tr>
              ) : missions.map(mission => (
                <tr key={mission.id} style={{ opacity: mission.status === 'completed' ? 0.6 : 1 }}>
                  <td style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, color: 'var(--b500)' }}>
                    {mission.id.substring(0, 8).toUpperCase()}
                  </td>
                  <td className="name">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div className="avatar av4" style={{ width: '24px', height: '24px', fontSize: '.58rem' }}>C</div>
                      {mission.clientName || 'Client'}
                    </div>
                  </td>
                  <td>{mission.trade || 'Service'}</td>
                  <td>{mission.wilaya || 'Alger'}</td>
                  <td style={{ fontSize: '.77rem' }}>
                    {new Date(mission.createdAt).toLocaleDateString()}<br />
                  </td>
                  <td><span className="badge badge-blue">Normal</span></td>
                  <td>
                    {mission.artisanId ? (
                      <span style={{ fontSize: '.79rem', fontWeight: 600 }}>{mission.artisanName || 'Artisan'}</span>
                    ) : (
                      <span style={{ color: 'var(--text3)', fontStyle: 'italic', fontSize: '.8rem' }}>Non assigné</span>
                    )}
                  </td>
                  <td>
                    <span className={`badge badge-${mission.status === 'completed' ? 'green' : mission.status === 'in_progress' ? 'blue' : 'orange'}`}>
                      {mission.status === 'completed' ? '✅ Terminée' : mission.status === 'in_progress' ? '🔄 En cours' : '⏳ Attente'}
                    </span>
                  </td>
                  <td>
                    <div className="btn-row">
                      <button className="btn btn-ghost btn-sm" onClick={openBookingDetailModal}>Détails</button>
                      {!mission.artisanId && <button className="btn btn-primary btn-sm" onClick={openAssignModal}>🔧 Assigner</button>}
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
          <span style={{ fontSize: '.78rem', color: 'var(--text3)', padding: '0 8px' }}>{missions.length} réservations</span>
          <button className="pg-btn">›</button>
        </div>
      </div>
    </div>
  );
}
