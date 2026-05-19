/**
 * POST /api/admin/ads/upsert
 *
 * Create or update an ad. Ads are simple admin-curated promo cards
 * (title + body + image + CTA URL). No targeting, no budget, no
 * billing — those would need a separate phase.
 *
 * Body: {
 *   id?:       string (auto-generated when omitted)
 *   title:     string (≤ 80)
 *   body:      string (≤ 300)
 *   imageUrl?: string (≤ 1000, validated URL or storage path)
 *   ctaUrl?:   string (≤ 200)
 *   ctaLabel?: string (≤ 40)
 *   active?:   boolean (default true on create)
 * }
 *
 * Audit: `admin.ad.upsert`.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { handler, parseBody, requireAdmin, audit } from '@/lib/api';

const Body = z.object({
  id:       z.string().min(1).max(60).optional(),
  title:    z.string().min(1).max(80),
  body:     z.string().min(1).max(300),
  imageUrl: z.string().max(1000).optional(),
  ctaUrl:   z.string().max(200).optional(),
  ctaLabel: z.string().max(40).optional(),
  active:   z.boolean().optional(),
}).strict();

export const POST = handler(async (req: NextRequest) => {
  const admin = await requireAdmin(req);
  const body  = await parseBody(req, Body);

  const col = adminDb().collection('ads');
  const ref = body.id ? col.doc(body.id) : col.doc();
  const snap = await ref.get();
  const now = Timestamp.now();

  const payload: Record<string, unknown> = {
    title:    body.title.trim(),
    body:     body.body.trim(),
    imageUrl: body.imageUrl?.trim() || null,
    ctaUrl:   body.ctaUrl?.trim()   || null,
    ctaLabel: body.ctaLabel?.trim() || null,
    updatedAt: now,
    updatedBy: admin.uid,
  };
  if (!snap.exists) {
    payload.active    = body.active ?? true;
    payload.createdAt = now;
    payload.createdBy = admin.uid;
  } else if (typeof body.active === 'boolean') {
    payload.active = body.active;
  }

  await ref.set(payload, { merge: true });

  await audit({
    actor:  admin.uid,
    action: 'admin.ad.upsert',
    target: ref.id,
    meta:   { created: !snap.exists, title: body.title },
  });

  return NextResponse.json({ ok: true, id: ref.id });
});
