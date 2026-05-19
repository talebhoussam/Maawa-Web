import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import {
  onSnapshot,
  query,
  collection,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';

// ─── Helper: get a stable user ID that triggers re-runs safely ───────────────
function useCurrentUid() {
  const [uid, setUid] = useState<string | null>(null);
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUid(u?.uid ?? null));
    return unsub;
  }, []);
  return uid;
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useMissions() {
  const uid = useCurrentUid();
  const [missions, setMissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid || !db) { setLoading(false); return; }
    try {
      const q = query(collection(db, 'missions'), where('clientId', '==', uid), limit(50));
      const unsub = onSnapshot(q,
        (snap) => {
          setMissions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
          setLoading(false);
        },
        (err) => { console.error('missions:', err); setLoading(false); }
      );
      return unsub;
    } catch { setLoading(false); }
  }, [uid]);

  return { missions, loading };
}

export function useWallet() {
  const uid = useCurrentUid();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid || !db) { setLoading(false); return; }
    try {
      const q = query(collection(db, 'transactions'), where('userId', '==', uid), limit(50));
      const unsub = onSnapshot(q,
        (snap) => {
          setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
          setLoading(false);
        },
        () => setLoading(false)
      );
      return unsub;
    } catch { setLoading(false); }
  }, [uid]);

  return { transactions, loading };
}

export function useFeed() {
  /* Public-readable as of Phase 6 — guests can browse the feed.
     We don't need `uid` here anymore. */
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!db) { setLoading(false); return; }
    try {
      const q = query(collection(db, 'feed_posts'), orderBy('createdAt', 'desc'), limit(50));
      const unsub = onSnapshot(q,
        (snap) => {
          setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
          setLoading(false);
        },
        () => setLoading(false)
      );
      return unsub;
    } catch { setLoading(false); }
  }, []);

  return { posts, loading };
}

export function useChat() {
  const uid = useCurrentUid();
  const [chats, setChats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid || !db) { setLoading(false); return; }
    try {
      /* Sort by lastMessageAt desc; clients without lastMessageAt
         (very old test docs) fall to the bottom in sort below. */
      const q = query(
        collection(db, 'chats'),
        where('participants', 'array-contains', uid),
        orderBy('lastMessageAt', 'desc'),
      );
      const unsub = onSnapshot(q,
        (snap) => {
          const rows = snap.docs.map(d => {
            const data = d.data() as Record<string, unknown>;
            /* Normalize unread to a number — the doc stores a per-uid
               map (Phase 5) but legacy data may have a bare number.
               UI code reads `c.unread` as a number. */
            const rawUnread = data.unread;
            const unread = typeof rawUnread === 'number'
              ? rawUnread
              : (rawUnread && typeof rawUnread === 'object')
                ? Number((rawUnread as Record<string, number>)[uid] ?? 0)
                : 0;
            return { id: d.id, ...data, unread };
          });
          setChats(rows);
          setLoading(false);
        },
        () => setLoading(false)
      );
      return unsub;
    } catch { setLoading(false); }
  }, [uid]);

  return { chats, loading };
}

export function useNotifications() {
  const uid = useCurrentUid();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid || !db) { setLoading(false); return; }
    try {
      const q = query(collection(db, 'notifications'), where('userId', '==', uid), limit(50));
      const unsub = onSnapshot(q,
        (snap) => {
          setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() })));
          setLoading(false);
        },
        () => setLoading(false)
      );
      return unsub;
    } catch { setLoading(false); }
  }, [uid]);

  return { notifications, loading };
}

// ─── Admin Hooks ──────────────────────────────────────────────────────────────

export function useAdminMissions() {
  const [missions, setMissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!db) { setLoading(false); return; }
    try {
      const q = query(collection(db, 'missions'), orderBy('createdAt', 'desc'), limit(50));
      const unsub = onSnapshot(q,
        (snap) => {
          setMissions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
          setLoading(false);
        },
        (err) => { console.error('admin missions:', err); setLoading(false); }
      );
      return unsub;
    } catch { setLoading(false); }
  }, []);

  return { missions, loading };
}

export function useAdminUsers() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!db) { setLoading(false); return; }
    try {
      const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(50));
      const unsub = onSnapshot(q,
        (snap) => {
          setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
          setLoading(false);
        },
        (err) => { console.error('admin users:', err); setLoading(false); }
      );
      return unsub;
    } catch { setLoading(false); }
  }, []);

  return { users, loading };
}
