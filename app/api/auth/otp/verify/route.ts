/**
 * POST /api/auth/otp/verify
 *
 * Body: { phone: string, code: string (6 digits) }
 *
 * Verifies the SMS code via Twilio Verify. On success, mints a Firebase
 * custom token tied to the phone number — the client signs in with that,
 * gets an ID token, and exchanges it for a session cookie via
 * /api/auth/session-login.
 *
 * Critical: we must NEVER let an OTP brute force succeed. Rate limit
 * verify attempts per phone (10 per 5min) and per IP. Twilio's own
 * service has rate limits too but we add a layer.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { handler, parseBody, phoneSchema, badRequest, rateLimited, unauthorized } from '@/lib/api';
import { otpVerifyLimiter, loginLimiter, ipFrom } from '@/lib/ratelimit';
import { serverEnv, twilioConfigured } from '@/lib/env';
import { logger } from '@/lib/logger';

const Body = z.object({
  phone: phoneSchema,
  code:  z.string().regex(/^\d{6}$/, 'Code must be exactly 6 digits'),
});

const DEV_FIXED_CODE = '123456'; /* Only honoured when Twilio is unconfigured AND not production */

export const POST = handler(async (req: NextRequest) => {
  const { phone, code } = await parseBody(req, Body);
  const ip = ipFrom(req);

  if (!otpVerifyLimiter.check(`otpv:${phone}`)) throw rateLimited('Too many verification attempts for this number');
  if (!loginLimiter.check(`ip:${ip}`))         throw rateLimited('Too many requests from this IP');

  let approved = false;

  if (!twilioConfigured) {
    if (serverEnv.NODE_ENV === 'production') {
      throw badRequest('SMS service not configured');
    }
    approved = code === DEV_FIXED_CODE;
    if (!approved) {
      logger.warn({ phone }, '[otp.verify] DEV: code mismatch (expected 123456)');
    }
  } else {
    const auth = Buffer
      .from(`${serverEnv.TWILIO_ACCOUNT_SID}:${serverEnv.TWILIO_AUTH_TOKEN}`)
      .toString('base64');

    const url = `https://verify.twilio.com/v2/Services/${serverEnv.TWILIO_VERIFY_SERVICE_SID}/VerificationCheck`;
    const body = new URLSearchParams({ To: phone, Code: code });

    const res = await fetch(url, {
      method:  'POST',
      headers: { authorization: `Basic ${auth}`, 'content-type': 'application/x-www-form-urlencoded' },
      body,
    });

    if (!res.ok) {
      throw badRequest('Verification check failed');
    }
    const data = (await res.json()) as { status?: string };
    approved = data.status === 'approved';
  }

  if (!approved) throw unauthorized('Invalid verification code');

  /* Find or create the user keyed by phone. */
  let uid: string;
  try {
    const existing = await adminAuth().getUserByPhoneNumber(phone);
    uid = existing.uid;
  } catch {
    const created = await adminAuth().createUser({ phoneNumber: phone });
    uid = created.uid;
    /* Mint an empty profile doc so client reads don't get nulls. */
    await adminDb().collection('users').doc(uid).set({
      phone,
      createdAt: new Date(),
      role: 'client',
    }, { merge: true });
  }

  const customToken = await adminAuth().createCustomToken(uid);
  return NextResponse.json({ ok: true, customToken });
});
