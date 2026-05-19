import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { NextRequest } from 'next/server';
import {
  ApiException,
  parseBody,
  phoneSchema,
  uidSchema,
  dzdAmountSchema,
  paymentMethodSchema,
  missionStatusSchema,
  unauthorized,
  forbidden,
  badRequest,
  notFound,
  conflict,
  rateLimited,
} from '@/lib/api';

/* Tiny helper to build a NextRequest from a JSON body */
function makeReq(body: unknown): NextRequest {
  return new NextRequest('http://test/api', {
    method:  'POST',
    headers: { 'content-type': 'application/json' },
    body:    JSON.stringify(body),
  });
}

describe('api error builders', () => {
  it('creates ApiException with the correct code + status', () => {
    const e1 = unauthorized();
    expect(e1).toBeInstanceOf(ApiException);
    expect(e1.err.code).toBe('UNAUTHENTICATED');
    expect(e1.err.status).toBe(401);

    expect(forbidden().err.status).toBe(403);
    expect(badRequest().err.status).toBe(400);
    expect(notFound().err.status).toBe(404);
    expect(conflict().err.status).toBe(409);
    expect(rateLimited().err.status).toBe(429);
  });

  it('badRequest carries optional details', () => {
    const e = badRequest('bad', { foo: 'bar' });
    expect(e.err.code).toBe('BAD_REQUEST');
    if (e.err.code === 'BAD_REQUEST') {
      expect(e.err.details).toEqual({ foo: 'bar' });
    }
  });
});

describe('parseBody', () => {
  it('returns parsed data on valid input', async () => {
    const Schema = z.object({ name: z.string(), n: z.number() });
    const req = makeReq({ name: 'a', n: 1 });
    const out = await parseBody(req, Schema);
    expect(out).toEqual({ name: 'a', n: 1 });
  });

  it('throws ApiException(BAD_REQUEST) on invalid JSON', async () => {
    const req = new NextRequest('http://test/api', {
      method:  'POST',
      headers: { 'content-type': 'application/json' },
      body:    'not json{',
    });
    await expect(parseBody(req, z.object({}))).rejects.toThrow(ApiException);
  });

  it('throws ApiException(BAD_REQUEST) on schema mismatch', async () => {
    const Schema = z.object({ n: z.number() });
    const req = makeReq({ n: 'oops' });
    try {
      await parseBody(req, Schema);
      expect.fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(ApiException);
      const ex = e as ApiException;
      expect(ex.err.code).toBe('BAD_REQUEST');
    }
  });

  it('rejects extra fields when schema is .strict()', async () => {
    const Schema = z.object({ a: z.string() }).strict();
    const req = makeReq({ a: 'x', b: 'sneaky' });
    await expect(parseBody(req, Schema)).rejects.toThrow(ApiException);
  });
});

describe('common Zod schemas', () => {
  describe('phoneSchema', () => {
    it.each([
      ['+213612345678', true],
      ['+213712345678', true],
      ['+213512345678', true],
    ])('accepts valid Algerian E.164: %s', (n, ok) => {
      expect(phoneSchema.safeParse(n).success).toBe(ok);
    });

    it.each([
      ['0612345678'],         /* missing + */
      ['+213412345678'],      /* invalid prefix 4 */
      ['+33612345678'],       /* not Algerian */
      ['+21361234'],          /* too short */
      ['+2136123456789'],     /* too long */
      [''],
    ])('rejects: %s', (n) => {
      expect(phoneSchema.safeParse(n).success).toBe(false);
    });
  });

  describe('uidSchema', () => {
    it('accepts a typical Firebase UID', () => {
      expect(uidSchema.safeParse('aB1cD2eF3gH4iJ5kL6mN7oP8qR9s').success).toBe(true);
    });
    it('rejects too-short / too-long / non-alphanumeric', () => {
      expect(uidSchema.safeParse('short').success).toBe(false);
      expect(uidSchema.safeParse('a'.repeat(50)).success).toBe(false);
      expect(uidSchema.safeParse('has-dash-aaaaaaaaaaaaaa').success).toBe(false);
    });
  });

  describe('dzdAmountSchema', () => {
    it('accepts positive integers up to 10M', () => {
      expect(dzdAmountSchema.safeParse(1).success).toBe(true);
      expect(dzdAmountSchema.safeParse(10_000_000).success).toBe(true);
    });
    it('rejects 0, negatives, decimals, > 10M', () => {
      expect(dzdAmountSchema.safeParse(0).success).toBe(false);
      expect(dzdAmountSchema.safeParse(-1).success).toBe(false);
      expect(dzdAmountSchema.safeParse(1.5).success).toBe(false);
      expect(dzdAmountSchema.safeParse(10_000_001).success).toBe(false);
    });
  });

  describe('paymentMethodSchema', () => {
    it('accepts the documented methods', () => {
      for (const m of ['cash', 'ccp', 'baridimob', 'bank', 'other']) {
        expect(paymentMethodSchema.safeParse(m).success).toBe(true);
      }
    });
    it('rejects unknown methods', () => {
      expect(paymentMethodSchema.safeParse('paypal').success).toBe(false);
      expect(paymentMethodSchema.safeParse('').success).toBe(false);
    });
  });

  describe('missionStatusSchema', () => {
    it('accepts every documented status', () => {
      for (const s of ['none', 'pending_office', 'confirmed', 'in_progress',
                        'completed', 'released', 'refunded', 'cancelled']) {
        expect(missionStatusSchema.safeParse(s).success).toBe(true);
      }
    });
  });
});
