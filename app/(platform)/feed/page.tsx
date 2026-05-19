'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@/lib/toast';
import { useFeed } from '@/lib/hooks';
import { useFollowingIds } from '@/lib/follow';
import { useRequireAuth } from '@/components/ConnectOrCallModal';
import { db, auth } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, doc, updateDoc, increment } from 'firebase/firestore';
import { SkeletonList } from '@/components/Skeleton';
import ErrorBoundary from '@/components/ErrorBoundary';
import StoriesRail from '@/components/platform/StoriesRail';
import VerifiedBadge from '@/components/VerifiedBadge';
import SponsoredBadge from '@/components/SponsoredBadge';
import ReportButton from '@/components/ReportButton';
import CommentsSheet from '@/components/CommentsSheet';

const CATEGORY_TAGS = ['Tous', '🔧 Plomberie', '⚡ Électricité', '🎨 Peinture', '🧱 Maçonnerie', '❄️ Clim'];

export default function FeedPage() {
  const router = useRouter();
  const { posts, loading } = useFeed();
  const followingIds = useFollowingIds();
  const requireAuth = useRequireAuth();
  const [tab, setTab] = useState<'foryou' | 'suivis'>('foryou');
  const [activeTag, setActiveTag] = useState('Tous');
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [commentsFor, setCommentsFor] = useState<{ postId: string; authorId?: string } | null>(null);

  /* Tab + category filter + activity-ranking sort. */
  const filteredPosts = useMemo(() => {
    let arr = activeTag === 'Tous'
      ? posts
      : posts.filter(p => p.category === activeTag || p.type === activeTag.toLowerCase().replace(/[^a-z]/g, ''));

    if (tab === 'suivis') {
      arr = arr.filter(p => p.authorId && followingIds.has(p.authorId));
    } else {
      /* "Pour vous" ranking: createdAt seconds, with followed authors
         boosted (×2 effective recency). Keeps the original snapshot
         ordering as a tiebreaker via the .sort stability. */
      arr = [...arr].sort((a, b) => {
        const aSec = (a.createdAt?.seconds ?? 0) * (followingIds.has(a.authorId) ? 2 : 1);
        const bSec = (b.createdAt?.seconds ?? 0) * (followingIds.has(b.authorId) ? 2 : 1);
        return bSec - aSec;
      });
    }
    return arr;
  }, [posts, activeTag, tab, followingIds]);

  const handleLike = (postId: string) => requireAuth(async () => {
    if (likedPosts.has(postId)) {
      toast('Déjà aimé !');
      return;
    }
    setLikedPosts(prev => new Set([...prev, postId]));
    try {
      await updateDoc(doc(db, 'feed_posts', postId), { likes: increment(1) });
    } catch { /* update locally only */ }
  }, 'aimer');

  const handleBookmark = (postId: string) => requireAuth(async () => {
    if (!auth.currentUser) return;
    try {
      await addDoc(collection(db, 'saved'), {
        userId: auth.currentUser.uid,
        postId,
        savedAt: serverTimestamp(),
      });
      toast('🔖 Enregistré !');
    } catch {
      toast('🔖 Enregistré localement');
    }
  }, 'enregistrer');

  return (
    <ErrorBoundary>
      <div className="screen on" id="s-feed">

        {/* Stories rail — live, public-by-design (works for guests too,
            shows the "+ Ma story" slot only when signed-in). */}
        <StoriesRail />

        {/* Tabs: Pour vous (everyone) / Suivis (signed-in only).
            The Suivis tab is still rendered for guests but tapping it
            triggers requireAuth — no point in showing them an empty
            list when the action requires login. */}
        <div style={{ display: 'flex', gap: 6, margin: '6px 0 10px', borderBottom: '1px solid var(--border)' }}>
          {([
            { id: 'foryou', label: 'Pour vous' },
            { id: 'suivis', label: 'Suivis' },
          ] as const).map(t => (
            <button
              key={t.id}
              onClick={() => {
                if (t.id === 'suivis') requireAuth(() => setTab('suivis'), 'voir vos abonnements');
                else setTab('foryou');
              }}
              style={{
                background: 'none', border: 'none',
                padding: '8px 14px',
                fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: '.86rem',
                color: tab === t.id ? 'var(--b500)' : 'var(--text2)',
                borderBottom: tab === t.id ? '2px solid var(--b500)' : '2px solid transparent',
                cursor: 'pointer',
                transition: 'color .15s',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Category Filter */}
        <div style={{ display: 'flex', gap: '7px', overflowX: 'auto', padding: '2px 0 12px 0', scrollbarWidth: 'none' }}>
          {CATEGORY_TAGS.map(tag => (
            <button
              key={tag}
              onClick={() => setActiveTag(tag)}
              style={{
                flexShrink: 0, padding: '5px 13px',
                background: activeTag === tag ? 'var(--b500)' : 'var(--surface2)',
                color: activeTag === tag ? '#fff' : 'var(--text2)',
                border: `1px solid ${activeTag === tag ? 'var(--b500)' : 'var(--border)'}`,
                borderRadius: '50px', fontSize: '.74rem', fontWeight: 600, cursor: 'pointer',
                transition: 'all .2s ease',
              }}
            >{tag}</button>
          ))}
        </div>

        {/* Feed */}
        {loading ? (
          <SkeletonList count={3} />
        ) : filteredPosts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text3)' }}>
            <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📭</div>
            <div>Aucun post dans cette catégorie</div>
          </div>
        ) : (
          filteredPosts.map((post, idx) => (
            <div key={post.id} className={`feed-card au${(idx % 3) + 1}`} style={{ marginBottom: '14px' }}>
              {/* Post Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '13px 13px 10px' }}>
                <div className={`av${(idx % 4) + 1}`} style={{ width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.68rem', fontWeight: 700, color: '#fff', flexShrink: 0, fontFamily: "'Sora',sans-serif" }}>
                  {(post.artisan || 'AA').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '.85rem', color: 'var(--text)', fontFamily: "'Sora',sans-serif", display: 'flex', alignItems: 'center' }} className="ulink" onClick={() => post.authorId && router.push(`/profile/${post.authorId}`)}>
                    {post.artisan || 'Artisan Maawa'}
                    {/* Verified badge — admin-set flag on the user doc.
                        Phase 2 we used a CSS pill; Phase 6 standardises
                        on a shared component used everywhere. */}
                    <VerifiedBadge verified={post.verified} />
                  </div>
                  <div style={{ fontSize: '.68rem', color: 'var(--text3)' }}>
                    {post.trade || '🔧 Artisan'} · {post.wilaya || 'Alger'}
                  </div>
                  <SponsoredBadge sponsored={post.sponsored} />
                </div>
              </div>

              {/* Post Content */}
              <div style={{ padding: '0 13px 10px', fontSize: '.83rem', color: 'var(--text2)', lineHeight: 1.6 }}>
                {post.description || post.title || 'Nouvelle réalisation Maawa'}
              </div>

              {/* Post Media Placeholder */}
              <div style={{
                background: `linear-gradient(135deg, hsl(${(idx * 50) % 360},60%,15%), hsl(${(idx * 50 + 60) % 360},60%,25%))`,
                height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '3rem', cursor: 'pointer', position: 'relative',
              }} onClick={() => toast('📸 Photo du chantier')}>
                {['🔧', '⚡', '🎨', '🧱', '🏠', '❄️'][idx % 6]}
                {post.type === 'reel' && (
                  <div style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(255,165,0,.9)', padding: '3px 8px', borderRadius: '6px', fontSize: '.65rem', fontWeight: 700, color: '#fff' }}>
                    ▶ REEL
                  </div>
                )}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 13px', borderTop: '1px solid var(--border)' }}>
                <button
                  style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', color: likedPosts.has(post.id) ? 'var(--rd)' : 'var(--text3)', fontSize: '.78rem', padding: '4px 8px', borderRadius: '8px', transition: 'all .15s' }}
                  onClick={() => handleLike(post.id)}
                >
                  {likedPosts.has(post.id) ? '❤️' : '🤍'} {(post.likes || 0) + (likedPosts.has(post.id) ? 1 : 0)}
                </button>
                <button
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: '.78rem', padding: '4px 8px', borderRadius: '8px' }}
                  onClick={() => setCommentsFor({ postId: post.id, authorId: post.authorId })}
                >
                  💬 {post.commentsCount ? `${post.commentsCount}` : 'Commenter'}
                </button>
                <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: '.78rem', padding: '4px 8px', borderRadius: '8px' }} onClick={() => toast('↗ Partagé !')}>
                  ↗ Partager
                </button>
                <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: '.78rem', padding: '4px 8px', borderRadius: '8px', marginLeft: 'auto' }} onClick={() => handleBookmark(post.id)}>
                  🔖
                </button>
                <ReportButton targetKind={post.type === 'reel' ? 'reel' : 'post'} targetId={post.id} label="" />
              </div>

              {/* CTA */}
              <div style={{ padding: '0 13px 13px', display: 'flex', gap: '7px' }}>
                <button className="btn-primary sm" onClick={() => router.push('/quote')}>Demander un devis</button>
                {post.authorId && (
                  <button className="btn-outline sm" onClick={() => router.push(`/profile/${post.authorId}`)}>Voir profil</button>
                )}
              </div>
            </div>
          ))
        )}

        {/* New Quote CTA */}
        <div className="card" style={{ marginTop: '4px', padding: '16px', background: 'linear-gradient(145deg,var(--b800),var(--b600))', border: '1px solid var(--b400)', textAlign: 'center' }}>
          <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: '.96rem', color: '#fff', marginBottom: '6px' }}>
            🤖 Estimation IA — Gratuite
          </div>
          <div style={{ fontSize: '.79rem', color: 'rgba(255,255,255,.7)', marginBottom: '12px' }}>
            Obtenez un devis en 30 secondes pour votre prochain projet
          </div>
          <button className="btn-primary" onClick={() => router.push('/quote')}>
            Estimer mon projet →
          </button>
        </div>
      </div>
      {commentsFor && (
        <CommentsSheet
          postId={commentsFor.postId}
          postAuthorId={commentsFor.authorId}
          onClose={() => setCommentsFor(null)}
        />
      )}
    </ErrorBoundary>
  );
}
