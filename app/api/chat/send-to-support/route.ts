/**
 * POST /api/chat/send-to-support
 *
 * The user sends a free-text question to Maawa Support. We:
 *   1. Write their message to /chats/maawa-support_{uid}/messages.
 *   2. Update the parent chat's lastMessage/lastMessageAt and bump
 *      the admin-side unread counter.
 *   3. Briefly delay (~2.5s) to feel less robotic, then write a
 *      structured reply from '_maawa_support'. The reply is either:
 *        - 3 artisans from the user's wilaya (verified + available),
 *          ranked by rating desc, randomly sampled from the top 10;
 *        - fewer with a "broaden your zone" hint;
 *        - a zero-result fallback that flags the thread for manual
 *          human follow-up (audit-logged).
 *
 * Body: { text: string (1..2000) }
 *
 * Audit: `support.user_message_sent` and, on a zero-result reply,
 * `support.zero_artisans_flag` so an admin queue can pick it up.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { handler, parseBody, requireAuth, audit } from '@/lib/api';
import {
  sampleArtisansForSupport,
  supportPlaceholderUid,
  writeSupportAutoReply,
  type BotReplyPayload,
} from '@/lib/support-bot';

const Body = z.object({
  text: z.string().min(1).max(2000),
}).strict();

const SUPPORT_DELAY_MS = 2500;

export const POST = handler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  const body = await parseBody(req, Body);

  const chatId  = `maawa-support_${user.uid}`;
  const chatRef = adminDb().collection('chats').doc(chatId);

  /* Ensure the support thread exists. Created by
     /api/me/register-profile but legacy accounts might miss it. */
  const chatSnap = await chatRef.get();
  const now = Timestamp.now();
  if (!chatSnap.exists) {
    await chatRef.set({
      participants:  [user.uid, supportPlaceholderUid()],
      isSupport:     true,
      lastMessage:   null,
      lastMessageAt: now,
      unread:        { [user.uid]: 0, [supportPlaceholderUid()]: 0 },
      createdAt:     now,
      updatedAt:     now,
    });
  }

  /* 1. User message. */
  const userMsgRef = chatRef.collection('messages').doc();
  await userMsgRef.set({
    senderId:  user.uid,
    kind:      'text',
    text:      body.text,
    readBy:    [user.uid],
    createdAt: now,
  });

  /* 2. Bump unread for admin; reset for the user (they're typing —
     anything for them is implicitly seen). */
  await chatRef.set({
    lastMessage:   body.text.slice(0, 200),
    lastMessageAt: now,
    unread:        {
      [user.uid]:                0,
      [supportPlaceholderUid()]: FieldValue.increment(1),
    },
    updatedAt:     now,
  }, { merge: true });

  await audit({
    actor:  user.uid,
    action: 'support.user_message_sent',
    target: chatId,
    meta:   { length: body.text.length },
  });

  /* 3. Look up user wilaya for the artisan query. */
  const userSnap = await adminDb().collection('users').doc(user.uid).get();
  const wilaya = userSnap.exists
    ? String((userSnap.data() as Record<string, unknown>).wilaya ?? '')
    : '';

  let payload: BotReplyPayload;
  if (!wilaya) {
    payload = { kind: 'no_wilaya', wilaya: '', suggestions: [] };
  } else {
    const suggestions = await sampleArtisansForSupport(adminDb(), wilaya);
    payload = {
      kind: suggestions.length === 0 ? 'zero' : suggestions.length < 3 ? 'partial' : 'full',
      wilaya,
      suggestions,
    };
  }

  /* 4. Schedule auto-reply. In tests we write synchronously so the
     test can assert state immediately; in prod we delay so the bot
     feels less robotic. */
  if (process.env.NODE_ENV === 'test') {
    await writeSupportAutoReply(chatRef, payload);
    if (payload.kind === 'zero') {
      await audit({
        actor:  'system',
        action: 'support.zero_artisans_flag',
        target: chatId,
        meta:   { wilaya: payload.wilaya },
      });
    }
  } else {
    setTimeout(() => {
      writeSupportAutoReply(chatRef, payload)
        .then(() => {
          if (payload.kind === 'zero') {
            return audit({
              actor:  'system',
              action: 'support.zero_artisans_flag',
              target: chatId,
              meta:   { wilaya: payload.wilaya },
            });
          }
        })
        .catch(err => {
          console.error('[support-bot] auto-reply failed', err);
        });
    }, SUPPORT_DELAY_MS);
  }

  return NextResponse.json({ ok: true, messageId: userMsgRef.id });
});
