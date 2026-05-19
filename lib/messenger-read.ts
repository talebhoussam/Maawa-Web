/**
 * Read-receipt helpers — extracted from the chat page so they can be
 * unit-tested without rendering React.
 */

import type { WriteBatch, DocumentReference } from 'firebase/firestore';
import { arrayUnion } from 'firebase/firestore';

export interface MessageLike {
  id: string;
  senderId: string;
  readBy?: string[];
}

/**
 * Return the subset of messages that the caller (`myUid`) should mark
 * as read: not authored by them and not already in readBy.
 */
export function unreadByMe<T extends MessageLike>(messages: T[], myUid: string): T[] {
  return messages.filter(m =>
    m.senderId !== myUid && !(m.readBy ?? []).includes(myUid)
  );
}

/**
 * Build the readBy update payload for one message. Exists so the
 * Firestore-SDK arrayUnion call is mockable from the test.
 */
export function readByUpdate(myUid: string): { readBy: ReturnType<typeof arrayUnion> } {
  return { readBy: arrayUnion(myUid) };
}

/**
 * Apply read-receipts for `myUid` on the given batch. The caller
 * supplies the `messages` list and a `messageRef(messageId)` factory
 * so this helper stays Firestore-instance-agnostic and easy to test.
 *
 * Returns the count of messages it scheduled an update for.
 */
export function markUnreadAsRead<T extends MessageLike>(
  batch: WriteBatch,
  messages: T[],
  myUid: string,
  messageRef: (messageId: string) => DocumentReference,
): number {
  const toMark = unreadByMe(messages, myUid);
  for (const m of toMark) {
    batch.update(messageRef(m.id), readByUpdate(myUid));
  }
  return toMark.length;
}
