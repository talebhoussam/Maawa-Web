/**
 * POST /api/admin/reports/resolve
 *
 * Admin acts on a queued report. Three possible actions:
 *   - 'dismiss'        — false-positive, just close the report.
 *   - 'remove_content' — delete the reported content (post/reel/story
 *                        /comment). Calls the same logic as
 *                        /api/admin/content/delete.
 *   - 'ban_user'       — soft-delete the reported user. Calls the
 *                        same logic as /api/admin/users/delete.
 *
 * Body: { reportId: string, action: 'dismiss'|'remove_content'|'ban_user', note?: string }
 *
 * The corresponding side-effect runs THEN the report itself is
 * marked resolved/dismissed. We don't wrap this in a transaction
 * because the side-effects (content delete, user ban) involve
 * Firebase Auth calls that aren't transactional anyway — best we
 * can do is sequence them and audit at each step.
 *
 * Audit: `admin.report.resolved` with {action, reportId, note}.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Timestamp } from 'firebase-admin/firestore';
import { adminAuth, adminDb, adminStorage } from '@/lib/firebase-admin';
import {
  handler, parseBody, requireAdmin, audit,
  notFound, badRequest, conflict,
} from '@/lib/api';

const Body = z.object({
  reportId: z.string().min(1).max(80),
  action:   z.enum(['dismiss', 'remove_content', 'ban_user']),
  note:     z.string().max(500).optional(),
}).strict();

const CONTENT_COLLECTIONS: Record<'post' | 'reel' | 'story', string> = {
  post:  'feed_posts',
  reel:  'feed_posts',
  story: 'stories',
};

export const POST = handler(async (req: NextRequest) => {
  const admin = await requireAdmin(req);
  const body  = await parseBody(req, Body);

  const reportRef = adminDb().collection('reports').doc(body.reportId);
  const snap = await reportRef.get();
  if (!snap.exists) throw notFound(`Report ${body.reportId} not found`);

  const report = snap.data() as Record<string, unknown>;
  if (report.status === 'resolved' || report.status === 'dismissed') {
    throw conflict(`Report already ${report.status}`);
  }

  const targetKind = String(report.targetKind);
  const targetId   = String(report.targetId);
  const now = Timestamp.now();

  /* Execute the side-effect per action. */
  if (body.action === 'remove_content') {
    if (!(targetKind in CONTENT_COLLECTIONS) && targetKind !== 'comment') {
      throw badRequest(`Cannot remove_content for targetKind=${targetKind}`);
    }
    let contentRef;
    if (targetKind === 'comment') {
      /* The submit route now captures parentId at report time; use it
         to locate the comment under feed_posts/{parentId}/comments. */
      const parentId = typeof report.parentId === 'string' ? report.parentId : null;
      if (!parentId) {
        throw badRequest('Report does not carry a parentId — cannot locate comment');
      }
      contentRef = adminDb()
        .collection('feed_posts').doc(parentId)
        .collection('comments').doc(targetId);
    } else {
      contentRef = adminDb()
        .collection(CONTENT_COLLECTIONS[targetKind as 'post' | 'reel' | 'story'])
        .doc(targetId);
    }
    const contentSnap = await contentRef.get();
    if (contentSnap.exists) {
      const docData = contentSnap.data() ?? {};
      const snapshot = JSON.parse(JSON.stringify(docData));
      /* Storage cleanup mirrors /api/admin/content/delete.
         Comments don't have media fields so this loop is a no-op for
         them, which is fine. */
      const paths: string[] = [];
      const tryPush = (v: unknown) => {
        if (typeof v === 'string' && v.length > 0 && !v.startsWith('http')) {
          paths.push(v.replace(/^gs:\/\/[^/]+\//, ''));
        }
      };
      tryPush(docData.mediaUrl); tryPush(docData.mediaPath);
      tryPush(docData.videoUrl); tryPush(docData.posterUrl); tryPush(docData.thumbUrl);
      if (Array.isArray(docData.photos)) for (const p of docData.photos) tryPush(p);

      await contentRef.delete();
      for (const p of paths) {
        try { await adminStorage().bucket().file(p).delete({ ignoreNotFound: true }); }
        catch (err) { console.warn('[report.resolve] storage delete failed', p, err); }
      }

      await audit({
        actor:  admin.uid,
        action: 'admin.content.delete',
        target: targetId,
        meta:   {
          kind: targetKind,
          parentId: targetKind === 'comment' ? (report.parentId ?? null) : null,
          reason: `report:${body.reportId}`,
          snapshot, viaReport: body.reportId,
        },
      });
    }
  }

  if (body.action === 'ban_user') {
    if (targetKind !== 'user') {
      throw badRequest(`Cannot ban_user when targetKind=${targetKind}`);
    }
    const userRef = adminDb().collection('users').doc(targetId);
    const userSnap = await userRef.get();
    if (userSnap.exists) {
      await userRef.set({
        deleted:       true,
        deletedAt:     now,
        deletedBy:     admin.uid,
        deletedReason: body.note ?? `report:${body.reportId}`,
        displayName:   'Compte supprimé',
        firstName:     null, lastName: null,
        email:         null, phone:    null, avatarUrl: null, bio: null,
        banned:        true,
        available:     false,
        updatedAt:     now,
      }, { merge: true });
      try { await adminAuth().updateUser(targetId, { disabled: true }); }
      catch (err) { console.warn('[report.resolve] updateUser', err); }
      try { await adminAuth().revokeRefreshTokens(targetId); }
      catch (err) { console.warn('[report.resolve] revokeRefreshTokens', err); }
      await audit({
        actor:  admin.uid,
        action: 'admin.user.soft_delete',
        target: targetId,
        meta:   { reason: `report:${body.reportId}`, viaReport: body.reportId },
      });
    }
  }

  /* Mark the report resolved/dismissed. */
  await reportRef.set({
    status:     body.action === 'dismiss' ? 'dismissed' : 'resolved',
    reviewedBy: admin.uid,
    reviewedAt: now,
    resolution: body.note ?? body.action,
  }, { merge: true });

  await audit({
    actor:  admin.uid,
    action: 'admin.report.resolved',
    target: body.reportId,
    meta:   { action: body.action, targetKind, targetId, note: body.note ?? null },
  });

  return NextResponse.json({ ok: true });
});
