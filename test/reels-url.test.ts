import { describe, it, expect, vi } from 'vitest';

/**
 * Unit tests for `lib/storage-url.ts`.
 *
 * `parseStorageRef` is the pure half — no I/O — so we test it directly.
 * `resolveStorageUrl` is mostly a thin async wrapper around
 * getDownloadURL; we mock that and check the dispatch logic
 * (https → returned unchanged, otherwise → getDownloadURL called).
 */

const mockGetDownloadURL = vi.fn();
const mockRef            = vi.fn();

vi.mock('firebase/storage', () => ({
  ref: (...args: unknown[]) => mockRef(...args),
  getDownloadURL: (...args: unknown[]) => mockGetDownloadURL(...args),
}));

/* The lib/firebase module is heavy (Auth + Firestore + Storage SDK
   initialization). We stub it so the test boots without env vars. */
vi.mock('@/lib/firebase', () => ({
  storage: { stub: true },
}));

import { parseStorageRef, resolveStorageUrl } from '@/lib/storage-url';

describe('parseStorageRef', () => {
  it('returns null for nullish / empty / non-string input', () => {
    expect(parseStorageRef(null)).toBeNull();
    expect(parseStorageRef(undefined)).toBeNull();
    expect(parseStorageRef('')).toBeNull();
    expect(parseStorageRef('   ')).toBeNull();
  });

  it('detects https URLs and returns them unchanged', () => {
    const url = 'https://firebasestorage.googleapis.com/v0/b/x/o/y?alt=media&token=abc';
    expect(parseStorageRef(url)).toEqual({ kind: 'https', url });
  });

  it('detects http URLs (not just https)', () => {
    const url = 'http://example.com/clip.mp4';
    expect(parseStorageRef(url)).toEqual({ kind: 'https', url });
  });

  it('extracts the object path from gs:// URIs', () => {
    expect(parseStorageRef('gs://my-bucket/reels/uid/clip.mp4'))
      .toEqual({ kind: 'path', path: 'reels/uid/clip.mp4' });
  });

  it('treats bare paths as object paths', () => {
    expect(parseStorageRef('reels/uid/clip.mp4'))
      .toEqual({ kind: 'path', path: 'reels/uid/clip.mp4' });
  });

  it('rejects bare paths with a leading slash', () => {
    /* Leading slashes would hit the bucket root and surprise everyone. */
    expect(parseStorageRef('/reels/uid/clip.mp4')).toBeNull();
  });

  it('handles whitespace by trimming', () => {
    expect(parseStorageRef('   gs://b/path  '))
      .toEqual({ kind: 'path', path: 'path' });
  });
});

describe('resolveStorageUrl', () => {
  it('returns null for nullish input without calling the SDK', async () => {
    mockGetDownloadURL.mockClear();
    expect(await resolveStorageUrl(null)).toBeNull();
    expect(await resolveStorageUrl(undefined)).toBeNull();
    expect(await resolveStorageUrl('')).toBeNull();
    expect(mockGetDownloadURL).not.toHaveBeenCalled();
  });

  it('returns an https URL unchanged without calling the SDK', async () => {
    mockGetDownloadURL.mockClear();
    const url = 'https://firebasestorage.example.com/file.mp4';
    expect(await resolveStorageUrl(url)).toBe(url);
    expect(mockGetDownloadURL).not.toHaveBeenCalled();
  });

  it('calls getDownloadURL for bare paths', async () => {
    mockGetDownloadURL.mockResolvedValue('https://signed.url/clip.mp4');
    const result = await resolveStorageUrl('reels/uid/clip.mp4');
    expect(result).toBe('https://signed.url/clip.mp4');
    expect(mockRef).toHaveBeenCalled();
    expect(mockGetDownloadURL).toHaveBeenCalled();
  });

  it('calls getDownloadURL for gs:// URIs (using just the path)', async () => {
    mockRef.mockClear();
    mockGetDownloadURL.mockResolvedValue('https://signed.url/from-gs.mp4');
    const result = await resolveStorageUrl('gs://b/reels/uid/clip.mp4');
    expect(result).toBe('https://signed.url/from-gs.mp4');
    /* ref() should have been called with the path, not the full gs URI. */
    expect(mockRef).toHaveBeenCalledWith(expect.anything(), 'reels/uid/clip.mp4');
  });

  it('returns null (does not throw) when getDownloadURL fails', async () => {
    mockGetDownloadURL.mockRejectedValueOnce(new Error('not found'));
    const result = await resolveStorageUrl('reels/uid/missing.mp4');
    expect(result).toBeNull();
  });
});
