'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useMaawa } from '@/lib/store';
import { toast } from '@/lib/toast';

const PAGE_TITLES: Record<string, string> = {
  dashboard: 'Dashboard',
  analytics: 'Analytics 📈',
  users: 'Utilisateurs',
  verification: 'Vérification NIN',
  missions: 'Missions',
  finance: 'Finance & SafePay',
  disputes: 'Litiges',
  moderation: 'Modération',
  broadcast: 'Diffusions',
  audit: "Journal d'audit",
  categories: 'Catégories',
  applications: 'Candidatures Artisans',
  bookings: 'Réservations',
  admins: 'Gestion Admins',
  ads: 'Publicités',
  settings: 'Paramètres',
  heatmap: 'Heatmap',
  denied: 'Accès refusé 🔒',
};

export default function AdminTopbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { lang, dark, setLang, toggleDark, toggleSb } = useMaawa();
  const [notifOpen, setNotifOpen] = useState(false);

  const segment = pathname?.replace(/^\/admin\/?/, '').split('/')[0] || 'dashboard';
  const title = PAGE_TITLES[segment] ?? 'Dashboard';

  return (
    <header className="topbar">
      <button className="tb-menu-btn" id="menu-toggle" onClick={toggleSb}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>
      <div className="tb-title" id="page-title">{title}</div>
      <div className="tb-search">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input type="text" placeholder="Rechercher…" id="global-search" data-i18n-ph="search_ph" />
      </div>
      <div className="tb-actions">
        <div style={{ position: 'relative' }}>
          <button className="icon-btn" id="notif-btn" onClick={() => setNotifOpen(v => !v)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            <div className="dot"></div>
          </button>
          {/* Notification Panel */}
          <div className={notifOpen ? 'notif-panel on' : 'notif-panel'} id="notif-panel">
            <div className="notif-head">
              <div className="notif-title" id="notif-title-txt" data-i18n="notif_title">Notifications</div>
              <button className="btn btn-ghost btn-sm" onClick={() => setNotifOpen(false)}>✕</button>
            </div>
            <div className="notif-item unread">
              <div className="notif-icon" style={{ background: 'var(--rl)' }}>🚨</div>
              <div>
                <div className="notif-txt"><strong>Litige #D-2041</strong> — Escaladé</div>
                <div className="notif-time">Il y a 5 min</div>
              </div>
            </div>
            <div className="notif-item unread">
              <div className="notif-icon" style={{ background: 'var(--gol)' }}>⏳</div>
              <div>
                <div className="notif-txt"><strong>7 vérifications NIN</strong> en attente</div>
                <div className="notif-time">Il y a 1h</div>
              </div>
            </div>
            <div className="notif-item unread">
              <div className="notif-icon" style={{ background: 'var(--b50)' }}>📅</div>
              <div>
                <div className="notif-txt"><strong>8 réservations</strong> non assignées</div>
                <div className="notif-time">Il y a 2h</div>
              </div>
            </div>
            <div className="notif-item">
              <div className="notif-icon" style={{ background: 'var(--pl)' }}>📊</div>
              <div>
                <div className="notif-txt">Rapport <strong>Mars 2026</strong> disponible</div>
                <div className="notif-time">Hier 09:00</div>
              </div>
            </div>
            <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)' }}>
              <button className="btn btn-ghost btn-sm" style={{ width: '100%' }} onClick={() => { setNotifOpen(false); toast('✓ Toutes lues'); }} data-i18n="btn_read_all">
                Tout marquer lu
              </button>
            </div>
          </div>
        </div>
        <button className="icon-btn" onClick={() => toast('📊 Export en cours…')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </button>
        <div className="lang-pill">
          <button className={lang === 'ar' ? 'lp on' : 'lp'} id="lp-ar" onClick={() => setLang('ar')}>🇩🇿 AR</button>
          <button className={lang === 'fr' ? 'lp on' : 'lp'} id="lp-fr" onClick={() => setLang('fr')}>🇫🇷 FR</button>
          <button className={lang === 'en' ? 'lp on' : 'lp'} id="lp-en" onClick={() => setLang('en')}>🇬🇧 EN</button>
        </div>
        <button className="dm-btn" id="dm-btn" onClick={toggleDark}>{dark ? '☀️' : '🌙'}</button>
        <a href="#" onClick={(e) => { e.preventDefault(); router.push('/'); }} className="back-plat-btn">
          ← <span data-i18n="nav_back_platform">Plateforme</span>
        </a>
      </div>
    </header>
  );
}
