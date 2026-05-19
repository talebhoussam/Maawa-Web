/**
 * In-memory sliding-window rate limiter.
 *
 * Suitable for a single-instance deployment. For multi-instance (e.g.
 * Vercel serverless that scales to N processes), this becomes per-process
 * and is therefore not strictly accurate; in practice that's still better
 * than nothing for OTP brute force etc., but for production launch you
 * should swap the in-memory store for Upstash Redis or Cloud Memorystore.
 *
 * Usage:
 *   const limiter = createRateLimiter({ window: 60_000, max: 5 });
 *   const allowed = limiter.check(`otp:${phone}`);
 *   if (!allowed) throw rateLimited();
 */

import 'server-only';

interface RateLimiterOptions {
  /** Window size in milliseconds. */
  window: number;
  /** Max requests per key per window. */
  max: number;
}

interface RateLimiter {
  check(key: string): boolean;
  reset(key: string): void;
}

/* Map<key, timestamps[]> — older than (now - window) get evicted on each check */
const stores = new Map<string, Map<string, number[]>>();

export function createRateLimiter({ window: windowMs, max }: RateLimiterOptions): RateLimiter {
  const store = new Map<string, number[]>();
  /* Track all stores so a periodic timer can sweep — see below. */
  stores.set(`${windowMs}:${max}`, store);

  return {
    check(key: string): boolean {
      const now = Date.now();
      const cutoff = now - windowMs;
      const arr = store.get(key) ?? [];
      const fresh = arr.filter((t) => t > cutoff);
      if (fresh.length >= max) {
        store.set(key, fresh);
        return false;
      }
      fresh.push(now);
      store.set(key, fresh);
      return true;
    },
    reset(key: string): void {
      store.delete(key);
    },
  };
}

/* Periodic GC every 5 minutes to keep memory bounded. */
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [optsKey, store] of stores) {
      const [windowMsStr] = optsKey.split(':');
      const cutoff = now - Number(windowMsStr);
      for (const [k, arr] of store) {
        const fresh = arr.filter((t) => t > cutoff);
        if (fresh.length === 0) store.delete(k);
        else store.set(k, fresh);
      }
    }
  }, 5 * 60_000);
}

/* ─── Pre-configured limiters for common cases ───────────────────────── */

/* Auth-related: tight, per-phone */
export const otpSendLimiter   = createRateLimiter({ window: 60 * 60_000, max: 5 });   /* 5 / hour per phone */
export const otpVerifyLimiter = createRateLimiter({ window:  5 * 60_000, max: 10 });  /* 10 / 5min per phone */
export const loginLimiter     = createRateLimiter({ window: 15 * 60_000, max: 10 });  /* 10 / 15min per IP */

/* General API: looser, per-IP */
export const apiLimiter       = createRateLimiter({ window: 60_000, max: 60 });        /* 60 / minute per IP */

/* Helper: get IP from a NextRequest */
export function ipFrom(req: { headers: Headers }): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]!.trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}
