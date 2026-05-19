'use client';

/**
 * Stories — types + live feed hook.
 *
 * The query returns ALL active stories (expiresAt > now), ordered by
 * createdAt desc. We do the group-by-user-take-latest pass in JS;
 * Firestore can't express "distinct on userId" without an index hack
 * and stories are bounded (24h × active users), so the cost is fine.
 *
 * Public-by-design: works for guests (Firestore rules allow read:true
 * on /stories), so we don't gate this on uid.
 */

import { useEffect, useState } from 'react';
import {
  collection, onSnapshot, query, where, orderBy, limit,
  Timestamp, getDoc, doc,
} from 'firebase/firestore';
import { db } from './firebase';

export interface StoryDoc {
  id: string;
  userId: string;
  authorName?: string;     /* hydrated client-side from users/{uid} */
  authorAvatar?: string | null;
  kind: 'photo' | 'text';
  mediaUrl: string | null;
  text: string | null;
  gradient: number | null;
  createdAt?: { seconds: number } | null;
  expiresAt?: { seconds: number } | null;
  views?: number;
}

export interface StoryGroup {
  userId: string;
  authorName: string;
  authorAvatar: string | null;
  stories: StoryDoc[];          /* this user's active stories, oldest → newest */
  hasUnseen: boolean;           /* always true for now; per-viewer-seen ships later */
}

const NAME_CACHE = new Map<string, { name: string; avatar: string | null }>();

async function hydrateAuthor(userId: string) {
  if (NAME_CACHE.has(userId)) return NAME_CACHE.get(userId)!;
  try {
    if (!db) throw new Error('no db');
    const snap = await getDoc(doc(db, 'users', userId));
    if (snap.exists()) {
      const d = snap.data() as Record<string, unknown>;
      const v = {
        name:   typeof d.displayName === 'string' ? d.displayName : userId,
        avatar: typeof d.avatarUrl   === 'string' ? d.avatarUrl   : null,
      };
      NAME_CACHE.set(userId, v);
      return v;
    }
  } catch { /* fall through */ }
  const fallback = { name: userId, avatar: null };
  NAME_CACHE.set(userId, fallback);
  return fallback;
}

/**
 * Subscribe to active stories, grouped by user (latest per user first).
 *
 * Returns groups in reverse-chronological order of each group's newest
 * story — matches the Instagram-style "fresh users at the front" rail.
 */
export function useStories(): { groups: StoryGroup[]; loading: boolean } {
  const [groups, setGroups] = useState<StoryGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!db) { setLoading(false); return; }
    /* Firestore comparison on Timestamp works with the equivalent
       Timestamp value — we pin "now" once per snapshot. */
    const q = query(
      collection(db, 'stories'),
      where('expiresAt', '>', Timestamp.now()),
      orderBy('expiresAt', 'desc'),
      limit(200),
    );
    const unsub = onSnapshot(q, async (snap) => {
      const all: StoryDoc[] = snap.docs.map(d => {
        const x = d.data() as Record<string, unknown>;
        return {
          id: d.id,
          userId:   String(x.userId ?? ''),
          kind:     (x.kind as StoryDoc['kind']) ?? 'text',
          mediaUrl: (x.mediaUrl  as string | null) ?? null,
          text:     (x.text      as string | null) ?? null,
          gradient: typeof x.gradient === 'number' ? (x.gradient as number) : null,
          createdAt: (x.createdAt as { seconds: number } | null) ?? null,
          expiresAt: (x.expiresAt as { seconds: number } | null) ?? null,
          views:    Number(x.views ?? 0),
        };
      });

      /* Group by user. Sort each user's stories by createdAt ASC so
         the viewer plays them in chronological order. */
      const byUser = new Map<string, StoryDoc[]>();
      for (const s of all) {
        if (!s.userId) continue;
        const arr = byUser.get(s.userId) ?? [];
        arr.push(s);
        byUser.set(s.userId, arr);
      }

      /* Hydrate author names in parallel. */
      const authorEntries = await Promise.all(Array.from(byUser.keys()).map(async (uid) => {
        const author = await hydrateAuthor(uid);
        return [uid, author] as const;
      }));
      const authors = new Map(authorEntries);

      const result: StoryGroup[] = Array.from(byUser.entries()).map(([userId, stories]) => {
        stories.sort((a, b) => (a.createdAt?.seconds ?? 0) - (b.createdAt?.seconds ?? 0));
        const author = authors.get(userId)!;
        const hydrated = stories.map(s => ({ ...s, authorName: author.name, authorAvatar: author.avatar }));
        return {
          userId,
          authorName: author.name,
          authorAvatar: author.avatar,
          stories: hydrated,
          hasUnseen: true,
        };
      });
      /* Rank groups by newest story descending. */
      result.sort((a, b) => {
        const am = Math.max(...a.stories.map(s => s.createdAt?.seconds ?? 0));
        const bm = Math.max(...b.stories.map(s => s.createdAt?.seconds ?? 0));
        return bm - am;
      });

      setGroups(result);
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, []);

  return { groups, loading };
}
