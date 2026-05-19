/**
 * Server-side push send helper.
 *
 * Looks up every FCM token for a user, sends the same notification to
 * each, and prunes any token that comes back as "registration-token-not-
 * registered" so we don't keep trying.
 *
 * Importable from any API route. Returns a `{ sent, pruned }` summary
 * so caller routes can log it.
 *
 * Pre-condition: env must have a server-side FCM credential. Firebase
 * Admin SDK ships push via `messaging().send()`, no extra cred needed
 * — same service account as Firestore.
 */

import { getMessaging } from 'firebase-admin/messaging';
import { adminDb } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger';

export interface PushPayload {
  title: string;
  body:  string;
  url?:  string;
  /* Optional tag for deduping ("comment-postId" etc.). */
  tag?:  string;
  /* Free-form data; ends up in payload.data on the client. */
  data?: Record<string, string>;
}

export async function sendPushToUser(uid: string, p: PushPayload): Promise<{ sent: number; pruned: number }> {
  const tokensSnap = await adminDb()
    .collection('users').doc(uid)
    .collection('push_tokens')
    .get();

  if (tokensSnap.empty) return { sent: 0, pruned: 0 };

  let sent   = 0;
  let pruned = 0;

  /* Fire each send in parallel — the SDK has no batch send for
     mixed tokens at v12+ without using the deprecated multicast. */
  await Promise.all(tokensSnap.docs.map(async (doc) => {
    const token = doc.id;
    try {
      await getMessaging().send({
        token,
        notification: { title: p.title, body: p.body },
        data: {
          ...(p.data ?? {}),
          ...(p.url ? { url: p.url } : {}),
          ...(p.tag ? { tag: p.tag } : {}),
        },
        webpush: p.url ? { fcmOptions: { link: p.url } } : undefined,
      });
      sent++;
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      /* Documented codes for "token is dead" — prune and continue. */
      if (
        code === 'messaging/registration-token-not-registered'
        || code === 'messaging/invalid-argument'
        || code === 'messaging/invalid-registration-token'
      ) {
        try { await doc.ref.delete(); pruned++; } catch { /* ignore */ }
      } else {
        logger.warn({ uid, code, err: String(err) }, 'push send failed');
      }
    }
  }));

  return { sent, pruned };
}
