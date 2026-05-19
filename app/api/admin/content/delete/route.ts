/**
 * POST /api/admin/content/delete
 *
 * Hard-deletes a piece of user-generated content (post, reel,
 * story, comment). Before the delete we capture a snapshot of the
 * doc into the audit log meta so an operator can manually restore
 * it from the audit row if needed.
 *
 * Body: { kind: 'post' | 'reel' | 'story' | 'comment', id: string, reason: string }
 *
 * Reels live in `feed_posts where type='reel'` in this codebase,
 * so 'post' and 'reel' both target /feed_posts/{id}.
 *
 * Storage cleanup is best-effort: we look at `mediaUrl` / `photos`
 * / `videoUrl` / `mediaPath` fields and ask Storage to delete them.
 * Failures don't block the Firestore delete — that's the contract.
 *
 * Audit: `admin.content.delete` with full doc snapshot.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { adminDb, adminStorage } from '@/lib/firebase-admin';
import {
  handler, parseBody, requireAdmin, audit,
  notFound, badRequest,
} from '@/lib/api';

const Body = z.object({
  kind:   z.enum(['post', 'reel', 'story', 'comment']),
  id:     z.string().min(1).max(80),
  /* Optional `parentId` is required for comments: comments live in
     subcollections (e.g. feed_posts/{postId}/comments/{id}). */
  parentId: z.string().min(1).max(80).optional(),
  reason: z.string().min(5).max(500),
}).strict();

const COLLECTIONS: Record<'post' | 'reel' | 'story', string> = {
  post:  'feed_posts',
  reel:  'feed_posts',
  story: 'stories',
};

/** Pull every plausible storage-path field out of a content doc. */
function extractStoragePaths(data: Record<string, unknown>): string[] {
  const paths: string[] = [];
  const tryPush = (v: unknown) => {
    if (typeof v === 'string' && v.length > 0 && !v.startsWith('http')) {
      /* Bare path or gs:// — Storage SDK accepts the bare path. */
      paths.push(v.replace(/^gs:\/\/[^/]+\//, ''));
    }
  };
  tryPush(data.mediaUrl);
  tryPush(data.mediaPath);
  tryPush(data.videoUrl);
  tryPush(data.posterUrl);
  tryPush(data.thumbUrl);
  if (Array.isArray(data.photos)) {
    for (const p of data.photos) tryPush(p);
  }
  return paths;
}

async function deleteStoragePaths(paths: string[]): Promise<{ deleted: string[]; failed: string[] }> {
  const deleted: string[] = [];
  const failed:  string[] = [];
  for (const p of paths) {
    try {
      await adminStorage().bucket().file(p).delete({ ignoreNotFound: true });
      deleted.push(p);
    } catch (err) {
      console.warn('[admin.content.delete] storage delete failed', p, err);
      failed.push(p);
    }
  }
  return { deleted, failed };
}

export const POST = handler(async (req: NextRequest) => {
  const admin = await requireAdmin(req);
  const body  = await parseBody(req, Body);

  let ref;
  if (body.kind === 'comment') {
    if (!body.parentId) throw badRequest('Comments need a parentId');
    ref = adminDb()
      .collection('feed_posts').doc(body.parentId)
      .collection('comments').doc(body.id);
  } else {
    ref = adminDb().collection(COLLECTIONS[body.kind]).doc(body.id);
  }

  const snap = await ref.get();
  if (!snap.exists) throw notFound(`${body.kind} ${body.id} not found`);

  const docData = snap.data() ?? {};
  const storagePaths = body.kind === 'comment' ? [] : extractStoragePaths(docData as Record<string, unknown>);

  /* Capture the snapshot BEFORE deletion so the audit row carries
     enough state for a manual restore. We strip Firestore Timestamp
     objects to ISO strings so the audit log is serialisable. */
  const snapshot = JSON.parse(JSON.stringify(docData));

  await ref.delete();

  const { deleted, failed } = await deleteStoragePaths(storagePaths);

  await audit({
    actor:  admin.uid,
    action: 'admin.content.delete',
    target: body.id,
    meta: {
      kind:           body.kind,
      parentId:       body.parentId ?? null,
      reason:         body.reason,
      snapshot,
      storageDeleted: deleted,
      storageFailed:  failed,
    },
  });

  return NextResponse.json({ ok: true, storageDeleted: deleted.length, storageFailed: failed.length });
});
