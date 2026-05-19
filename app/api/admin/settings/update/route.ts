/**
 * POST /api/admin/settings/update
 *
 * Update the platform_settings/global doc — a single config row that
 * the rest of the app reads at runtime for operator-tunable values
 * (commission %, MC rate, support phone, CCP/Baridimob numbers, etc).
 *
 * These complement (not replace) env vars. Env vars stay authoritative
 * at boot; the platform_settings doc lets the operator change non-
 * critical values without a redeploy. Anything that lives here MUST
 * have a sane env-var fallback so the platform never crashes when
 * the doc is missing.
 *
 * Body: subset of the fields below; only the keys actually present
 *       in the request are updated (merge: true).
 *
 * Audit: `admin.settings.update` with meta=the changed keys.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { handler, parseBody, requireAdmin, audit } from '@/lib/api';

const Body = z.object({
  mcRateDZD:       z.number().int().positive().max(10_000).optional(),
  commissionPct:   z.number().min(0).max(50).optional(),
  supportPhone:    z.string().regex(/^\+\d{6,15}$/).optional(),
  ccpNumber:       z.string().max(60).optional(),
  baridimobNumber: z.string().max(60).optional(),
  officeAddress:   z.string().max(300).optional(),
  bannerMessage:   z.string().max(500).optional().nullable(),
  maintenanceMode: z.boolean().optional(),
}).strict();

export const POST = handler(async (req: NextRequest) => {
  const admin = await requireAdmin(req);
  const body  = await parseBody(req, Body);

  const changedKeys = Object.keys(body);
  if (changedKeys.length === 0) {
    return NextResponse.json({ ok: true, changed: [] });
  }

  await adminDb().collection('platform_settings').doc('global').set({
    ...body,
    updatedBy: admin.uid,
    updatedAt: Timestamp.now(),
  }, { merge: true });

  await audit({
    actor:  admin.uid,
    action: 'admin.settings.update',
    target: 'global',
    meta:   { changed: changedKeys },
  });

  return NextResponse.json({ ok: true, changed: changedKeys });
});
