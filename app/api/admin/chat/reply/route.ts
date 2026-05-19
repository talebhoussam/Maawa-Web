/**
 * POST /api/admin/chat/reply
 *
 * Admin-only. Writes a message to a support chat as the
 * '_maawa_support' system user. The real admin UID is captured in
 * `actualSender` for audit; users see only "Maawa Support".
 *
 * Body: { chatId: string, text: string (1..2000) }
 *
 * Audit: `admin.support.reply` so we can trace which admin answered.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import {
  handler, parseBody, requireAdmin, audit,
  notFound, badRequest,
} from '@/lib/api';
import { supportPlaceholderUid } from '@/lib/support-bot';

const Body = z.object({
  chatId: z.string().min(1).max(120),
  text:   z.string().min(1).max(2000),
}).strict();

export const POST = handler(async (req: NextRequest) => {
  const admin = await requireAdmin(req);
  const body  = await parseBody(req, Body);

  const chatRef = adminDb().collection('chats').doc(body.chatId);
  const snap    = await chatRef.get();
  if (!snap.exists) throw notFound(`Chat ${body.chatId} not found`);

  const data = snap.data() as Record<string, unknown>;
  if (data.isSupport !== true) {
    /* Defence-in-depth: refuse to admin-reply to a non-support chat,
       even though the route requires admin auth. We don't want this
       endpoint becoming a generic admin-shadow-message tool. */
    throw badRequest('Not a support chat');
  }

  const participants = (data.participants as string[] | undefined) ?? [];
  const userUid = participants.find(p => p !== supportPlaceholderUid());

  const now = Timestamp.now();
  const msgRef = chatRef.collection('messages').doc();
  await msgRef.set({
    senderId:     supportPlaceholderUid(),
    kind:         'support_text',
    text:         body.text,
    /* Audit trail — preserves which human admin actually answered. */
    actualSender: admin.uid,
    readBy:       [supportPlaceholderUid()],
    createdAt:    now,
  });

  await chatRef.set({
    lastMessage:   body.text.slice(0, 200),
    lastMessageAt: now,
    unread: {
      ...(userUid ? { [userUid]: FieldValue.increment(1) } : {}),
      [supportPlaceholderUid()]: 0,
    },
    updatedAt:     now,
  }, { merge: true });

  await audit({
    actor:  admin.uid,
    action: 'admin.support.reply',
    target: body.chatId,
    meta:   { length: body.text.length, userUid: userUid ?? null },
  });

  return NextResponse.json({ ok: true, messageId: msgRef.id });
});
