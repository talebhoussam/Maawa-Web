/**
 * Server-side structured logger.
 *
 * In production: JSON output, info-level by default. Forwarded to whatever
 * log pipeline reads stdout (Vercel logs / Cloud Logging / Datadog / etc.).
 * In development: pretty-printed via pino-pretty.
 *
 * NEVER pass user PII or secrets to log methods. The redactor below
 * automatically strips a known set of sensitive fields, but it's a
 * safety net — not a license to log carelessly.
 */

import 'server-only';
import pino, { type LoggerOptions } from 'pino';
import { isProd, isDev, debugLogging } from './env';

const REDACT_PATHS = [
  /* Generic auth */
  'password',
  'token',
  'authorization',
  '*.password',
  '*.token',
  '*.authorization',
  '*.headers.authorization',
  'req.headers.authorization',
  'req.headers.cookie',
  /* Firebase + JWT */
  'idToken',
  '*.idToken',
  'sessionCookie',
  '*.sessionCookie',
  /* Twilio */
  'authToken',
  '*.authToken',
  /* PII */
  'password_hash',
  '*.password_hash',
  /* Card data — defence in depth even though we don't handle cards */
  'cardNumber',
  '*.cardNumber',
  'cvv',
  '*.cvv',
];

const baseOpts: LoggerOptions = {
  level: debugLogging ? 'debug' : isProd ? 'info' : 'debug',
  redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
  base: {
    /* `service` lets you grep across multiple deployed services later */
    service: 'maawa-web',
    env:     process.env.NODE_ENV ?? 'development',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
};

const transport = isDev
  ? {
      target: 'pino-pretty',
      options: {
        colorize:    true,
        translateTime: 'HH:MM:ss.l',
        ignore:      'pid,hostname,service,env',
      },
    }
  : undefined;

export const logger = transport
  ? pino({ ...baseOpts, transport })
  : pino(baseOpts);

/* Helper for request-scoped child loggers. Every API route should call
   this with the requestId so logs are correlatable. */
export function withRequest(requestId: string, extra: Record<string, unknown> = {}) {
  return logger.child({ requestId, ...extra });
}
