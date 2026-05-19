import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * Integration tests for POST /api/chat/send-to-support.
 *
 * In NODE_ENV=test the route writes the bot reply synchronously (no
 * setTimeout) so we can assert state right after the response.
 *
 * Coverage:
 *   - User message is written + chat doc lastMessage updated
 *   - 3 artisans found → bot reply has 3 suggestions and the
 *     "Voici 3 artisans" text mentioning the user's wilaya
 *   - 0 artisans found → fallback message that says
 *     "Aucun artisan disponible … Un agent Maawa vous contactera"
 *     AND an audit row for support.zero_artisans_flag
 *   - Suggestion query was filtered by the user's wilaya
 */

const mockVerifySessionCookie = vi.fn();
const mockChatGet      = vi.fn();
const mockChatSet      = vi.fn();
const mockMsgAdd       = vi.fn();
const mockMsgSet       = vi.fn();
const mockUserGet      = vi.fn();
const mockAuditAdd     = vi.fn();
const mockArtisansGet  = vi.fn();
/* Records what `.where()` filters the route applied — so we can prove
   it queried for the user's wilaya. */
const whereCalls: Array<[string, string, unknown]> = [];

/* Build a chainable query mock that the support-bot's
   `.where().where().where().where().orderBy().limit().get()` returns. */
function makeQueryChain() {
  const chain = {
    where: (field: string, op: string, val: unknown) => { whereCalls.push([field, op, val]); return chain; },
    orderBy: () => chain,
    limit:   () => chain,
    get:     () => mockArtisansGet(),
  };
  return chain;
}

vi.mock('@/lib/firebase-admin', () => ({
  adminAuth: () => ({ verifySessionCookie: mockVerifySessionCookie }),
  adminDb: () => ({
    collection: (name: string) => {
      if (name === 'audit_logs') return { add: mockAuditAdd };
      if (name === 'users') {
        return {
          doc:   (_id: string) => ({ get: mockUserGet }),
          where: (field: string, op: string, val: unknown) => {
            whereCalls.push([field, op, val]);
            return makeQueryChain();
          },
        };
      }
      if (name === 'chats') {
        return {
          doc: (_id: string) => ({
            get: mockChatGet,
            set: mockChatSet,
            collection: (sub: string) => {
              if (sub === 'messages') {
                return {
                  doc: (_id?: string) => ({ id: `msg_${Math.random().toString(36).slice(2, 8)}`, set: mockMsgSet }),
                  add: mockMsgAdd,
                };
              }
              return { doc: () => ({}), add: vi.fn() };
            },
          }),
        };
      }
      return { doc: () => ({}), add: vi.fn() };
    },
  }),
  adminStorage: () => ({}),
}));

import { POST } from '@/app/api/chat/send-to-support/route';

function makeReq(body: unknown, opts?: { sessionCookie?: string | null }): NextRequest {
  const req = new NextRequest('http://test/api/chat/send-to-support', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (opts?.sessionCookie !== null) {
    req.cookies.set('__session', opts?.sessionCookie ?? 'valid-session-cookie-fake');
  }
  return req;
}

/* Helper: fake N artisan docs for the wilaya-matching query result. */
function fakeArtisans(wilaya: string, n: number) {
  return {
    docs: Array.from({ length: n }, (_, i) => ({
      id: `artisan-${i}`,
      data: () => ({
        displayName: `Artisan ${i}`,
        role: 'artisan',
        verified: true,
        available: true,
        wilaya,
        rating: 4.9 - i * 0.1,
        trade: 'Plombier',
        avatarUrl: null,
      }),
    })),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  whereCalls.length = 0;
  mockVerifySessionCookie.mockResolvedValue({
    uid: 'user-uid', email: 'u@maawa.test', admin: false, role: null,
  });
  /* Default chat-doc state: exists, user-side only */
  mockChatGet.mockResolvedValue({
    exists: true,
    data: () => ({
      participants: ['user-uid', '_maawa_support'],
      isSupport:    true,
      unread:       { 'user-uid': 0, _maawa_support: 0 },
    }),
  });
  /* Default user doc has wilaya */
  mockUserGet.mockResolvedValue({
    exists: true,
    data: () => ({ wilaya: '16 - Alger' }),
  });
});

describe('POST /api/chat/send-to-support', () => {
  it('rejects unauthenticated with 401', async () => {
    const res = await POST(makeReq({ text: 'hi' }, { sessionCookie: null }));
    expect(res.status).toBe(401);
  });

  it('writes the user message and bumps admin-side unread', async () => {
    mockArtisansGet.mockResolvedValue(fakeArtisans('16 - Alger', 3));
    const res = await POST(makeReq({ text: 'J\'ai besoin d\'un plombier' }));
    expect(res.status).toBe(200);
    /* mockMsgSet was called once for the user message; mockMsgAdd
       was called once for the bot reply. */
    expect(mockMsgSet).toHaveBeenCalledTimes(1);
    const userMsg = mockMsgSet.mock.calls[0]![0];
    expect(userMsg.senderId).toBe('user-uid');
    expect(userMsg.text).toBe('J\'ai besoin d\'un plombier');
    expect(userMsg.readBy).toEqual(['user-uid']);

    /* chat doc updated with lastMessage + unread map. The first set
       is the existence-check that already passed, so we check the
       update calls (filter by lastMessage present). */
    const lastMsgCalls = mockChatSet.mock.calls.filter(c => c[0]?.lastMessage !== undefined);
    expect(lastMsgCalls.length).toBeGreaterThanOrEqual(1);
    /* The FIRST update (post user message) had the user's text in
       lastMessage. The SECOND update (after bot reply) has the bot
       text. Both should bump exactly one side's unread. */
    expect(lastMsgCalls[0]![0].lastMessage).toBe('J\'ai besoin d\'un plombier');
  });

  it('spawns the 3-suggestions reply when ≥ 3 artisans match', async () => {
    mockArtisansGet.mockResolvedValue(fakeArtisans('16 - Alger', 5));
    const res = await POST(makeReq({ text: 'plombier svp' }));
    expect(res.status).toBe(200);
    expect(mockMsgAdd).toHaveBeenCalledTimes(1);
    const botMsg = mockMsgAdd.mock.calls[0]![0];
    expect(botMsg.senderId).toBe('_maawa_support');
    expect(botMsg.kind).toBe('artisan_suggestions');
    expect(botMsg.suggestions).toHaveLength(3);
    expect(botMsg.text).toMatch(/Voici 3 artisans/);
    expect(botMsg.text).toMatch(/16 - Alger/);
  });

  it('uses the user\'s wilaya when querying artisans', async () => {
    mockUserGet.mockResolvedValue({ exists: true, data: () => ({ wilaya: '31 - Oran' }) });
    mockArtisansGet.mockResolvedValue(fakeArtisans('31 - Oran', 4));
    await POST(makeReq({ text: 'aide?' }));
    /* The artisan query passed `wilaya == '31 - Oran'` */
    const wilayaFilter = whereCalls.find(c => c[0] === 'wilaya');
    expect(wilayaFilter).toBeTruthy();
    expect(wilayaFilter![2]).toBe('31 - Oran');
    /* Verified + available + role filters all applied */
    expect(whereCalls.some(c => c[0] === 'verified'  && c[2] === true)).toBe(true);
    expect(whereCalls.some(c => c[0] === 'available' && c[2] === true)).toBe(true);
    expect(whereCalls.some(c => c[0] === 'role'      && c[2] === 'artisan')).toBe(true);
  });

  it('spawns the partial reply when < 3 artisans match', async () => {
    mockArtisansGet.mockResolvedValue(fakeArtisans('16 - Alger', 2));
    await POST(makeReq({ text: 'urgent' }));
    const botMsg = mockMsgAdd.mock.calls[0]![0];
    expect(botMsg.suggestions).toHaveLength(2);
    expect(botMsg.text).toMatch(/élargissez votre zone/);
  });

  it('spawns the zero-artisan fallback AND emits a flag audit row', async () => {
    mockArtisansGet.mockResolvedValue({ docs: [] });
    await POST(makeReq({ text: 'urgent' }));
    const botMsg = mockMsgAdd.mock.calls[0]![0];
    expect(botMsg.suggestions).toEqual([]);
    expect(botMsg.kind).toBe('support_text');
    expect(botMsg.text).toMatch(/Aucun artisan disponible/);
    expect(botMsg.text).toMatch(/16 - Alger/);
    expect(botMsg.text).toMatch(/Un agent Maawa vous contactera sous 24h/);
    /* Audit-log row for the flag was written. */
    const auditActions = mockAuditAdd.mock.calls.map(c => c[0].action);
    expect(auditActions).toContain('support.zero_artisans_flag');
  });

  it('uses the no-wilaya fallback when the user has no wilaya', async () => {
    mockUserGet.mockResolvedValue({ exists: true, data: () => ({ /* no wilaya */ }) });
    await POST(makeReq({ text: 'salut' }));
    const botMsg = mockMsgAdd.mock.calls[0]![0];
    expect(botMsg.text).toMatch(/ajoutez votre wilaya/);
    /* The artisan query should NOT have been issued without a wilaya. */
    expect(mockArtisansGet).not.toHaveBeenCalled();
  });

  it('400s an empty body', async () => {
    const res = await POST(makeReq({ text: '' }));
    expect(res.status).toBe(400);
  });

  it('400s a text > 2000 chars', async () => {
    const res = await POST(makeReq({ text: 'x'.repeat(2001) }));
    expect(res.status).toBe(400);
  });
});
