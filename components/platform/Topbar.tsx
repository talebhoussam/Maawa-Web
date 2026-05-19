'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useMaawa } from '@/lib/store';
import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { useNotifications, useChat, useMissions } from '@/lib/hooks';

export default function Topbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { lang, dark, mode, user, setLang, toggleDark, setMode, toggleSb } = useMaawa();
  const { notifications } = useNotifications();
  const { chats } = useChat();
  const { missions } = useMissions();

  const unreadNotifs = notifications.filter(n => n.unread).length;
  const unreadChats = chats.reduce((sum, c) => sum + (c.unread || 0), 0);
  const activeMissions = missions.filter(m => m.status !== 'terminee').length;

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/login');
  };

  // Compute avatar initials from real user data
  const initials = user?.displayName
    ? user.displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() || 'U';

  // Active state for the .tn buttons (formerly handled by adding/removing 'on')
  const isActive = (segment: string) =>
    pathname === '/' + segment || pathname.startsWith('/' + segment + '/');

  return (
    <header className="topbar">
      <div className="tb-logo">
        <button
          id="menu-btn"
          className="ib"
          onClick={toggleSb}
          style={{ marginRight: '3px' }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <div className="tb-logo-box">
          <svg width="18" height="16" viewBox="0 0 60 55" fill="none">
            <path d="M30 5L55 27L50 27L50 50L35 50L35 36L25 36L25 50L10 50L10 27L5 27Z" stroke="#29B6F6" strokeWidth="3" fill="none" strokeLinejoin="round" />
            <path d="M18 42L18 22L30 34L42 22L42 42" stroke="#29B6F6" strokeWidth="3" fill="none" strokeLinecap="round" />
            <path d="M10 50Q30 60 50 50" stroke="#29B6F6" strokeWidth="2.2" fill="none" strokeLinecap="round" />
          </svg>
        </div>
        <span className="tb-logo-txt">Maawa</span>
      </div>
      <div className="tb-search">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input type="text" id="tb-si" placeholder="Artisan, service, wilaya…" />
      </div>
      <nav className="tb-nav">
        <button className={isActive('feed') ? 'tn on' : 'tn'} id="tn-feed" onClick={() => router.push('/feed')}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
            <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
          </svg>
        </button>
        <button className={isActive('explore') ? 'tn on' : 'tn'} id="tn-explore" onClick={() => router.push('/explore')}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
        </button>
        <button className={isActive('categories') ? 'tn on' : 'tn'} id="tn-categories" onClick={() => router.push('/categories')}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
          </svg>
        </button>
        <button className={isActive('reels') ? 'tn on' : 'tn'} id="tn-reels" onClick={() => router.push('/reels')}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="23 7 16 12 23 17 23 7" />
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
          </svg>
        </button>
        <button className={isActive('missions') ? 'tn on' : 'tn'} id="tn-missions" onClick={() => router.push('/missions')}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 11l3 3L22 4" />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </svg>
          {activeMissions > 0 && <span className="tn-badge">{activeMissions}</span>}
        </button>
        <button className={isActive('wallet') ? 'tn on' : 'tn'} id="tn-wallet" onClick={() => router.push('/wallet')}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="1" y="4" width="22" height="16" rx="2" />
            <line x1="1" y1="10" x2="23" y2="10" />
          </svg>
        </button>
      </nav>
      <div className="tb-right">
        <div className="ctrl-group">
          <div className="lang-pill">
            <div className={lang === 'en' ? 'lp on' : 'lp'} id="lp-en" onClick={() => setLang('en')}>🇬🇧 EN</div>
            <div className={lang === 'fr' ? 'lp on' : 'lp'} id="lp-fr" onClick={() => setLang('fr')}>🇫🇷 FR</div>
            <div className={lang === 'ar' ? 'lp on' : 'lp'} id="lp-ar" onClick={() => setLang('ar')}>🇩🇿 AR</div>
          </div>
          <div className="dm-btn" id="dm-btn" onClick={toggleDark}>{dark ? '☀️' : '🌙'}</div>
          {/* Artisan-mode toggle — only visible if the user has been
              admin-promoted to role:'artisan'. Plain clients never see
              this pill (Phase 6 requirement). */}
          {user?.role === 'artisan' && (
            <div className="mode-pill">
              <div
                className={mode === 'client' ? 'mp on' : 'mp'}
                id="mp-c"
                data-i18n="tab_client"
                onClick={() => { setMode('client'); router.push('/feed'); }}
              >
                👤 Client
              </div>
              <div
                className={mode === 'artisan' ? 'mp on' : 'mp'}
                id="mp-a"
                data-i18n="tab_artisan"
                onClick={() => { setMode('artisan'); router.push('/dashboard'); }}
              >
                🔧 Artisan
              </div>
            </div>
          )}
        </div>
        <button className="call-btn" onClick={() => { window.location.href = 'tel:+213233000000'; }}>
          <div className="call-ring"></div>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.62 3.38C1.62 2.18 2.53 1 3.72 1h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
          </svg>
          <span id="t-call-btn">Appeler Maawa</span>
        </button>
        {user ? (
          <>
            <button className="ib" onClick={() => router.push('/chat')} style={{ position: 'relative' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              {unreadChats > 0 && <span className="tn-badge" style={{ position: 'absolute', top: '3px', right: '3px' }}>{unreadChats}</span>}
            </button>
            <button className="ib" onClick={() => router.push('/notifications')} style={{ position: 'relative' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              {unreadNotifs > 0 && <span className="tn-badge" style={{ position: 'absolute', top: '3px', right: '3px' }}>{unreadNotifs}</span>}
            </button>
            <div
              className="av-sm av1"
              onClick={() => router.push('/settings')}
              title={user?.displayName || user?.email || 'Profil'}
              style={{ cursor: 'pointer' }}
            >
              {initials}
            </div>
            <button
              className="ib"
              onClick={handleLogout}
              title="Déconnexion"
              style={{ marginLeft: '4px', fontSize: '1rem' }}
            >
              🚪
            </button>
          </>
        ) : (
          /* Guest top-right — Phase 6: replaces avatar + notifs with
             explicit login / register CTAs. No badges to show anyway. */
          <>
            <button className="btn-outline sm" onClick={() => router.push('/login')}>
              Se connecter
            </button>
            <button className="btn-primary sm" onClick={() => router.push('/register')}>
              S&apos;inscrire
            </button>
          </>
        )}
      </div>
    </header>
  );
}
