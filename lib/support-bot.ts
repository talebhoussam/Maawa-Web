/**
 * Maawa Support bot — helpers shared by the API route and tests.
 *
 * Lives outside the route file because Next.js requires route files
 * to export only HTTP-method handlers and config constants. Tests
 * import `sampleArtisansForSupport` directly to avoid mocking the
 * delay-and-write path.
 */

import 'server-only';
import type { Firestore } from 'firebase-admin/firestore';

/** The constant peer-id for the Maawa Support side of every support chat. */
export function supportPlaceholderUid(): string {
  return '_maawa_support';
}

export interface ArtisanSuggestion {
  userId:      string;
  displayName: string;
  rating:      number | null;
  trade:       string | null;
  avatarUrl:   string | null;
  wilaya:      string | null;
}

/**
 * Query artisans matching the requester's wilaya + verified + available,
 * order by rating desc, take top 10, sample 3 at random.
 *
 * - The "top 10 → random 3" pick prevents the bot from looking
 *   identical every time for the same wilaya, while still favouring
 *   high-rated artisans.
 * - Returns whatever it finds — 0, 1, 2, or 3 entries. The caller
 *   decides what message to render.
 *
 * Uses the Admin SDK Firestore reference so it bypasses rules (the
 * users collection is admin/owner read in firestore.rules).
 */
export async function sampleArtisansForSupport(
  adminDb: Firestore,
  wilaya: string,
): Promise<ArtisanSuggestion[]> {
  if (!wilaya) return [];

  const snap = await adminDb.collection('users')
    .where('role', '==', 'artisan')
    .where('verified', '==', true)
    .where('available', '==', true)
    .where('wilaya', '==', wilaya)
    .orderBy('rating', 'desc')
    .limit(10)
    .get();

  /* Shuffle the top-10 result and slice 3. Fisher-Yates. */
  const all = snap.docs.map(d => {
    const x = d.data() as Record<string, unknown>;
    return {
      userId:      d.id,
      displayName: typeof x.displayName === 'string' ? x.displayName : d.id,
      rating:      typeof x.rating === 'number' ? x.rating : null,
      trade:       typeof x.trade === 'string' ? x.trade : null,
      avatarUrl:   typeof x.avatarUrl === 'string' ? x.avatarUrl : null,
      wilaya:      typeof x.wilaya === 'string' ? x.wilaya : null,
    };
  });

  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }

  return all.slice(0, 3);
}

/**
 * Compose the bot reply text based on result shape.
 *
 * Pure / testable — no Firestore I/O.
 */
export function composeBotReplyText(kind: 'full' | 'partial' | 'zero' | 'no_wilaya', wilaya: string): string {
  if (kind === 'full')      return `Voici 3 artisans disponibles dans ${wilaya} :`;
  if (kind === 'partial')   return 'Voici les artisans disponibles. Pour plus de choix, élargissez votre zone.';
  if (kind === 'zero')      return `Aucun artisan disponible actuellement dans ${wilaya}. Un agent Maawa vous contactera sous 24h.`;
  return 'Pour vous proposer des artisans, ajoutez votre wilaya dans les paramètres de votre profil. Un agent peut aussi vous contacter — répondez ici si besoin.';
}

/**
 * Write the bot reply message AND bump the user-side unread counter
 * on the parent chat doc. Used by /api/chat/send-to-support and
 * directly by the tests (no setTimeout).
 *
 * `chatRef` is a server-side DocumentReference — tests pass a mock.
 */
import type { DocumentReference } from 'firebase-admin/firestore';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';

export interface BotReplyPayload {
  kind: 'full' | 'partial' | 'zero' | 'no_wilaya';
  wilaya: string;
  suggestions: ArtisanSuggestion[];
}

export async function writeSupportAutoReply(
  chatRef: DocumentReference,
  payload: BotReplyPayload,
): Promise<void> {
  const now  = Timestamp.now();
  const text = composeBotReplyText(payload.kind, payload.wilaya);

  await chatRef.collection('messages').add({
    senderId:    supportPlaceholderUid(),
    kind:        payload.suggestions.length > 0 ? 'artisan_suggestions' : 'support_text',
    text,
    suggestions: payload.suggestions,
    readBy:      [supportPlaceholderUid()],
    createdAt:   now,
  });

  /* Look up the user side of the chat to know which unread field to
     bump. We expect exactly 2 participants — [userUid, _maawa_support]. */
  const chatSnap = await chatRef.get();
  const participants = (chatSnap.data()?.participants as string[] | undefined) ?? [];
  const userUid = participants.find(p => p !== supportPlaceholderUid());

  await chatRef.set({
    lastMessage:   text.slice(0, 200),
    lastMessageAt: now,
    unread: {
      ...(userUid ? { [userUid]: FieldValue.increment(1) } : {}),
      [supportPlaceholderUid()]: 0,
    },
    updatedAt:     now,
  }, { merge: true });
}
