'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@/lib/toast';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection, onSnapshot, orderBy, query, where, limit,
  doc, updateDoc, increment, addDoc, serverTimestamp,
} from 'firebase/firestore';
import { resolveStorageUrl } from '@/lib/storage-url';
import { useRequireAuth } from '@/components/ConnectOrCallModal';
import { useMaawa } from '@/lib/store';
import CommentsSheet from '@/components/CommentsSheet';

/**
 * Reels — vertical, full-screen video feed.
 *
 * What was wrong before this rewrite: the page had no <video> element
 * at all — only an empty-state card. Feed reels were placeholder
 * <div>s with emoji backgrounds, never actual playback. (See Phase 4
 * diagnosis in PROGRESS.md.)
 *
 * Architecture now:
 *   - Read `feed_posts where type=='reel'` ordered by createdAt desc.
 *     Posts without a `videoUrl` (or equivalent) are filtered out so
 *     we never render an empty <video>.
 *   - Resolve each `videoUrl` via lib/storage-url.resolveStorageUrl
 *     (handles gs://, bare paths, and pre-resolved https URLs).
 *   - Vertical scroll-snap container with `scroll-snap-type: y mandatory`
 *     and one <video> per snap point.
 *   - Single IntersectionObserver instance drives play/pause: when a
 *     reel reaches ≥50% visibility it plays; on leaving the threshold
 *     it pauses AND resets currentTime to 0 (the spec).
 *   - Videos default to MUTED so autoplay works on every browser
 *     (iOS Safari, Chrome). Tap toggles mute + flashes a brief icon.
 *
 * Guest mode: the query runs without auth (Firestore rules currently
 * require sign-in to read /feed_posts, so for now guests see the empty
 * state. Once Phase 6 ships a public-reels read path this page will
 * silently start showing reels to guests too — the auth guard is here
 * only for the *action* taps, not the view.)
 */

interface Reel {
  id: string;
  authorId?: string;
  title?: string;
  description?: string;
  artisan?: string;
  trade?: string;
  likes?: number;
  videoUrl?: string;
  posterUrl?: string;
  /* Optionally hydrated from the row; honest empty when missing. */
}

interface HydratedReel extends Reel {
  resolvedVideoUrl: string | null;
  resolvedPosterUrl: string | null;
}

/* Time-bounded url cache so we don't call getDownloadURL twice for
   the same reel during a single page lifetime. */
const URL_CACHE = new Map<string, Promise<string | null>>();
function cachedResolve(p?: string): Promise<string | null> {
  if (!p) return Promise.resolve(null);
  let v = URL_CACHE.get(p);
  if (!v) { v = resolveStorageUrl(p); URL_CACHE.set(p, v); }
  return v;
}

export default function ReelsPage() {
  const router = useRouter();
  const { user } = useMaawa();
  const isArtisan = user?.role === 'artisan';
  const [uid, setUid] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [reels, setReels] = useState<HydratedReel[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIdx, setActiveIdx] = useState(0);
  const [mutedAll, setMutedAll] = useState(true);
  const [showMuteToast, setShowMuteToast] = useState<{ muted: boolean; ts: number } | null>(null);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [commentsFor, setCommentsFor] = useState<{ postId: string; authorId?: string } | null>(null);

  /* Refs for every <video>; key is reel id. Stable across re-renders. */
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);

  /* ── Auth state — drives guest-mode behaviour for action taps ── */
  useEffect(() => onAuthStateChanged(auth, u => {
    setUid(u?.uid ?? null);
    setAuthReady(true);
  }), []);

  /* ── Live query: reels from feed_posts ── */
  useEffect(() => {
    if (!authReady) return;
    /* When not signed in, we still attempt the query — Firestore rules
       will reject it and we'll fall through to the empty state below.
       This keeps the code path uniform; Phase 6 will relax the rule. */
    if (!db) { setLoading(false); return; }
    try {
      const q = query(
        collection(db, 'feed_posts'),
        where('type', '==', 'reel'),
        orderBy('createdAt', 'desc'),
        limit(50),
      );
      const unsub = onSnapshot(q, async snap => {
        const raw: Reel[] = snap.docs.map(d => {
          const x = d.data() as Record<string, unknown>;
          return {
            id: d.id,
            authorId:    (x.authorId    as string | undefined),
            title:       (x.title       as string | undefined),
            description: (x.description as string | undefined),
            artisan:     (x.artisan     as string | undefined),
            trade:       (x.trade       as string | undefined),
            likes:       Number(x.likes ?? 0),
            videoUrl:    (x.videoUrl    as string | undefined)
                          ?? (x.mediaUrl as string | undefined), /* tolerate either field */
            posterUrl:   (x.posterUrl   as string | undefined)
                          ?? (x.thumbUrl  as string | undefined),
          };
        }).filter(r => r.videoUrl); /* drop reels without media — we won't fake them */
        /* Resolve all storage URLs in parallel. */
        const hydrated: HydratedReel[] = await Promise.all(raw.map(async r => ({
          ...r,
          resolvedVideoUrl:  await cachedResolve(r.videoUrl),
          resolvedPosterUrl: await cachedResolve(r.posterUrl),
        })));
        /* Drop any reel where the storage path failed to resolve —
           we'd just render a broken <video> otherwise. */
        setReels(hydrated.filter(r => r.resolvedVideoUrl));
        setLoading(false);
      }, () => setLoading(false));
      return unsub;
    } catch { setLoading(false); return; }
  }, [authReady]);

  /* ── IntersectionObserver drives play/pause ── */
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined' || reels.length === 0) return;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const el = entry.target as HTMLVideoElement;
        const reelId = el.dataset.reelId;
        if (!reelId) continue;
        if (entry.intersectionRatio >= 0.5) {
          /* Mark this index active for the side actions / counter UI. */
          const idx = reels.findIndex(r => r.id === reelId);
          if (idx >= 0) setActiveIdx(idx);
          /* Try to play. Autoplay only succeeds when muted — we set
             muted in the markup, so this should always work. The catch
             handles the rare case (insecure context, etc.) where it
             fails; we fall back silently. */
          el.play().catch(() => { /* autoplay blocked — leave paused */ });
        } else {
          el.pause();
          el.currentTime = 0; /* per spec — reset on scroll-out */
        }
      }
    }, { threshold: [0, 0.5, 1] });

    /* Attach to every current <video>. videoRefs is mutated as elements
       mount / unmount so we re-query the DOM here. */
    for (const v of videoRefs.current.values()) observer.observe(v);

    return () => observer.disconnect();
  }, [reels]);

  /* Apply mute state to ALL videos when the user toggles. Doing it in
     an effect keeps the toggle declarative — no chasing imperative
     calls on every <video> ref individually. */
  useEffect(() => {
    for (const v of videoRefs.current.values()) v.muted = mutedAll;
  }, [mutedAll]);

  /* ── Tap on a video toggles mute + flashes a brief overlay ── */
  const onVideoTap = useCallback(() => {
    setMutedAll(m => !m);
    setShowMuteToast({ muted: !mutedAll, ts: Date.now() });
    /* Fade the toast out after 700ms. */
    setTimeout(() => setShowMuteToast(s => (s && Date.now() - s.ts >= 700 ? null : s)), 750);
  }, [mutedAll]);

  /* ── Action handlers ── */
  /* Phase 6: use the shared ConnectOrCallModal instead of the toast
     stub from Phase 4. requireAuth runs the action or opens the modal. */
  const requireAuth = useRequireAuth();

  const handleLike = (reelId: string) => requireAuth(async () => {
    if (likedIds.has(reelId)) return; /* one-shot — feed rule only allows +1 */
    setLikedIds(s => new Set(s).add(reelId));
    try {
      await updateDoc(doc(db, 'feed_posts', reelId), { likes: increment(1) });
    } catch (err) {
      console.warn('like failed:', err);
      setLikedIds(s => {
        const n = new Set(s); n.delete(reelId); return n;
      });
    }
  }, 'aimer');

  const handleShare = async (reel: HydratedReel) => {
    const url = typeof window !== 'undefined' ? `${window.location.origin}/reels#${reel.id}` : '';
    if (navigator.share) {
      try {
        await navigator.share({ title: reel.title || 'Reel Maawa', url });
        return;
      } catch { /* user cancelled — fall through to clipboard */ }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast('🔗 Lien copié');
    } catch {
      toast('🔗 ' + url);
    }
  };

  const handleSave = (reelId: string) => requireAuth(async () => {
    try {
      await addDoc(collection(db, 'saved'), {
        userId:    uid,
        postId:    reelId,
        createdAt: serverTimestamp(),
      });
      toast('🔖 Enregistré');
    } catch (err) {
      console.warn('save failed:', err);
      toast('❌ Erreur');
    }
  }, 'enregistrer');

  const handleComment = (reel: HydratedReel) => requireAuth(() => {
    setCommentsFor({ postId: reel.id, authorId: reel.authorId });
  }, 'commenter');

  const handleBoost = () => requireAuth(() => {
    /* The Boost modal isn't wired yet (see Phase 4 follow-up #3 in
       PROGRESS). For now we drop into the wallet so the user can see
       their balance. */
    toast('🚀 Boost — bientôt');
    router.push('/wallet');
  }, 'booster');

  /* ── Render ── */

  /* Skeleton while we wait for auth + first snapshot. */
  if (loading) {
    return (
      <div className="screen on" id="s-reels" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ color: 'var(--text3)' }}>…</div>
      </div>
    );
  }

  /* Honest empty state when no playable reels exist. */
  if (reels.length === 0) {
    return (
      <div className="screen on" id="s-reels">
        <div className="page-title-row au">
          <div className="pt-head" id="t-reels-pg">📹 Reels</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 24px', textAlign: 'center', backgroundColor: 'var(--surface)', borderRadius: 'var(--r)', border: '1px dashed var(--border)', marginTop: 24 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🎬</div>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
            <span data-i18n="reels_empty_title">Aucun Reel pour le moment</span>
          </h3>
          <p style={{ color: 'var(--text2)', fontSize: '.92rem', maxWidth: 400, lineHeight: 1.5, marginBottom: 24 }}>
            <span data-i18n="reels_empty_desc">Les Reels vous permettent de découvrir les réalisations de nos artisans en vidéo.</span>
          </p>
          {isArtisan && (
            <button className="btn-primary" onClick={() => router.push('/artisan/reels/new')}>
              ➕ Publier mon premier Reel
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
    <div
      ref={containerRef}
      className="reels-container"
      id="s-reels"
      style={{
        position: 'fixed',
        inset: 0,
        background: '#000',
        overflowY: 'scroll',
        scrollSnapType: 'y mandatory',
        zIndex: 50,
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {/* Floating "publish" FAB for verified artisans. Sits above
          the player so it's reachable from any scrolled position. */}
      {isArtisan && (
        <button
          type="button"
          onClick={() => router.push('/artisan/reels/new')}
          aria-label="Publier un Reel"
          style={{
            position: 'fixed',
            top: 14, right: 14,
            zIndex: 55,
            background: 'var(--b500)', color: '#fff',
            border: 'none', borderRadius: 50,
            padding: '8px 14px',
            fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: '.78rem',
            cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(0,0,0,.32)',
            display: 'flex', alignItems: 'center', gap: 5,
          }}
        >
          ➕ Publier
        </button>
      )}
      {reels.map((reel, idx) => {
        const isActive = idx === activeIdx;
        const liked = likedIds.has(reel.id);
        const isOwner = uid && reel.authorId === uid;
        return (
          <div
            key={reel.id}
            className="reel"
            style={{
              position: 'relative',
              height: '100vh',
              width: '100%',
              scrollSnapAlign: 'start',
              overflow: 'hidden',
            }}
          >
            <video
              ref={(el) => {
                if (el) videoRefs.current.set(reel.id, el);
                else    videoRefs.current.delete(reel.id);
              }}
              data-reel-id={reel.id}
              src={reel.resolvedVideoUrl ?? undefined}
              poster={reel.resolvedPosterUrl ?? undefined}
              playsInline    /* iOS Safari requires this for inline playback */
              muted={mutedAll} /* autoplay only works when muted */
              loop
              preload="metadata"
              onClick={onVideoTap}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                cursor: 'pointer',
                background: '#000',
              }}
            >
              {/* Captions track placeholder — empty <track> kept here so a
                  future caption upload flow can drop in a real .vtt URL. */}
            </video>

            {/* Top-left close button (returns to feed) */}
            <button
              type="button"
              aria-label="Fermer"
              onClick={() => router.push('/feed')}
              style={{
                position: 'absolute', top: 14, left: 14,
                background: 'rgba(0,0,0,.42)', border: 'none', color: '#fff',
                width: 38, height: 38, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', zIndex: 3, backdropFilter: 'blur(4px)',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>

            {/* Author + caption overlay (bottom-left) */}
            <div
              style={{
                position: 'absolute', left: 14, right: 80, bottom: 18,
                color: '#fff', textShadow: '0 1px 6px rgba(0,0,0,.6)',
                fontSize: '.9rem', lineHeight: 1.4, zIndex: 2,
                cursor: reel.authorId ? 'pointer' : 'default',
              }}
              onClick={() => reel.authorId && router.push(`/profile/${reel.authorId}`)}
            >
              <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: '.95rem', marginBottom: 4 }}>
                @{reel.artisan || reel.authorId || 'artisan'}
                {reel.trade && <span style={{ fontWeight: 400, opacity: 0.85, marginLeft: 6 }}>· {reel.trade}</span>}
              </div>
              {(reel.title || reel.description) && (
                <div style={{ fontSize: '.83rem', opacity: 0.95 }}>
                  {reel.title || reel.description}
                </div>
              )}
            </div>

            {/* Side actions (right edge) */}
            <div style={{
              position: 'absolute', right: 12, bottom: 24,
              display: 'flex', flexDirection: 'column', gap: 16,
              zIndex: 2,
            }}>
              <ReelAction
                icon={liked ? '❤️' : '🤍'}
                label={String((reel.likes ?? 0) + (liked ? 1 : 0))}
                onClick={() => handleLike(reel.id)}
              />
              <ReelAction icon="💬" label="Comment" onClick={() => handleComment(reel)} />
              <ReelAction icon="↗" label="Share" onClick={() => handleShare(reel)} />
              <ReelAction icon="🔖" label="Save" onClick={() => handleSave(reel.id)} />
              {isOwner && (
                <ReelAction icon="🚀" label="Boost" onClick={handleBoost} />
              )}
            </div>

            {/* Mute indicator overlay — brief flash on tap */}
            {isActive && showMuteToast && Date.now() - showMuteToast.ts < 700 && (
              <div style={{
                position: 'absolute', top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                background: 'rgba(0,0,0,.55)', borderRadius: '50%',
                width: 72, height: 72, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                fontSize: '2rem', color: '#fff',
                pointerEvents: 'none',
                animation: 'in .15s ease-out',
                zIndex: 2,
              }}>
                {showMuteToast.muted ? '🔇' : '🔊'}
              </div>
            )}
          </div>
        );
      })}
    </div>
    {commentsFor && (
      <CommentsSheet
        postId={commentsFor.postId}
        postAuthorId={commentsFor.authorId}
        onClose={() => setCommentsFor(null)}
      />
    )}
    </>
  );
}

/* Small button used in the side rail. Sized for thumb-reach on mobile. */
function ReelAction({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      style={{
        background: 'rgba(0,0,0,.32)',
        border: 'none',
        color: '#fff',
        width: 46, height: 46,
        borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '1.2rem',
        cursor: 'pointer',
        backdropFilter: 'blur(4px)',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {icon}
    </button>
  );
}
