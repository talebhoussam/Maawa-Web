/**
 * POST /api/push/register-token
 *
 * Save an FCM token for the signed-in user. We use a sub-collection
 * (`users/{uid}/push_tokens/{token}`) so:
 *   - Multiple devices per user are supported.
 *   - We can delete a single bad token without re-fetching the others.
 *   - We can read all-tokens-for-user with one collection query at
 *     send time.
 *
 * Body: { token: string, userAgent?: string }
 *
 * The browser is expected to call this every time `getToken()` returns
 * a value — FCM tokens can rotate, and this is the only signal the
 * server has to keep the index fresh. We upsert by token-as-doc-id so
 * the call is idempotent.
 *
 * Audit: not logged — too noisy for a per-page-load call.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { handler, parseBody, requireAuth } from '@/lib/api';

const Body = z.object({
  token:     z.string().min(20).max(300),
  userAgent: z.string().max(300).optional(),
}).strict();

export const POST = handler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  const body = await parseBody(req, Body);

  await adminDb()
    .collection('users').doc(user.uid)
    .collection('push_tokens').doc(body.token)
    .set({
      token:        body.token,
      userAgent:    body.userAgent ?? null,
      lastSeenAt:   Timestamp.now(),
    }, { merge: true });

  return NextResponse.json({ ok: true });
});
