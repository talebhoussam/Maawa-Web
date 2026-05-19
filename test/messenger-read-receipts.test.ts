import { describe, it, expect, vi } from 'vitest';

/**
 * Light tests for read-receipts logic in lib/messenger-read.
 *
 * The brief says "Opening a thread marks unread messages as read" —
 * the React side wires this up on mount, but the *decision* of which
 * messages need updating is pure, so we test that without rendering.
 */

vi.mock('firebase/firestore', () => ({
  arrayUnion: (uid: string) => ({ __op: 'arrayUnion', uid }),
}));

import { unreadByMe, markUnreadAsRead, readByUpdate } from '@/lib/messenger-read';

describe('unreadByMe', () => {
  const myUid = 'me';

  it('returns messages from others that I have not read', () => {
    const messages = [
      { id: 'a', senderId: 'peer', readBy: [] },
      { id: 'b', senderId: 'peer', readBy: ['peer'] },
      { id: 'c', senderId: 'peer', readBy: ['peer', 'me'] }, /* already read */
      { id: 'd', senderId: 'me',   readBy: ['me'] },         /* mine */
    ];
    const result = unreadByMe(messages, myUid);
    expect(result.map(m => m.id)).toEqual(['a', 'b']);
  });

  it('handles missing readBy as empty array', () => {
    const messages = [{ id: 'x', senderId: 'peer' }];
    expect(unreadByMe(messages, myUid)).toHaveLength(1);
  });

  it('returns empty when there are no unread', () => {
    expect(unreadByMe([], myUid)).toEqual([]);
    expect(unreadByMe([{ id: 'a', senderId: 'me' }], myUid)).toEqual([]);
  });
});

describe('readByUpdate', () => {
  it('builds an arrayUnion payload with the caller uid', () => {
    const u = readByUpdate('me');
    expect(u).toEqual({ readBy: { __op: 'arrayUnion', uid: 'me' } });
  });
});

describe('markUnreadAsRead', () => {
  it('updates exactly the unread-by-me messages and returns the count', () => {
    const batch = { update: vi.fn() } as unknown as Parameters<typeof markUnreadAsRead>[0];
    const messageRef = (id: string) => ({ id } as unknown as Parameters<typeof markUnreadAsRead>[3] extends (id: string) => infer R ? R : never);
    const messages = [
      { id: 'a', senderId: 'peer', readBy: [] },
      { id: 'b', senderId: 'me',   readBy: ['me'] },          /* skip — mine */
      { id: 'c', senderId: 'peer', readBy: ['peer', 'me'] },   /* skip — read */
      { id: 'd', senderId: 'peer', readBy: ['peer'] },
    ];
    const count = markUnreadAsRead(batch as never, messages, 'me', messageRef as never);
    expect(count).toBe(2);
    /* batch.update called once per unread, with the arrayUnion shape */
    const calls = (batch as unknown as { update: { mock: { calls: unknown[][] } } }).update.mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[0]![0]).toEqual({ id: 'a' });
    expect(calls[0]![1]).toEqual({ readBy: { __op: 'arrayUnion', uid: 'me' } });
    expect(calls[1]![0]).toEqual({ id: 'd' });
  });

  it('returns 0 when nothing is unread', () => {
    const batch = { update: vi.fn() } as unknown as Parameters<typeof markUnreadAsRead>[0];
    const count = markUnreadAsRead(batch as never, [], 'me', (id) => ({ id } as never));
    expect(count).toBe(0);
  });
});
