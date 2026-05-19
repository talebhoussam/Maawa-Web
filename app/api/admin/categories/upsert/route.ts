/**
 * POST /api/admin/categories/upsert
 *
 * Create a new category or update an existing one. The collection is
 * read-public, write-server-only — the rule rejects all client writes
 * so this is the only path.
 *
 * Body: {
 *   id?:     string   (≤ 40, slug — auto-generated from labelFr if omitted)
 *   labelFr: string   (≤ 80)
 *   labelEn: string   (≤ 80, falls back to labelFr)
 *   labelAr: string   (≤ 80, falls back to labelFr)
 *   icon?:   string   (≤ 4 — emoji or single glyph)
 *   active?: boolean  (default true on create; on update, untouched
 *                      unless explicitly provided)
 * }
 *
 * Use `slug(labelFr)` as the id when omitted — keeps URLs and i18n
 * keys readable.
 *
 * Audit: `admin.category.upsert` with meta={id, created}.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { handler, parseBody, requireAdmin, audit } from '@/lib/api';

const Body = z.object({
  id:      z.string().min(2).max(40).regex(/^[a-z0-9_-]+$/i).optional(),
  labelFr: z.string().min(1).max(80),
  labelEn: z.string().max(80).optional(),
  labelAr: z.string().max(80).optional(),
  icon:    z.string().max(4).optional(),
  active:  z.boolean().optional(),
}).strict();

/** Lower-case alphanumerics + dashes; collapses runs. */
function slug(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')   /* strip combining accents */
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

export const POST = handler(async (req: NextRequest) => {
  const admin = await requireAdmin(req);
  const body  = await parseBody(req, Body);

  const id = body.id ?? slug(body.labelFr);
  if (id.length < 2) return NextResponse.json({ message: 'Slug too short' }, { status: 400 });

  const ref = adminDb().collection('categories').doc(id);
  const snap = await ref.get();
  const now = Timestamp.now();

  const payload: Record<string, unknown> = {
    labelFr: body.labelFr.trim(),
    labelEn: body.labelEn?.trim() || body.labelFr.trim(),
    labelAr: body.labelAr?.trim() || body.labelFr.trim(),
    icon:    body.icon ?? '🔧',
    updatedAt: now,
  };
  if (!snap.exists) {
    payload.active    = body.active ?? true;
    payload.createdAt = now;
  } else if (typeof body.active === 'boolean') {
    payload.active = body.active;
  }

  await ref.set(payload, { merge: true });

  await audit({
    actor:  admin.uid,
    action: 'admin.category.upsert',
    target: id,
    meta:   { created: !snap.exists, labelFr: body.labelFr },
  });

  return NextResponse.json({ ok: true, id });
});
