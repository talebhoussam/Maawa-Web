'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useMaawa } from '@/lib/store';
import { toast } from '@/lib/toast';

export default function AdminSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { toggleSb } = useMaawa();

  const isActive = (segment: string) => {
    const target = '/admin/' + segment;
    return pathname === target || pathname.startsWith(target + '/');
  };

  const navTo = (segment: string) => router.push('/admin/' + segment);

  return (
    <aside className="sidebar" id="sidebar">
      <button className="sb-collapse-btn" id="sb-toggle-btn" onClick={toggleSb} title="Réduire">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>
      <div className="sb-logo">
        <div className="sb-logo-box">
          <svg width="16" height="14" viewBox="0 0 60 55" fill="none">
            <path d="M30 5L55 27L50 27L50 50L35 50L35 36L25 36L25 50L10 50L10 27L5 27Z" stroke="#29B6F6" strokeWidth="3" fill="none" strokeLinejoin="round" />
            <path d="M18 42L18 22L30 34L42 22L42 42" stroke="#29B6F6" strokeWidth="3" fill="none" strokeLinecap="round" />
          </svg>
        </div>
        <div className="sb-logo-text">
          <span className="sb-logo-name" id="sb-logo-txt-span" data-i18n="app_title">Maawa Admin</span>
          <span className="sb-logo-badge" id="sb-logo-badge" data-i18n="app_badge">BETA</span>
        </div>
      </div>

      <nav className="sb-nav">
        <div className="sb-section" id="nav-sct-main" data-i18n="nav_principal">Principal</div>
        <div className={isActive('dashboard') ? 'nav-item on' : 'nav-item'} onClick={() => navTo('dashboard')} title="Dashboard">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
          </svg>
          <span className="nav-item-label" id="nav-dashboard" data-i18n="nav_dashboard">Dashboard</span>
        </div>
        <div className={isActive('analytics') ? 'nav-item on' : 'nav-item'} onClick={() => navTo('analytics')} title="Analytics">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          <span className="nav-item-label" id="nav-analytics" data-i18n="nav_analytics">Analytics</span>
        </div>

        <div className="sb-section" id="nav-sct-users" data-i18n="nav_users_sct">Utilisateurs</div>
        <div className={isActive('users') ? 'nav-item on' : 'nav-item'} onClick={() => navTo('users')} title="Utilisateurs">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <span className="nav-item-label" id="nav-users" data-i18n="nav_users">Utilisateurs</span>
        </div>
        <div className={isActive('verification') ? 'nav-item on' : 'nav-item'} onClick={() => navTo('verification')} title="NIN">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <span className="nav-item-label" id="nav-verification" data-i18n="nav_verification">Vérification NIN</span>
          <span className="nav-badge">7</span>
        </div>

        <div className="sb-section" id="nav-sct-ops" data-i18n="nav_ops">Opérations</div>
        <div className={isActive('bookings') ? 'nav-item on' : 'nav-item'} onClick={() => navTo('bookings')} title="Réservations">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <span className="nav-item-label" id="nav-bookings-span" data-i18n="nav_bookings">Réservations</span>
          <span className="nav-badge">8</span>
        </div>
        <div className={isActive('missions') ? 'nav-item on' : 'nav-item'} onClick={() => navTo('missions')} title="Missions">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 11l3 3L22 4" />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </svg>
          <span className="nav-item-label" id="nav-missions" data-i18n="nav_missions">Missions</span>
        </div>
        <div className={isActive('applications') ? 'nav-item on' : 'nav-item'} onClick={() => navTo('applications')} title="Candidatures">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="8.5" cy="7" r="4" />
            <line x1="20" y1="8" x2="20" y2="14" />
            <line x1="23" y1="11" x2="17" y2="11" />
          </svg>
          <span className="nav-item-label" id="nav-applications-span" data-i18n="nav_applications">Candidatures</span>
          <span className="nav-badge">5</span>
        </div>
        <div className={isActive('finance') ? 'nav-item on' : 'nav-item'} onClick={() => navTo('finance')} title="Finance">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="1" y="4" width="22" height="16" rx="2" />
            <line x1="1" y1="10" x2="23" y2="10" />
          </svg>
          <span className="nav-item-label" id="nav-finance" data-i18n="nav_finance">Finance</span>
        </div>
        <div className={isActive('coin-requests') ? 'nav-item on' : 'nav-item'} onClick={() => navTo('coin-requests')} title="Demandes Maawa Coins">
          {/* Coin / wallet glyph — distinct from the Finance bank-card
              icon so the two are visually separable in the rail. */}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="9" />
            <text x="12" y="16" textAnchor="middle" fontSize="11" fontWeight="700" fill="currentColor" stroke="none">MC</text>
          </svg>
          <span className="nav-item-label" id="nav-coin-requests" data-i18n="nav_coin_requests">Demandes Coins</span>
        </div>
        <div className={isActive('support') ? 'nav-item on' : 'nav-item'} onClick={() => navTo('support')} title="Maawa Support">
          {/* Lifebuoy ring — visually matches the platform-side support badge. */}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="9" />
            <circle cx="12" cy="12" r="3" />
            <line x1="4.93" y1="4.93" x2="9.17" y2="9.17" />
            <line x1="14.83" y1="14.83" x2="19.07" y2="19.07" />
            <line x1="14.83" y1="9.17" x2="19.07" y2="4.93" />
            <line x1="4.93" y1="19.07" x2="9.17" y2="14.83" />
          </svg>
          <span className="nav-item-label" id="nav-support" data-i18n="nav_support">Support</span>
        </div>
        <div className={isActive('reports') ? 'nav-item on' : 'nav-item'} onClick={() => navTo('reports')} title="Signalements">
          {/* Flag icon — matches the 🚩 emoji used user-side. */}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
            <line x1="4" y1="22" x2="4" y2="15" />
          </svg>
          <span className="nav-item-label" id="nav-reports" data-i18n="nav_reports">Signalements</span>
        </div>
        <div className={isActive('content') ? 'nav-item on' : 'nav-item'} onClick={() => navTo('content')} title="Contenu">
          {/* Document stack — matches "feed posts + reels + stories" admin view. */}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="9" y1="13" x2="15" y2="13" />
            <line x1="9" y1="17" x2="15" y2="17" />
          </svg>
          <span className="nav-item-label" id="nav-content" data-i18n="nav_content">Contenu</span>
        </div>
        <div className={isActive('payouts') ? 'nav-item on' : 'nav-item'} onClick={() => navTo('payouts')} title="Retraits">
          {/* Cash-out icon */}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="1" x2="12" y2="23" />
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
          <span className="nav-item-label" id="nav-payouts" data-i18n="nav_payouts">Retraits</span>
        </div>
        <div className={isActive('disputes') ? 'nav-item on' : 'nav-item'} onClick={() => navTo('disputes')} title="Litiges">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <span className="nav-item-label" id="nav-disputes" data-i18n="nav_disputes">Litiges</span>
          <span className="nav-badge">3</span>
        </div>

        <div className="sb-section" id="nav-sct-content" data-i18n="nav_content">Contenu</div>
        <div className={isActive('categories') ? 'nav-item on' : 'nav-item'} onClick={() => navTo('categories')} title="Catégories">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
          </svg>
          <span className="nav-item-label" id="nav-categories-span" data-i18n="nav_categories">Catégories</span>
        </div>
        <div className={isActive('moderation') ? 'nav-item on' : 'nav-item'} onClick={() => navTo('moderation')} title="Modération">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span className="nav-item-label" id="nav-moderation" data-i18n="nav_moderation">Modération</span>
          <span className="nav-badge">12</span>
        </div>
        <div className={isActive('ads') ? 'nav-item on' : 'nav-item'} id="nav-ads" onClick={() => navTo('ads')} title="Publicités">
          {/* Megaphone — matches the other inline-SVG sidebar entries
              (24x24, currentColor stroke, no extra deps). */}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 11v2a1 1 0 0 0 1 1h3l5 4V6L7 10H4a1 1 0 0 0-1 1z" />
            <path d="M15.5 8.5a4 4 0 0 1 0 7" />
            <path d="M18.5 5.5a8 8 0 0 1 0 13" />
          </svg>
          <span className="nav-item-label" id="nav-ads-label" data-i18n="nav_ads">Publicités</span>
        </div>
        <div className={isActive('broadcast') ? 'nav-item on' : 'nav-item'} onClick={() => navTo('broadcast')} title="Diffusions">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12" />
          </svg>
          <span className="nav-item-label" id="nav-broadcast" data-i18n="nav_broadcast">Diffusions</span>
        </div>

        <div className="sb-section" id="nav-sct-system" data-i18n="nav_system">Système</div>
        <div className={isActive('heatmap') ? 'nav-item on' : 'nav-item'} onClick={() => navTo('heatmap')} title="Heatmap">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="2" y1="12" x2="22" y2="12" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </svg>
          <span className="nav-item-label" id="nav-heatmap-label" data-i18n="nav_heatmap">Heatmap</span>
        </div>
        <div className={isActive('settings') ? 'nav-item on' : 'nav-item'} onClick={() => navTo('settings')} title="Paramètres">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          <span className="nav-item-label" id="nav-settings" data-i18n="nav_settings">Paramètres</span>
        </div>
        <div className={isActive('audit') ? 'nav-item on' : 'nav-item'} onClick={() => navTo('audit')} title="Audit">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
          <span className="nav-item-label" id="nav-audit" data-i18n="nav_audit">Journal Audit</span>
        </div>
        <div className={isActive('admins') ? 'nav-item on' : 'nav-item'} id="nav-admins" onClick={() => navTo('admins')} title="Admins">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span className="nav-item-label" id="nav-admins-span" data-i18n="nav_admins">Gestion Admins</span>
        </div>
      </nav>

      <div className="sb-bottom">
        <div className="sb-user" onClick={() => toast('⚙️ Profil admin')}>
          <div className="sb-avatar">SA</div>
          <div className="sb-user-info">
            <div className="sb-uname">Super Admin</div>
            <div className="sb-urole" id="sb-user-role">Super Admin</div>
          </div>
        </div>
        <div className="nav-item" style={{ color: 'var(--rd)' }} onClick={() => router.push('/admin/login')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          <span className="nav-item-label" data-i18n="nav_logout">Déconnexion</span>
        </div>
      </div>
    </aside>
  );
}
