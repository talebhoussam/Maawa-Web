'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { auth } from '@/lib/firebase';
import { resolveStorageUrl } from '@/lib/storage-url';
import type { StoryDoc } from '@/lib/stories';

/**
 * Full-screen story viewer.
 *
 * Behaviour:
 *   - Top progress bar(s): one per slide, the active one animates over
 *     SLIDE_MS (5000) milliseconds.
 *   - Tap right half of screen → next slide; left half → previous.
 *   - Touch-and-hold (pointerdown that lasts > 220ms) → pause progress.
 *   - Swipe down (touchmove deltaY > 80px) → close.
 *   - Reaching the end of the last slide closes the viewer.
 *   - Authenticated viewers POST to /api/stories/view on each new
 *     slide (idempotent server-side; safe to call repeatedly).
 *
 * Photo URLs are resolved via lib/storage-url which handles bare paths,
 * gs:// URIs, and pre-resolved https URLs.
 */

const SLIDE_MS = 5000;
const HOLD_MS  = 220;

interface Props {
  stories: StoryDoc[];
  startIdx: number;
  onClose: () => void;
}

const GRADIENTS = [
  'linear-gradient(135deg, #ff6b6b, #ffa15c)',
  'linear-gradient(135deg, #29B6F6, #5C6BC0)',
  'linear-gradient(135deg, #2ecc71, #1abc9c)',
  'linear-gradient(135deg, #9b59b6, #34495e)',
  'linear-gradient(135deg, #f1c40f, #e67e22)',
];

function relTime(seconds?: number): string {
  if (!seconds) return '';
  const diff = Date.now() - seconds * 1000;
  if (diff < 60_000)     return 'maintenant';
  if (diff < 3600_000)   return `il y a ${Math.floor(diff / 60_000)} min`;
  return `il y a ${Math.floor(diff / 3600_000)} h`;
}

export default function StoryViewer({ stories, startIdx, onClose }: Props) {
  const [idx, setIdx] = useState(startIdx);
  const [progress, setProgress] = useState(0); /* 0..1 */
  const [paused, setPaused] = useState(false);
  const [imgUrl, setImgUrl] = useState<string | null>(null);

  /* Refs for touch tracking */
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartY = useRef<number | null>(null);
  const lastTick = useRef<number>(Date.now());
  const animFrame = useRef<number | null>(null);

  const current = stories[idx];

  /* Resolve photo URL when the slide changes. */
  useEffect(() => {
    setImgUrl(null);
    if (current?.kind === 'photo' && current.mediaUrl) {
      let cancelled = false;
      resolveStorageUrl(current.mediaUrl).then(u => { if (!cancelled) setImgUrl(u); });
      return () => { cancelled = true; };
    }
  }, [current]);

  /* Mark as viewed (idempotent server-side). */
  useEffect(() => {
    if (!current || !auth.currentUser) return;
    fetch('/api/stories/view', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ storyId: current.id }),
    }).catch(() => { /* silent — counter is best-effort */ });
  }, [current]);

  /* Progress driver via requestAnimationFrame. We tick a 0..1 fraction
     over SLIDE_MS, then advance idx and reset. Pausing simply stops
     updating lastTick so the delta on resume is 0. */
  const advance = useCallback(() => {
    setProgress(0);
    if (idx + 1 < stories.length) {
      setIdx(i => i + 1);
    } else {
      onClose();
    }
  }, [idx, stories.length, onClose]);

  useEffect(() => {
    let active = true;
    lastTick.current = Date.now();
    const loop = () => {
      if (!active) return;
      const now = Date.now();
      const dt = now - lastTick.current;
      lastTick.current = now;
      if (!paused) {
        setProgress(p => {
          const next = p + dt / SLIDE_MS;
          if (next >= 1) {
            queueMicrotask(advance);
            return 1;
          }
          return next;
        });
      }
      animFrame.current = requestAnimationFrame(loop);
    };
    animFrame.current = requestAnimationFrame(loop);
    return () => {
      active = false;
      if (animFrame.current) cancelAnimationFrame(animFrame.current);
    };
  }, [paused, advance]);

  /* Reset progress on idx change so the new slide starts at 0. */
  useEffect(() => {
    setProgress(0);
    lastTick.current = Date.now();
  }, [idx]);

  /* ESC key closes. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape')      onClose();
      if (e.key === 'ArrowRight')  advance();
      if (e.key === 'ArrowLeft')   setIdx(i => Math.max(0, i - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [advance, onClose]);

  /* Tap / touch handlers */
  const onPointerDown = (e: React.PointerEvent) => {
    /* Track potential swipe-down */
    touchStartY.current = e.clientY;
    /* Long-press → pause after HOLD_MS */
    holdTimer.current = setTimeout(() => setPaused(true), HOLD_MS);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    if (paused) {
      setPaused(false);
      touchStartY.current = null;
      return;
    }
    /* Swipe-down detection */
    if (touchStartY.current !== null && e.clientY - touchStartY.current > 80) {
      touchStartY.current = null;
      onClose();
      return;
    }
    touchStartY.current = null;

    /* Left half = prev, right half = next */
    const target = e.currentTarget as HTMLDivElement;
    const rect = target.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < rect.width / 3) {
      setIdx(i => Math.max(0, i - 1));
    } else {
      advance();
    }
  };

  if (!current) return null;

  const bg = current.kind === 'photo'
    ? (imgUrl ? `url("${imgUrl}") center / cover no-repeat #000` : '#111')
    : GRADIENTS[current.gradient ?? 0];

  return (
    <div
      role="dialog"
      aria-label="Story"
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null; }
        setPaused(false);
        touchStartY.current = null;
      }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer',
        userSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {/* Progress bars */}
      <div style={{
        position: 'absolute', top: 10, left: 10, right: 10,
        display: 'flex', gap: 4, zIndex: 2, pointerEvents: 'none',
      }}>
        {stories.map((_, i) => (
          <div key={i} style={{
            flex: 1, height: 3, borderRadius: 2,
            background: 'rgba(255,255,255,.32)',
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: i < idx ? '100%' : i === idx ? `${progress * 100}%` : '0%',
              background: '#fff',
              transition: i === idx ? 'none' : 'width .15s linear',
            }} />
          </div>
        ))}
      </div>

      {/* Author header */}
      <div style={{
        position: 'absolute', top: 24, left: 14, right: 60,
        color: '#fff', textShadow: '0 1px 6px rgba(0,0,0,.5)',
        zIndex: 2, pointerEvents: 'none',
      }}>
        <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: '.9rem' }}>
          {current.authorName || current.userId}
        </div>
        <div style={{ fontSize: '.74rem', opacity: 0.85 }}>{relTime(current.createdAt?.seconds)}</div>
      </div>

      {/* Close button */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        aria-label="Fermer"
        style={{
          position: 'absolute', top: 22, right: 14,
          width: 34, height: 34, borderRadius: '50%',
          background: 'rgba(0,0,0,.32)', border: 'none', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', zIndex: 3, backdropFilter: 'blur(4px)',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      {/* Text body for text-stories */}
      {current.kind === 'text' && current.text && (
        <div style={{
          color: '#fff',
          fontFamily: "'Sora',sans-serif",
          fontWeight: 700, fontSize: '1.4rem',
          padding: 30, textAlign: 'center',
          lineHeight: 1.4,
          textShadow: '0 2px 12px rgba(0,0,0,.25)',
          maxWidth: 540,
          pointerEvents: 'none',
        }}>
          {current.text}
        </div>
      )}

      {/* Photo body — already rendered as background, but show a tiny
          loading hint if URL not yet resolved */}
      {current.kind === 'photo' && !imgUrl && (
        <div style={{ color: '#fff', opacity: 0.7, fontSize: '.85rem' }}>…</div>
      )}
    </div>
  );
}
