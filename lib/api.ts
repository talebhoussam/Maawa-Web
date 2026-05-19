/**
 * Shared API-route utilities.
 *
 * Every API route under /app/api/* should use these helpers to:
 *   • Verify the caller is authenticated (and optionally an admin)
 *   • Validate request bodies with Zod
 *   • Return consistent error shapes
 *   • Emit structured logs
 *
 * Keeps API routes terse and forces consistency.
 */

import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z, type ZodSchema } from 'zod';
import { adminAuth, adminDb } from './firebase-admin';
import { logger, withRequest } from './logger';
import { randomUUID } from 'node:crypto';

/* ─── Types ──────────────────────────────────────────────────────────── */

export interface AuthedUser {
  uid:    string;
  email:  string | null;
  /* Custom claim — set by /api/admin/users/promote when granting admin */
  admin:  boolean;
  /* Custom claim — admin role tier (only meaningful when admin=true) */
  role:   'super' | 'manager' | 'ops' | null;
}

export type ApiError =
  | { code: 'UNAUTHENTICATED';  status: 401 }
  | { code: 'FORBIDDEN';        status: 403 }
  | { code: 'BAD_REQUEST';      status: 400; details?: unknown }
  | { code: 'NOT_FOUND';        status: 404 }
  | { code: 'CONFLICT';         status: 409 }
  | { code: 'RATE_LIMITED';     status: 429 }
  | { code: 'INTERNAL';         status: 500 };

/* ─── Errors ─────────────────────────────────────────────────────────── */

export class ApiException extends Error {
  constructor(public readonly err: ApiError, message?: string) {
    super(message ?? err.code);
    this.name = 'ApiException';
  }
}

export const unauthorized = (msg?: string) =>
  new ApiException({ code: 'UNAUTHENTICATED', status: 401 }, msg);
export const forbidden    = (msg?: string) =>
  new ApiException({ code: 'FORBIDDEN', status: 403 }, msg);
export const badRequest   = (msg?: string, details?: unknown) =>
  new ApiException({ code: 'BAD_REQUEST', status: 400, details }, msg);
export const notFound     = (msg?: string) =>
  new ApiException({ code: 'NOT_FOUND', status: 404 }, msg);
export const conflict     = (msg?: string) =>
  new ApiException({ code: 'CONFLICT', status: 409 }, msg);
export const rateLimited  = (msg?: string) =>
  new ApiException({ code: 'RATE_LIMITED', status: 429 }, msg);

/* ─── Auth ───────────────────────────────────────────────────────────── */

/**
 * Verify a request is from a logged-in user.
 *
 * Looks for the __session cookie. If valid, decodes the Firebase session
 * cookie via the Admin SDK and returns the user's UID + custom claims.
 *
 * Throws ApiException(UNAUTHENTICATED) on any failure — never returns null.
 */
export async function requireAuth(req: NextRequest): Promise<AuthedUser> {
  const session = req.cookies.get('__session')?.value;
  if (!session) throw unauthorized('Missing session cookie');

  try {
    const decoded = await adminAuth().verifySessionCookie(session, /* checkRevoked */ true);
    return {
      uid:   decoded.uid,
      email: decoded.email ?? null,
      admin: decoded.admin === true,
      role:  (decoded.role as AuthedUser['role']) ?? null,
    };
  } catch (err) {
    throw unauthorized('Session invalid or expired');
  }
}

/**
 * Same as requireAuth but additionally requires the `admin` custom claim.
 * Pass `tiers` to require a specific admin role (e.g. only 'super' can
 * mint other admins).
 */
export async function requireAdmin(
  req: NextRequest,
  tiers: ReadonlyArray<NonNullable<AuthedUser['role']>> = ['super', 'manager', 'ops'],
): Promise<AuthedUser> {
  const user = await requireAuth(req);
  if (!user.admin) throw forbidden('Admin role required');
  if (user.role && !tiers.includes(user.role)) throw forbidden(`Role ${user.role} not allowed for this action`);
  return user;
}

/* ─── Body parsing ───────────────────────────────────────────────────── */

/**
 * Parse the request body and validate against a Zod schema.
 * Throws BAD_REQUEST with the Zod error details if validation fails.
 */
export async function parseBody<T>(req: NextRequest, schema: ZodSchema<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw badRequest('Body must be valid JSON');
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw badRequest('Invalid request body', parsed.error.flatten());
  }
  return parsed.data;
}

/* ─── Audit log ──────────────────────────────────────────────────────── */

interface AuditEntry {
  actor:   string;
  action:  string;
  target?: string;
  meta?:   Record<string, unknown>;
}

/**
 * Append a row to the `audit_logs` collection. Used for every privileged
 * action (admin doing a thing, payment confirmation, role change, etc.).
 *
 * NEVER include raw PII or secrets in `meta`.
 */
export async function audit(entry: AuditEntry): Promise<void> {
  try {
    await adminDb().collection('audit_logs').add({
      ...entry,
      createdAt: new Date(),
    });
  } catch (err) {
    /* Audit failure must NOT break the request, but we want loud signals
       so you find out before audits go missing for a week. */
    logger.error({ err, entry }, '[audit] failed to write audit log');
  }
}

/* ─── Wrapper ────────────────────────────────────────────────────────── */

/**
 * Wraps an API handler with consistent logging + error formatting.
 *
 * Usage:
 *   export const POST = handler(async (req, ctx) => {
 *     const user = await requireAuth(req);
 *     const body = await parseBody(req, MySchema);
 *     return NextResponse.json({ ok: true });
 *   });
 */
type Handler = (req: NextRequest, ctx: { requestId: string }) => Promise<NextResponse>;

export function handler(fn: Handler) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const requestId = req.headers.get('x-request-id') ?? randomUUID();
    const log = withRequest(requestId, {
      method: req.method,
      path:   new URL(req.url).pathname,
    });

    const start = Date.now();
    try {
      const res = await fn(req, { requestId });
      res.headers.set('x-request-id', requestId);
      log.info({ status: res.status, ms: Date.now() - start }, 'request');
      return res;
    } catch (err) {
      if (err instanceof ApiException) {
        log.warn({ code: err.err.code, ms: Date.now() - start, msg: err.message }, 'request_error');
        const body: Record<string, unknown> = { error: err.err.code, message: err.message };
        if ('details' in err.err && err.err.details) body.details = err.err.details;
        return NextResponse.json(body, {
          status:  err.err.status,
          headers: { 'x-request-id': requestId },
        });
      }
      /* Unexpected — log full stack, return generic. */
      log.error({ err, ms: Date.now() - start }, 'unhandled_error');
      return NextResponse.json(
        { error: 'INTERNAL', message: 'Internal server error' },
        { status: 500, headers: { 'x-request-id': requestId } },
      );
    }
  };
}

/* ─── Common Zod helpers ─────────────────────────────────────────────── */

export const phoneSchema = z.string().regex(
  /^\+213[567]\d{8}$/,
  'Phone must be Algerian E.164 format: +213[567]XXXXXXXX',
);

export const uidSchema = z.string().min(20).max(40).regex(/^[A-Za-z0-9]+$/);

export const dzdAmountSchema = z.number().int().positive().max(10_000_000); /* cap at 10M DZD */

export const paymentMethodSchema = z.enum(['cash', 'ccp', 'baridimob', 'bank', 'other']);

export const missionStatusSchema = z.enum([
  'none', 'pending_office', 'confirmed', 'in_progress', 'completed', 'released', 'refunded', 'cancelled',
]);
