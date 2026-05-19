'use client';

import { useRouter } from 'next/navigation';
import { useNotifications } from '@/lib/hooks';
import { db, auth } from '@/lib/firebase';
import { doc, updateDoc, writeBatch, collection, query, where, getDocs } from 'firebase/firestore';

const TYPE_ICON: Record<string, string> = {
  success: '✅',
  info: '💬',
  wallet: '🪙',
  mission: '📋',
  warning: '⚠️',
};
const TYPE_BG: Record<string, string> = {
  success: 'var(--gl)',
  info: 'var(--b50)',
  wallet: 'var(--ol)',
  mission: 'var(--b100)',
  warning: 'var(--rl)',
};
const TYPE_ROUTE: Record<string, string> = {
  success: '/missions',
  info: '/chat',
  wallet: '/wallet',
  mission: '/missions',
  warning: '/settings',
};

export default function NotificationsPage() {
  const router = useRouter();
  const { notifications } = useNotifications();

  const markAsRead = async (notifId: string) => {
    if (!auth.currentUser) return;
    try {
      await updateDoc(doc(db, 'notifications', notifId), { unread: false });
    } catch (err) {
      console.error('Mark read error:', err);
    }
  };

  const markAllAsRead = async () => {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;
    try {
      const q = query(
        collection(db, 'notifications'),
        where('userId', '==', uid),
        where('unread', '==', true)
      );
      const snap = await getDocs(q);
      const batch = writeBatch(db);
      snap.docs.forEach(d => batch.update(d.ref, { unread: false }));
      await batch.commit();
    } catch (err) {
      console.error('Mark all read error:', err);
    }
  };

  const handleClick = async (n: any) => {
    if (n.unread) await markAsRead(n.id);
    router.push(TYPE_ROUTE[n.type] || '/feed');
  };

  const unreadCount = notifications.filter(n => n.unread).length;

  return (
    <div className="screen on" id="s-notifications">
      <div className="page-title-row">
        <div className="pt-head">
          🔔 Notifications
          {unreadCount > 0 && (
            <span style={{ marginLeft: '8px', background: 'var(--b500)', color: '#fff', fontSize: '.65rem', fontWeight: 700, padding: '2px 7px', borderRadius: '50px' }}>
              {unreadCount} non lu{unreadCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button className="btn-outline sm" onClick={markAllAsRead}>
            ✓ Tout lire
          </button>
        )}
      </div>

      <div className="notif-list">
        {notifications.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text3)' }}>
            <div style={{ fontSize: '3.2rem', marginBottom: '12px' }}>🔕</div>
            <div style={{ fontWeight: 600, fontSize: '.95rem', color: 'var(--text2)' }}>
              Aucune notification pour le moment
            </div>
            <div style={{ fontSize: '.78rem', marginTop: '6px', maxWidth: 300, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.5 }}>
              Vous serez prévenu ici dès qu&apos;un artisan répondra à vos demandes ou qu&apos;une mission évoluera.
            </div>
          </div>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              className={`notif-item ${n.unread ? 'unread' : ''}`}
              onClick={() => handleClick(n)}
              style={{ cursor: 'pointer', transition: 'opacity .2s', opacity: n.unread ? 1 : 0.65 }}
            >
              <div className="ni-icon" style={{ background: TYPE_BG[n.type] || 'var(--b50)' }}>
                {TYPE_ICON[n.type] || '🔔'}
              </div>
              <div className="ni-body" style={{ flex: 1 }}>
                <div className="ni-title"><span>{n.title}</span></div>
                <div className="ni-text"><span>{n.desc}</span></div>
                <div className="ni-time"><span>{n.time}</span></div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
                {n.unread && <div className="ni-dot" />}
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
