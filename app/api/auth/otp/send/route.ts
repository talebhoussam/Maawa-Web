/**
 * POST /api/auth/otp/send
 *
 * Body: { phone: string }   (Algerian E.164)
 *
 * Sends an SMS via Twilio Verify. Rate-limited per phone number (5/hour)
 * AND per IP (10/15min) to prevent SMS-pumping abuse.
 *
 * Returns { ok: true, channel: 'sms' } on success. Never reveals whether
 * the phone is already registered or not — privacy + enumeration defence.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { handler, parseBody, phoneSchema, badRequest, rateLimited } from '@/lib/api';
import { otpSendLimiter, loginLimiter, ipFrom } from '@/lib/ratelimit';
import { serverEnv, twilioConfigured } from '@/lib/env';
import { logger } from '@/lib/logger';

const Body = z.object({ phone: phoneSchema });

export const POST = handler(async (req: NextRequest) => {
  const { phone } = await parseBody(req, Body);
  const ip = ipFrom(req);

  if (!otpSendLimiter.check(`otp:${phone}`)) throw rateLimited('Too many OTP requests for this number');
  if (!loginLimiter.check(`ip:${ip}`))      throw rateLimited('Too many requests from this IP');

  if (!twilioConfigured) {
    /* Fail-fast in prod, but in dev with no Twilio creds we want
       developers to be able to test the flow with a fixed code. */
    if (serverEnv.NODE_ENV === 'production') {
      throw badRequest('SMS service not configured');
    }
    logger.warn({ phone }, '[otp.send] DEV MODE: Twilio not configured, accepting any 6-digit code');
    return NextResponse.json({ ok: true, channel: 'sms', dev: true });
  }

  /* Twilio Verify — using fetch to avoid pulling the twilio SDK
     just for one call. The Verify API is a simple form-post. */
  const auth = Buffer
    .from(`${serverEnv.TWILIO_ACCOUNT_SID}:${serverEnv.TWILIO_AUTH_TOKEN}`)
    .toString('base64');

  const url = `https://verify.twilio.com/v2/Services/${serverEnv.TWILIO_VERIFY_SERVICE_SID}/Verifications`;
  const body = new URLSearchParams({ To: phone, Channel: 'sms' });

  const res = await fetch(url, {
    method:  'POST',
    headers: {
      authorization: `Basic ${auth}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    logger.error({ status: res.status, body: text, phone }, '[otp.send] Twilio rejected');
    throw badRequest('Failed to send verification SMS');
  }

  return NextResponse.json({ ok: true, channel: 'sms' });
});
