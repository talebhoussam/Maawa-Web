'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
  limit,
} from 'firebase/firestore';

/**
 * Saved items list.
 *
 * Phase 2 rewrite: the old page rendered four hardcoded artisan tiles
 * ("Karim Plombier", "Riad Boukhalfa", etc.). Now it reads from
 * `saved/*` (written by `feed/page.tsx#handleBookmark`) and joins
 * each bookmark with its source `feed_posts` doc.
 *
 * Filter tabs (Tous / Artisans / Posts) currently group by the
 * referenced doc's `type` field. Backwards-compatible: legacy bookmarks
 * without a type land in "Posts".
 */

interface SavedDoc {
  id: string;
  postId: string;
  userId: string;
}

interface SavedItem {
  saveId: string;
  postId: string;
  title?: string;
  artisan?: string;
  authorId?: string;
  trade?: string;
  type?: string; /* 'reel' | 'post' | 'artisan' | undefined */
}

type Tab = 'all' | 'artisans' | 'posts';

export default function SavedPage() {
  const router = useRouter();
  const [uid, setUid] = useState<string | null>(null);
  const [items, setItems] = useState<SavedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('all');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => setUid(u?.uid ?? null));
    return unsub;
  }, []);

  useEffect(() => {
    if (!uid || !db) { setLoading(false); return; }
    const q = query(collection(db, 'saved'), where('userId', '==', uid), limit(50));
    const unsub = onSnapshot(q, async snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as SavedDoc));
      /* Hydrate each bookmark with its source post. Best-effort: a missing
         source doc is fine — we just render the postId. */
      const hydrated: SavedItem[] = await Promise.all(docs.map(async (s) => {
        try {
          const p = await getDoc(doc(db, 'feed_posts', s.postId));
          const data = p.exists() ? p.data() : {};
          return {
            saveId: s.id,
            postId: s.postId,
            title:    typeof data.title    === 'string' ? data.title    : undefined,
            artisan:  typeof data.artisan  === 'string' ? data.artisan  : undefined,
            authorId: typeof data.authorId === 'string' ? data.authorId : undefined,
            trade:    typeof data.trade    === 'string' ? data.trade    : undefined,
            type:     typeof data.type     === 'string' ? data.type     : undefined,
          };
        } catch {
          return { saveId: s.id, postId: s.postId };
        }
      }));
      setItems(hydrated);
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [uid]);

  const filtered = items.filter(i => {
    if (tab === 'all') return true;
    if (tab === 'artisans') return i.type === 'artisan';
    return i.type !== 'artisan'; /* "posts" = everything that isn't an artisan card */
  });

  return (
    <div className="screen on" id="s-saved">
      <div className="page-title-row au">
        <div className="pt-head">🔖 <span id="t-saved-title">Mes Enregistrements</span></div>
      </div>
      <div style={{ display: 'flex', gap: '7px', marginBottom: '13px', flexWrap: 'wrap' }}>
        <button className={tab === 'all' ? 'mt on' : 'mt'} onClick={() => setTab('all')} id="t-saved-all">Tous</button>
        <button className={tab === 'artisans' ? 'mt on' : 'mt'} onClick={() => setTab('artisans')} id="t-saved-art">Artisans</button>
        <button className={tab === 'posts' ? 'mt on' : 'mt'} onClick={() => setTab('posts')} id="t-saved-post">Posts</button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text3)' }}>…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text3)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '10px' }}>🔖</div>
          <div style={{ fontWeight: 600, fontSize: '.92rem', color: 'var(--text2)' }}>
            Aucun élément enregistré
          </div>
          <div style={{ fontSize: '.78rem', marginTop: '6px', maxWidth: 300, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.5 }}>
            Touchez l&apos;icône 🔖 sur un post ou un artisan pour le retrouver ici.
          </div>
          <button className="btn-primary" style={{ marginTop: '14px' }} onClick={() => router.push('/feed')}>
            Aller au fil d&apos;actualité →
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: '12px' }} id="saved-grid">
          {filtered.map(item => (
            <div
              key={item.saveId}
              className="card"
              style={{ overflow: 'hidden', cursor: item.authorId ? 'pointer' : 'default', transition: 'all .22s' }}
              onClick={() => item.authorId && router.push(`/profile/${item.authorId}`)}
              onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.transform = ''; }}
            >
              <div style={{ height: '90px', background: 'linear-gradient(135deg,var(--b200),var(--b400))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem' }}>
                {item.type === 'reel' ? '▶' : '🔧'}
              </div>
              <div style={{ padding: '10px' }}>
                <div style={{ fontWeight: 700, fontSize: '.84rem', color: 'var(--text)' }}>
                  {item.title || item.artisan || 'Élément enregistré'}
                </div>
                {(item.trade || item.artisan) && (
                  <div style={{ fontSize: '.72rem', color: 'var(--text2)' }}>
                    {[item.trade, item.artisan && item.title ? item.artisan : null].filter(Boolean).join(' · ')}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
