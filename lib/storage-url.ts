/**
 * Resolve various Firebase Storage path shapes into a download URL
 * a <video> or <img> element can fetch.
 *
 * Inputs we accept:
 *   - Bare path: "reels/uid/clip.mp4"        → getDownloadURL()
 *   - gs:// URI: "gs://bucket/reels/..."     → getDownloadURL()
 *   - Already-https URL                       → returned unchanged
 *   - Empty / null / undefined               → null (caller decides)
 *
 * We keep this dependency-light and synchronous-where-possible so it's
 * easy to unit-test without firing up the Firebase SDK. The async path
 * (calling getDownloadURL) is lazy-loaded — pure-sync inputs (https
 * URLs) skip the SDK entirely.
 *
 * Returns null on any failure: callers should render a fallback (e.g.
 * a poster image or empty state) rather than crashing.
 */

import { storage } from './firebase';
import { ref as storageRef, getDownloadURL } from 'firebase/storage';

const HTTPS_RE = /^https?:\/\//i;
const GS_RE    = /^gs:\/\/[^/]+\/(.+)$/i;

/**
 * Best-effort resolution of a Storage reference to a fetchable URL.
 *
 * Pure path detection — no I/O — for use in tests and synchronous code
 * paths. Returns:
 *   - The original input if it's already an https URL
 *   - The extracted object path if input is gs:// (so caller can hand
 *     it to getDownloadURL themselves)
 *   - The input itself if it's a bare path
 *   - null otherwise
 */
export function parseStorageRef(input: string | null | undefined):
  | { kind: 'https'; url: string }
  | { kind: 'path';  path: string }
  | null
{
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (HTTPS_RE.test(trimmed)) return { kind: 'https', url: trimmed };

  const gs = GS_RE.exec(trimmed);
  if (gs) return { kind: 'path', path: gs[1] };

  /* Bare path heuristic: at least one slash, no scheme, no leading
     slash. Reject paths starting with `/` to avoid accidentally hitting
     the bucket root in surprising ways. */
  if (trimmed.startsWith('/')) return null;
  return { kind: 'path', path: trimmed };
}

/**
 * Async resolver — returns a fetchable URL or null.
 *
 * Throws never; logs to console on resolution failure. The `null`
 * return is the caller's signal to skip rendering this video / image.
 */
export async function resolveStorageUrl(input: string | null | undefined): Promise<string | null> {
  const parsed = parseStorageRef(input);
  if (!parsed) return null;
  if (parsed.kind === 'https') return parsed.url;
  try {
    const r = storageRef(storage, parsed.path);
    return await getDownloadURL(r);
  } catch (err) {
    console.warn('[resolveStorageUrl] failed for', input, err);
    return null;
  }
}
