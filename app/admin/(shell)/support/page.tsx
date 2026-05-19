'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from '@/lib/toast';
import { db } from '@/lib/firebase';
import {
  collection, doc, getDoc, onSnapshot, query, where, orderBy, limit,
  collection as subColl,
  query as subQuery,
} from 'firebase/firestore';

/**
 * Admin: Maawa Support inbox.
 *
 * Lists every chat with `isSupport === true`, freshest first, with
 * the unread count on the admin side ('_maawa_support' map key).
 *
 * Clicking a row opens the full thread inline (right pane on desktop,
 * drilled-into view on mobile). Admin replies post via
 * /api/admin/chat/reply.
 *
 * The admin browser holds the admin custom claim so Firestore rules
 * accept the read directly — no Admin SDK round-trip needed for reads.
 */

const SUPPORT_UID = '_maawa_support';

interface SupportChatRow {
  id: string;
  userId: string;
  userName?: string;
  lastMessage: string | null;
  lastMessageAt: { seconds: number } | null;
  unread: number; /* on the admin side */
}

interface MsgRow {
  id: string;
  senderId: string;
  kind?: string;
  text?: string;
  suggestions?: { userId: string; displayName: string; rating: number | null; trade: string | null }[];
  createdAt?: { seconds: number } | null;
  actualSender?: string | null;
}

function fmt(seconds?: number): string {
  if (!seconds) return '';
  const d = new Date(seconds * 1000);
  const today = new Date();
  return d.toDateString() === today.toDateString()
    ? d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

const USER_CACHE = new Map<string, string>();
async function hydrateName(uid: string): Promise<string> {
  if (USER_CACHE.has(uid)) return USER_CACHE.get(uid)!;
  try {
    if (!db) throw new Error();
    const s = await getDoc(doc(db, 'users', uid));
    if (s.exists()) {
      const name = String((s.data() as Record<string, unknown>).displayName ?? uid);
      USER_CACHE.set(uid, name);
      return name;
    }
  } catch { /* fall through */ }
  USER_CACHE.set(uid, uid);
  return uid;
}

export default function AdminSupportPage() {
  const [rows, setRows] = useState<SupportChatRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MsgRow[]>([]);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);

  /* ── Subscribe to support chats ── */
  useEffect(() => {
    if (!db) { setLoading(false); return; }
    const q = query(
      collection(db, 'chats'),
      where('isSupport', '==', true),
      orderBy('lastMessageAt', 'desc'),
      limit(100),
    );
    const unsub = onSnapshot(q, async snap => {
      const raw: Omit<SupportChatRow, 'userName'>[] = snap.docs.map(d => {
        const x = d.data() as Record<string, unknown>;
        const participants = (x.participants as string[] | undefined) ?? [];
        const userId = participants.find(p => p !== SUPPORT_UID) ?? '';
        const unreadMap = x.unread as Record<string, number> | undefined;
        const unread = unreadMap ? Number(unreadMap[SUPPORT_UID] ?? 0) : 0;
        return {
          id: d.id,
          userId,
          lastMessage:   (x.lastMessage   as string | null) ?? null,
          lastMessageAt: (x.lastMessageAt as { seconds: number } | null) ?? null,
          unread,
        };
      });
      const hydrated = await Promise.all(raw.map(async (r) => ({
        ...r, userName: r.userId ? await hydrateName(r.userId) : '—',
      })));
      setRows(hydrated);
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, []);

  /* ── Subscribe to messages of the active thread ── */
  useEffect(() => {
    if (!activeChatId || !db) { setMessages([]); return; }
    const q = subQuery(
      subColl(db, 'chats', activeChatId, 'messages'),
      orderBy('createdAt', 'asc'),
    );
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...(d.data() as object) } as MsgRow)));
    });
    return unsub;
  }, [activeChatId]);

  const totalUnread = useMemo(() => rows.reduce((s, r) => s + r.unread, 0), [rows]);

  const sendReply = async () => {
    if (!activeChatId || !replyText.trim()) return;
    setSending(true);
    try {
      const res = await fetch('/api/admin/chat/reply', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chatId: activeChatId, text: replyText.trim() }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast('❌ ' + (j.message ?? 'Erreur'));
      } else {
        setReplyText('');
      }
    } catch {
      toast('❌ Erreur réseau');
    } finally {
      setSending(false);
    }
  };

  const activeRow = rows.find(r => r.id === activeChatId);

  return (
    <div className="page on" id="page-support">
      <div className="page-header au">
        <div>
          <div className="page-h1">🛟 Maawa Support</div>
          <div className="page-sub">
            {loading ? '…' : `${rows.length} conversations · ${totalUnread} non lus`}
          </div>
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(260px, 360px) 1fr',
        gap: 14,
        height: 'calc(100vh - 180px)',
      }} className="au1">
        {/* List */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: 8, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)' }}>…</div>
            ) : rows.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)' }}>
                Aucune conversation support.
              </div>
            ) : (
              rows.map(r => (
                <div
                  key={r.id}
                  className={`chat-item ${r.unread > 0 ? 'unread' : ''}`}
                  onClick={() => setActiveChatId(r.id)}
                  style={{ background: r.id === activeChatId ? 'var(--b50)' : undefined, marginBottom: 4 }}
                >
                  <div className="ci-av av1" style={{ background: 'linear-gradient(135deg, var(--b400), var(--b600))' }}>
                    {(r.userName?.[0] ?? '?').toUpperCase()}
                  </div>
                  <div className="ci-body">
                    <div className="ci-top">
                      <span className="ci-name">{r.userName}</span>
                      <span className="ci-time">{fmt(r.lastMessageAt?.seconds)}</span>
                    </div>
                    <div className="ci-preview">{r.lastMessage ?? '—'}</div>
                  </div>
                  {r.unread > 0 && <div className="ci-badge">{r.unread}</div>}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Active thread */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {!activeRow ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text3)' }}>
              Sélectionnez une conversation pour répondre.
            </div>
          ) : (
            <>
              <div className="cw-header">
                <div className="cw-av av1">{(activeRow.userName?.[0] ?? '?').toUpperCase()}</div>
                <div>
                  <div className="cw-name">{activeRow.userName}</div>
                  <div style={{ fontSize: '.66rem', color: 'var(--text2)' }}>UID: {activeRow.userId}</div>
                </div>
              </div>
              <div className="cw-messages" style={{ flex: 1, height: 'auto', minHeight: 0 }}>
                {messages.map(m => {
                  const fromUser = m.senderId === activeRow.userId;
                  return (
                    <div key={m.id} style={{ display: 'flex', justifyContent: fromUser ? 'flex-start' : 'flex-end' }}>
                      <div className={`msg-bubble ${fromUser ? 'them' : 'me'}`} style={{ maxWidth: '75%' }}>
                        {m.kind === 'artisan_suggestions' && m.suggestions ? (
                          <div>
                            <div>{m.text}</div>
                            <div style={{ marginTop: 6, fontSize: '.72rem', opacity: 0.85 }}>
                              {m.suggestions.map(s => s.displayName).join(' · ')}
                            </div>
                          </div>
                        ) : (
                          <div>{m.text}</div>
                        )}
                        <div style={{ fontSize: '.62rem', opacity: 0.7, marginTop: 3, textAlign: 'right' }}>
                          {fmt(m.createdAt?.seconds)}
                          {m.actualSender && (
                            <span style={{ marginLeft: 6, fontStyle: 'italic' }}>· {m.actualSender.slice(0, 6)}…</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="cw-input-row">
                <input
                  type="text"
                  className="cw-input"
                  placeholder="Répondre en tant que Maawa Support…"
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendReply())}
                  disabled={sending}
                />
                <button className="btn-primary sm" onClick={sendReply} disabled={sending || !replyText.trim()}>
                  Envoyer
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
