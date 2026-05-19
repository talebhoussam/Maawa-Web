'use client';

import { useEffect, useState } from 'react';
import {
  collection, query, where, onSnapshot, getCountFromServer, doc, getDoc, limit,
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';

/**
 * `useIsFollowing(targetUserId)` — returns the live "am I following X"
 * flag plus a setter that calls /api/follow or /api/unfollow.
 *
 * Reads the deterministic doc `follows/{me}_{target}` directly. The
 * snapshot fires when the doc appears or disappears — no need to
 * query the whole follows collection.
 */
export function useIsFollowing(targetUserId: string | undefined) {
  const [myUid, setMyUid] = useState<string | null>(null);
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => onAuthStateChanged(auth, u => setMyUid(u?.uid ?? null)), []);

  useEffect(() => {
    if (!myUid || !targetUserId || !db) { setLoading(false); return; }
    if (myUid === targetUserId) { setLoading(false); return; }
    const ref = doc(db, 'follows', `${myUid}_${targetUserId}`);
    const unsub = onSnapshot(ref, snap => {
      setFollowing(snap.exists());
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [myUid, targetUserId]);

  const follow = async () => {
    if (!targetUserId || !myUid || myUid === targetUserId) return;
    /* Optimistic — flip the local state, roll back if the call fails. */
    setFollowing(true);
    try {
      const res = await fetch('/api/follow', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ targetUserId }),
      });
      if (!res.ok) setFollowing(false);
    } catch { setFollowing(false); }
  };

  const unfollow = async () => {
    if (!targetUserId || !myUid) return;
    setFollowing(false);
    try {
      const res = await fetch('/api/unfollow', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ targetUserId }),
      });
      if (!res.ok) setFollowing(true);
    } catch { setFollowing(true); }
  };

  return { following, loading, myUid, follow, unfollow };
}

/**
 * `useFollowCounts(userId)` — followers + following counts for a user.
 * Uses `getCountFromServer` for cheap aggregation.
 *
 * Refetches on mount and whenever `userId` changes. Not a live
 * subscription — counts are cheap to refresh on demand and a live
 * one would mean re-running the aggregation on every follow edit.
 */
export function useFollowCounts(userId: string | undefined): {
  followers: number; following: number; loading: boolean;
} {
  const [followers, setFollowers] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId || !db) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const [fSnap, gSnap] = await Promise.all([
          getCountFromServer(query(collection(db, 'follows'), where('followingId', '==', userId))),
          getCountFromServer(query(collection(db, 'follows'), where('followerId',  '==', userId))),
        ]);
        if (!cancelled) {
          setFollowers(fSnap.data().count);
          setFollowingCount(gSnap.data().count);
        }
      } catch {
        /* count() can fail if no index yet — fall back to 0 */
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [userId]);

  return { followers, following: followingCount, loading };
}

/**
 * `useFollowingIds()` — the set of userIds the current user follows.
 * Used by the "Suivis" tab to filter feed posts and by the activity
 * ranking on "Pour vous".
 *
 * Live snapshot so a new follow lights up the suivis tab immediately.
 */
export function useFollowingIds(): Set<string> {
  const [myUid, setMyUid] = useState<string | null>(null);
  const [ids, setIds] = useState<Set<string>>(new Set());

  useEffect(() => onAuthStateChanged(auth, u => setMyUid(u?.uid ?? null)), []);

  useEffect(() => {
    if (!myUid || !db) return;
    const q = query(collection(db, 'follows'), where('followerId', '==', myUid), limit(500));
    const unsub = onSnapshot(q, snap => {
      const next = new Set<string>();
      for (const d of snap.docs) next.add(String((d.data() as Record<string, unknown>).followingId));
      setIds(next);
    }, () => { /* silent */ });
    return unsub;
  }, [myUid]);

  return ids;
}

/* Re-export getDoc so call-sites that want a one-shot existence
   check don't need to import Firestore directly. */
export { getDoc as _getDoc };
