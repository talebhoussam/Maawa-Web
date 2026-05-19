'use client';

import { useRouter } from 'next/navigation';
import { toast } from '@/lib/toast';
import { useAdminUsers, useAdminMissions } from '@/lib/hooks';
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

export default function AdminDashboardPage() {
  const router = useRouter();
  const { users } = useAdminUsers();
  const { missions } = useAdminMissions();
  
  const artisans = users.filter(u => u.role === 'artisan').slice(0, 4);

  return (
    <div className="page on" id="page-dashboard">
      <div className="page-header au">
        <div>
          <div className="page-h1" data-i18n="pt_dashboard">Vue d'ensemble 📊</div>
          <div className="page-sub" data-i18n="pt_dashboard_sub">Mars 2026 · Mis à jour il y a 2 min</div>
        </div>
        <div className="btn-row">
          <select className="select" style={{ height: '34px' }} defaultValue="Mars 2026">
            <option>Mars 2026</option>
            <option>Fév 2026</option>
            <option>Jan 2026</option>
          </select>
          <button className="btn btn-primary" onClick={() => toast('📊 Rapport exporté !')}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg> Exporter
          </button>
        </div>
      </div>

      {/* ALERTS */}
      <div className="au1" style={{ marginBottom: '16px' }}>
        <div className="alert-item danger">
          <span style={{ fontSize: '1rem' }}>🚨</span>
          <div className="alert-msg" data-i18n="alert_disputes"><strong>3 litiges actifs</strong> nécessitent une intervention immédiate</div>
          <span className="alert-time">Maintenant</span>
          <button className="btn btn-red btn-sm" style={{ marginLeft: '8px' }} onClick={() => router.push('/admin/disputes')}>Voir →</button>
        </div>
        <div className="alert-item warn">
          <span style={{ fontSize: '1rem' }}>⏳</span>
          <div className="alert-msg" data-i18n="alert_nin"><strong>7 vérifications NIN</strong> en attente depuis plus de 24h (SLA dépassé)</div>
          <span className="alert-time">+24h</span>
          <button className="btn btn-orange btn-sm" style={{ marginLeft: '8px' }} onClick={() => router.push('/admin/verification')}>Traiter →</button>
        </div>
      </div>

      {/* KPIs */}
      <div className="kpi-grid au2">
        <div className="kpi-card">
          <div className="kpi-top">
            <div className="kpi-icon" style={{ background: 'var(--b100)' }}>💰</div>
            <span className="kpi-trend up">↑ +18%</span>
          </div>
          <div className="kpi-val">8,47M</div>
          <div className="kpi-label" data-i18n="kpi_revenue">Chiffre d'affaires (DZD)</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-top">
            <div className="kpi-icon" style={{ background: 'var(--gl)' }}>✅</div>
            <span className="kpi-trend up">↑ +24%</span>
          </div>
          <div className="kpi-val">{missions.filter(m => m.status === 'completed').length}</div>
          <div className="kpi-label" data-i18n="kpi_missions">Missions terminées ce mois</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-top">
            <div className="kpi-icon" style={{ background: 'var(--pl)' }}>👥</div>
            <span className="kpi-trend up">↑ +832</span>
          </div>
          <div className="kpi-val">{users.length}</div>
          <div className="kpi-label" data-i18n="kpi_users">Utilisateurs actifs</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-top">
            <div className="kpi-icon" style={{ background: 'var(--gol)' }}>🪙</div>
            <span className="kpi-trend neutral">→ stable</span>
          </div>
          <div className="kpi-val">124K</div>
          <div className="kpi-label" data-i18n="kpi_coins">Maawa Coins en circulation</div>
        </div>
      </div>

      {/* SECONDARY KPIs */}
      <div className="stat-row au3">
        <div className="stat-mini"><div className="stat-mini-v" style={{ color: 'var(--b500)' }}>{users.filter(u => u.role === 'artisan').length}</div><div className="stat-mini-l">Artisans vérifiés</div></div>
        <div className="stat-mini"><div className="stat-mini-v" style={{ color: 'var(--gn)' }}>{users.filter(u => u.role === 'client').length}</div><div className="stat-mini-l">Clients inscrits</div></div>
        <div className="stat-mini"><div className="stat-mini-v" style={{ color: 'var(--or)' }}>0</div><div className="stat-mini-l">Litiges ouverts</div></div>
        <div className="stat-mini"><div className="stat-mini-v" style={{ color: 'var(--pu)' }}>0</div><div className="stat-mini-l">NIN en attente</div></div>
        <div className="stat-mini"><div className="stat-mini-v" style={{ color: 'var(--rd)' }}>0</div><div className="stat-mini-l">Contenus signalés</div></div>
        <div className="stat-mini"><div className="stat-mini-v" style={{ color: 'var(--gn)' }}>0</div><div className="stat-mini-l">DZD SafePay escrow</div></div>
      </div>

      <div className="grid-3 au4">
        {/* REVENUE CHART */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--b500)" strokeWidth="2">
                <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                <polyline points="16 7 22 7 22 13" />
              </svg>
              Revenus journaliers (DZD)
            </div>
            <div className="btn-row">
              <button className="btn btn-ghost btn-sm on" style={{ background: 'var(--b500)', color: '#fff', borderColor: 'var(--b500)' }}>7j</button>
              <button className="btn btn-ghost btn-sm" onClick={() => toast('Vue 30j')}>30j</button>
            </div>
          </div>
          <div className="card-body">
            <div className="bar-chart" id="revenue-chart"></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontSize: '.72rem', color: 'var(--text3)' }} data-i18n="this_week">Cette semaine</div>
                <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: '.92rem', color: 'var(--text)' }}>1,94M DZD</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '.72rem', color: 'var(--text3)' }} data-i18n="last_week">Semaine passée</div>
                <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: '.92rem', color: 'var(--text)' }}>1,61M DZD</div>
              </div>
            </div>
          </div>
        </div>

        {/* MISSION DONUT */}
        <div className="card">
          <div className="card-header">
            <div className="card-title" data-i18n="missions_status">Statut Missions</div>
          </div>
          <div className="card-body">
            <div className="donut-section">
              <div className="donut-ring">
                <svg viewBox="0 0 42 42">
                  <circle cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke="var(--border2)" strokeWidth="3" />
                  <circle cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke="var(--b500)" strokeWidth="3" strokeDasharray="42 58" strokeDashoffset="0" />
                  <circle cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke="var(--gn)" strokeWidth="3" strokeDasharray="32 68" strokeDashoffset="-42" />
                  <circle cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke="var(--or)" strokeWidth="3" strokeDasharray="15 85" strokeDashoffset="-74" />
                  <circle cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke="var(--rd)" strokeWidth="3" strokeDasharray="11 89" strokeDashoffset="-89" />
                </svg>
                <div className="donut-center">
                  <div className="donut-val">1 284</div>
                  <div className="donut-lbl">Total</div>
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div className="legend-item"><div className="legend-dot" style={{ background: 'var(--b500)' }}></div>En cours <span style={{ marginLeft: 'auto', fontWeight: 700, fontSize: '.78rem' }}>{missions.filter(m => m.status === 'in_progress').length}</span></div>
                <div className="legend-item"><div className="legend-dot" style={{ background: 'var(--gn)' }}></div>Terminées <span style={{ marginLeft: 'auto', fontWeight: 700, fontSize: '.78rem' }}>{missions.filter(m => m.status === 'completed').length}</span></div>
                <div className="legend-item"><div className="legend-dot" style={{ background: 'var(--or)' }}></div>En dispatch <span style={{ marginLeft: 'auto', fontWeight: 700, fontSize: '.78rem' }}>{missions.filter(m => m.status === 'pending').length}</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid-2 au4" style={{ marginTop: '14px' }}>
        {/* TOP WILAYAS */}
        <div className="card">
          <div className="card-header">
            <div className="card-title" data-i18n="top_wilayas">🗺️ Top Wilayas — Activité</div>
            <button className="btn btn-ghost btn-sm" onClick={() => router.push('/admin/analytics')}>Voir tout →</button>
          </div>
          <div className="card-body">
            <div className="map-widget" style={{ marginBottom: '12px' }}>
              <div className="map-pin" style={{ top: '30%', left: '32%', fontSize: '1.4rem' }}>📍</div>
              <div className="map-pin" style={{ top: '28%', left: '60%', fontSize: '1.1rem' }}>📍</div>
              <div className="map-pin" style={{ top: '45%', left: '48%', fontSize: '.9rem' }}>📍</div>
              <div className="map-pin" style={{ top: '22%', left: '25%', fontSize: '.85rem' }}>📍</div>
              <div className="map-pin" style={{ top: '55%', left: '36%', fontSize: '.8rem' }}>📍</div>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.75rem', fontWeight: 600, color: 'var(--b500)' }} data-i18n="map_label">Algérie · 48 Wilayas</div>
              <div className="map-legend">
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--b500)' }}></div>Haute activité
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--b300)' }}></div>Activité normale
                </div>
              </div>
            </div>
            <div className="mini-bar-row">
              <div className="mini-bar-label">16 · Alger</div>
              <div className="mini-bar-track"><div className="mini-bar-fill" style={{ width: '88%', background: 'var(--b500)' }}></div></div>
              <div className="mini-bar-val">18 421</div>
            </div>
            <div className="mini-bar-row">
              <div className="mini-bar-label">31 · Oran</div>
              <div className="mini-bar-track"><div className="mini-bar-fill" style={{ width: '54%', background: 'var(--b400)' }}></div></div>
              <div className="mini-bar-val">11 242</div>
            </div>
            <div className="mini-bar-row">
              <div className="mini-bar-label">25 · Constantine</div>
              <div className="mini-bar-track"><div className="mini-bar-fill" style={{ width: '38%', background: 'var(--b300)' }}></div></div>
              <div className="mini-bar-val">7 884</div>
            </div>
            <div className="mini-bar-row">
              <div className="mini-bar-label">06 · Béjaïa</div>
              <div className="mini-bar-track"><div className="mini-bar-fill" style={{ width: '28%', background: 'var(--b200)' }}></div></div>
              <div className="mini-bar-val">5 712</div>
            </div>
            <div className="mini-bar-row">
              <div className="mini-bar-label">09 · Blida</div>
              <div className="mini-bar-track"><div className="mini-bar-fill" style={{ width: '22%', background: 'var(--b200)' }}></div></div>
              <div className="mini-bar-val">4 559</div>
            </div>
          </div>
        </div>

        {/* ACTIVITY FEED */}
        <div className="card">
          <div className="card-header">
            <div className="card-title" data-i18n="activity_live">⚡ Activité temps réel</div>
            <span className="badge badge-green">
              <div className="badge-dot" style={{ background: 'var(--gn)', animation: 'pulse 1.5s infinite' }}></div>Live
            </span>
          </div>
          <div className="card-body" style={{ padding: '8px 18px' }}>
            <div className="activity-item">
              <div className="activity-icon" style={{ background: 'var(--gl)' }}>✅</div>
              <div className="activity-content">
                <div className="activity-text">Mission <strong>#MW-4821</strong> validée — Karim Plombier · Alger</div>
                <div className="activity-time">Il y a 1 min</div>
              </div>
              <span className="badge badge-green">+4 500 DZD</span>
            </div>
            <div className="activity-item">
              <div className="activity-icon" style={{ background: 'var(--pl)' }}>👤</div>
              <div className="activity-content">
                <div className="activity-text">Nouveau client inscrit : <strong>Meriem B.</strong> · Oran</div>
                <div className="activity-time">Il y a 3 min</div>
              </div>
            </div>
            <div className="activity-item">
              <div className="activity-icon" style={{ background: 'var(--rl)' }}>🚨</div>
              <div className="activity-content">
                <div className="activity-text">Litige ouvert <strong>#D-2041</strong> — Mission #MW-4799</div>
                <div className="activity-time">Il y a 5 min</div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => router.push('/admin/disputes')}>Voir</button>
            </div>
            <div className="activity-item">
              <div className="activity-icon" style={{ background: 'var(--b100)' }}>🔧</div>
              <div className="activity-content">
                <div className="activity-text">NIN soumis : <strong>Yacine M.</strong> · Électricien · Tizi Ouzou</div>
                <div className="activity-time">Il y a 8 min</div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => router.push('/admin/verification')}>Vérifier</button>
            </div>
            <div className="activity-item">
              <div className="activity-icon" style={{ background: 'var(--gol)' }}>🪙</div>
              <div className="activity-content">
                <div className="activity-text">Achat <strong>500 MC</strong> · Abdellah R. via Chargily Pay</div>
                <div className="activity-time">Il y a 11 min</div>
              </div>
            </div>
            <div className="activity-item">
              <div className="activity-icon" style={{ background: 'var(--gl)' }}>🔒</div>
              <div className="activity-content">
                <div className="activity-text">SafePay libéré <strong>18 000 DZD</strong> — Mission #MW-4815</div>
                <div className="activity-time">Il y a 14 min</div>
              </div>
            </div>
            <div className="activity-item">
              <div className="activity-icon" style={{ background: 'var(--rl)' }}>🚫</div>
              <div className="activity-content">
                <div className="activity-text">Post signalé par 3 utilisateurs — <strong>@sofiane.m</strong></div>
                <div className="activity-time">Il y a 18 min</div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => router.push('/admin/moderation')}>Modérer</button>
            </div>
          </div>
        </div>
      </div>

      {/* TOP ARTISANS TABLE */}
      <div className="card au5" style={{ marginTop: '14px' }}>
        <div className="card-header">
          <div className="card-title" data-i18n="top_artisans">⭐ Top Artisans — Ce mois</div>
          <button className="btn btn-ghost btn-sm" onClick={() => router.push('/admin/users')}>Voir tous →</button>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Artisan</th>
                <th data-i18n="th_trade">Métier</th>
                <th data-i18n="th_wilaya">Wilaya</th>
                <th>Missions</th>
                <th>Revenus DZD</th>
                <th>Note</th>
                <th>Statut</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {artisans.map((artisan, index) => (
                <tr key={artisan.uid || artisan.id}>
                  <td style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, color: index === 0 ? 'var(--go)' : 'var(--text3)' }}>
                    {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                  </td>
                  <td className="name">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div className="avatar av1">{artisan.displayName?.substring(0,2).toUpperCase() || 'A'}</div>
                      {artisan.displayName || 'Artisan'}
                    </div>
                  </td>
                  <td>{artisan.trade || 'Service'}</td>
                  <td>{artisan.wilaya || 'Alger'}</td>
                  <td><strong>{artisan.missions?.length || 0}</strong></td>
                  <td style={{ fontWeight: 700, color: 'var(--b600)' }}>{(artisan.missions?.length || 0) * 1500}</td>
                  <td><span style={{ color: 'var(--go)' }}>★★★★★</span> {artisan.rating || 'N/A'}</td>
                  <td><span className="badge badge-green">✓ Vérifié</span></td>
                  <td><button className="btn-icon" onClick={openUserModal}><SearchIcon /></button></td>
                </tr>
              ))}
              {artisans.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '20px' }}>Aucun artisan trouvé.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
