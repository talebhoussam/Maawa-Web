/**
 * GET /api/admin/wallet/proof-url?path=coin_proofs/{uid}/{file}
 *
 * Admin-only. Issues a short-lived (5 min) signed URL for a proof
 * image so the admin coin-requests page can render thumbnails.
 *
 * Why not `getDownloadURL` directly from the admin browser?
 * Storage rules grant admin read, but the browser uses the user's
 * Firebase Auth token which the storage SDK forwards. Custom claims
 * propagate fine in theory, but ergonomically it's much simpler to
 * have the server mint a signed URL — that also means the proof
 * never appears in a URL the browser could share by accident.
 *
 * We refuse any path outside the `coin_proofs/` prefix to keep this
 * endpoint from being a generic file exfiltrator.
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminStorage } from '@/lib/firebase-admin';
import { handler, requireAdmin, badRequest, notFound } from '@/lib/api';

const SAFE_PREFIX = 'coin_proofs/';
const EXPIRES_MS  = 5 * 60 * 1000; /* 5 minutes */

export const GET = handler(async (req: NextRequest) => {
  await requireAdmin(req);
  const path = new URL(req.url).searchParams.get('path');
  if (!path) throw badRequest('Missing path');
  if (!path.startsWith(SAFE_PREFIX) || path.includes('..')) {
    throw badRequest(`Path must be under ${SAFE_PREFIX}`);
  }

  const file = adminStorage().bucket().file(path);
  const [exists] = await file.exists();
  if (!exists) throw notFound('Proof file not found');

  const [url] = await file.getSignedUrl({
    action:  'read',
    expires: Date.now() + EXPIRES_MS,
  });

  return NextResponse.json({ url });
});
