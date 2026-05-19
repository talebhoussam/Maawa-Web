'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useMaawa } from '@/lib/store';
import { toast } from '@/lib/toast';
import { useNotifications, useChat, useMissions } from '@/lib/hooks';

/**
 * Left-rail navigation.
 *
 * Phase 2 cleanup:
 *   - Badges (Messages / Notifications / Missions) read from the real
 *     hooks (useChat / useNotifications / useMissions) and only render
 *     when count > 0.
 *   - Removed the hardcoded "Artisans proches" list. The real nearby
 *     query needs geolocation + a Firestore geohash index; tracked
 *     for a later phase. Until then, the section is hidden entirely.
 *   - Removed the "Karim Plombier" header and fake stat tiles from the
 *     artisan-mode sidebar — those now read from `user` directly.
 *   - "Devenir Artisan" sub-copy switched from "+3 800 artisans Maawa"
 *     to qualitative copy ("Rejoignez la communauté Maawa").
 *
 * The category list under "Services Artisanaux" is intentionally kept
 * as UI/discovery shortcuts — those are static platform categories,
 * not user data.
 */
export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { sidebar, mode, user, toggleSb } = useMaawa();
  const { notifications } = useNotifications();
  const { chats } = useChat();
  const { missions } = useMissions();

  const unreadNotifs = notifications.filter(n => n.unread).length;
  const unreadChats = chats.reduce((sum, c) => sum + (c.unread || 0), 0);
  const activeMissions = missions.filter(m => m.status !== 'terminee').length;

  const isActive = (segment: string) =>
    pathname === '/' + segment || pathname.startsWith('/' + segment + '/');

  /* Initials for the user header. Drops cleanly to "MA" when displayName
     is missing, so a freshly created account doesn't show "undefined". */
  const initials = user?.displayName
    ? user.displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : (user?.email?.[0]?.toUpperCase() || 'MA');

  const supportPhone = process.env.NEXT_PUBLIC_SUPPORT_PHONE || '+213233000000';
  const callMaawa = () => { window.location.href = `tel:${supportPhone}`; };

  return (
    <>
      <div
        className={sidebar ? 'sb-overlay on' : 'sb-overlay'}
        id="sb-overlay"
        onClick={toggleSb}
      />
      <aside
        className={sidebar ? 'sidebar open' : 'sidebar'}
        id="sidebar"
      >
        {/* CLIENT SIDEBAR */}
        <div id="sb-client" style={mode === 'artisan' ? { display: 'none' } : undefined}>
          <div className="sb-user">
            <div className="sb-av av1">{initials}</div>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div className="sb-name">{user?.displayName || 'Utilisateur Maawa'}</div>
              <div className="sb-meta">📍 {user?.wilaya || 'Algérie'} · <span id="sb-role-lbl">Client</span></div>
              <div className="mc-tag">🪙 {user?.maawaCoinBalance ?? 0} MC</div>
            </div>
          </div>
          <div className={isActive('feed') ? 'si on' : 'si'} onClick={() => router.push('/feed')}>
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" /></svg>
            <span id="si-feed">Fil d&apos;Actualité</span>
          </div>
          <div className={isActive('explore') ? 'si on' : 'si'} onClick={() => router.push('/explore')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
            <span id="si-explore">Explorer</span>
          </div>
          <div className={isActive('categories') ? 'si on' : 'si'} onClick={() => router.push('/categories')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
            </svg>
            <span id="si-categories">Catégories</span>
          </div>
          <div className={isActive('quote') ? 'si on' : 'si'} onClick={() => router.push('/quote')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
            <span id="si-quote">Estimation IA</span><span className="si-tag">GPT-4o</span>
          </div>
          <div className={isActive('reels') ? 'si on' : 'si'} onClick={() => router.push('/reels')} id="si-reels-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>
            <span id="si-reels">Reels</span><span className="si-tag" style={{ background: 'var(--rl)', color: 'var(--rd)' }}>NEW</span>
          </div>

          <div className={isActive('missions') ? 'si on' : 'si'} onClick={() => router.push('/missions')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
            <span id="si-missions">Mes Missions</span>
            {activeMissions > 0 && <span className="si-badge">{activeMissions}</span>}
          </div>
          <div className={isActive('wallet') ? 'si on' : 'si'} onClick={() => router.push('/wallet')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>
            <span id="si-wallet">Maawa Coin</span>
          </div>
          {/* Nearby artisans — the geolocation + geohash query is on the
              Phase 4+ roadmap. Until then we hide the section entirely
              rather than show three hardcoded fake names. */}
          {/* DEVENIR ARTISAN */}
          {user?.role !== 'artisan' && (
            <div className="apply-artisan-btn" onClick={() => router.push('/apply')}>
              <div className="aab-icon">🔧</div>
              <div>
                <div className="aab-title" data-i18n="apply_title">Devenir Artisan</div>
                <div className="aab-sub" data-i18n="apply_sub">Rejoignez la communauté Maawa</div>
              </div>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--or)" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
            </div>
          )}
          <div className="sb-section" id="si-svc-sct">Services Artisanaux</div>
          <div className="si" onClick={() => router.push('/categories')}><span>🔧</span><span id="si-plomb">Plomberie</span></div>
          <div className="si" onClick={() => router.push('/categories')}><span>⚡</span><span id="si-elec">Électricité</span></div>
          <div className="si" onClick={() => router.push('/categories')}><span>🎨</span><span id="si-paint">Peinture &amp; Déco</span></div>
          <div className="si" onClick={() => router.push('/categories')}><span>🧱</span><span id="si-macon">Maçonnerie</span></div>
          <div className="si" onClick={() => router.push('/categories')}><span>🪚</span><span id="si-menu">Menuiserie</span></div>
          <div className="sb-section" id="si-maawa-sct">Maawa</div>
          <div className="si" onClick={() => toast('🔒')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg><span id="si-safepay">SafePay 🔒</span></div>
          <div className="si si-call" onClick={callMaawa}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.62 3.38C1.62 2.18 2.53 1 3.72 1h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
            <span id="si-call-maawa">📞 Appeler Maawa</span>
          </div>
          <div style={{ marginTop: 'auto', paddingTop: '9px', borderTop: '1px solid var(--border)' }}>
            <div className="si" onClick={() => router.push('/chat')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
              <span id="si-chat">Messages</span>
              {unreadChats > 0 && <span className="si-badge">{unreadChats}</span>}
            </div>
            <div className="si" onClick={() => router.push('/notifications')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
              <span id="si-notifs">Notifications</span>
              {unreadNotifs > 0 && <span className="si-badge">{unreadNotifs}</span>}
            </div>
            <div className="si" id="si-saved-nav" onClick={() => router.push('/saved')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m19 21-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></svg>
              <span id="si-saved">Enregistrements</span>
            </div>
            <div className="si" onClick={() => router.push('/settings')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l-.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
              <span id="si-settings">Paramètres</span>
            </div>
            <div style={{ fontSize: '.59rem', color: 'var(--text3)', textAlign: 'center', padding: '6px 0 2px' }}>© 2026 <strong style={{ color: 'var(--b500)' }}>Maawa</strong> &amp; ustal.dev 🇩🇿</div>
          </div>
        </div>

        {/* ARTISAN SIDEBAR */}
        <div id="sb-artisan" style={mode === 'artisan' ? undefined : { display: 'none' }}>
          {/* Real user header — no more fake "Karim Plombier" */}
          <div className="sb-user">
            <div className="sb-av av1">{initials}</div>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div className="sb-name">
                {user?.displayName || 'Artisan Maawa'}
                {user?.verified && <span className="badge-v" style={{ marginLeft: 4, fontSize: '.55rem' }}>✓</span>}
              </div>
              <div className="sb-meta">
                {user?.trade || '🔧 Artisan'} · 📍 {user?.wilaya || 'Algérie'}
              </div>
              <div className="mc-tag">🪙 {user?.maawaCoinBalance ?? 0} MC</div>
            </div>
          </div>
          <div className={isActive('dashboard') ? 'si on' : 'si'} onClick={() => router.push('/dashboard')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="11" /><rect x="14" y="14" width="7" height="11" /></svg>
            <span id="si-dashboard">Tableau de bord</span>
          </div>
          <div className={isActive('artisan') && pathname.includes('bookings') ? 'si on' : 'si'} onClick={() => router.push('/artisan/bookings')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
            <span>Demandes</span>
            {activeMissions > 0 && <span className="si-badge">{activeMissions}</span>}
          </div>
          <div className={isActive('artisan') && pathname.includes('calendar') ? 'si on' : 'si'} onClick={() => router.push('/artisan/calendar')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
            <span>Calendrier</span>
          </div>
          <div className={isActive('artisan') && pathname.includes('earnings') ? 'si on' : 'si'} onClick={() => router.push('/artisan/earnings')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
            <span>Revenus</span>
          </div>
          <div className="si" onClick={() => router.push('/dashboard/portfolio')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
            <span id="si-portfolio">Portfolio &amp; Reels</span>
          </div>
          <div className="si" onClick={() => router.push('/reels')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>
            <span data-i18n="si_reels">Reels</span>
          </div>
          <div className="si" onClick={() => router.push('/artisan/reels/new')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            <span>Publier un Reel</span>
          </div>
          <div className="si" onClick={() => router.push('/wallet')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>
            <span data-i18n="si_wallet">Maawa Coin</span>
          </div>
          <div className="si si-call" onClick={callMaawa}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.62 3.38C1.62 2.18 2.53 1 3.72 1h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
            <span id="si-call-maawa2">📞 Appeler Maawa</span>
          </div>
          <div style={{ marginTop: 'auto', paddingTop: '9px', borderTop: '1px solid var(--border)' }}>
            <div className="si" onClick={() => router.push('/settings')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l-.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
              <span id="si-settings2">Paramètres</span>
            </div>
            <div style={{ fontSize: '.59rem', color: 'var(--text3)', textAlign: 'center', padding: '5px 0 2px' }}>© 2026 Maawa 🇩🇿</div>
          </div>
        </div>
      </aside>
    </>
  );
}
