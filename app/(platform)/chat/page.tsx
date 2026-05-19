'use client';

import { Suspense, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from '@/lib/toast';
import { useChat } from '@/lib/hooks';
import { useMaawa } from '@/lib/store';
import { auth, db, storage } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection, addDoc, doc, updateDoc, onSnapshot, query, orderBy,
  serverTimestamp, writeBatch, getDoc, setDoc,
  Timestamp as ClientTimestamp,
} from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { resolveStorageUrl } from '@/lib/storage-url';
import { markUnreadAsRead } from '@/lib/messenger-read';

/**
 * Messenger overhaul (Phase 5).
 *
 * Layout:
 *   - Desktop (≥ 900px viewport): two pane — list on the left,
 *     active thread on the right.
 *   - Mobile: master-detail. List view by default; tapping an entry
 *     hides the list and shows the thread. A back button returns.
 *
 * Real-time:
 *   - Conversation list: onSnapshot via useChat (already wired).
 *   - Messages: onSnapshot on /chats/{id}/messages ordered asc.
 *
 * Read receipts:
 *   - When the thread mounts (or a new message arrives) we batch-write
 *     `readBy: arrayUnion(uid)` on every message where the caller's
 *     uid is missing AND the sender isn't the caller. We also reset
 *     the parent chat doc's `unread[uid]` to 0.
 *
 * Typing indicator:
 *   - Writing into the input triggers a `typing: { [uid]: serverTimestamp }`
 *     on the chat doc, debounced (write once per 2 s of activity, clear
 *     after 5 s of silence). The peer observes the field; if its
 *     timestamp is < 5 s old we show three animated dots.
 *
 * Maawa Support thread is special-cased: the peer id `_maawa_support`
 * renders with the Maawa logo and a "Support" badge, and the input
 * goes through /api/chat/send-to-support (so the bot auto-replies).
 *
 * Reply-to-message: long-press a bubble to capture it as `replyTo`;
 * the next send embeds the original as a quote.
 */

const SUPPORT_UID    = '_maawa_support';
const TYPING_TIMEOUT = 5000;
const TYPING_THROTTLE = 1500;

interface ChatRow {
  id: string;
  participants?: string[];
  isSupport?: boolean;
  lastMessage?: string | null;
  lastMessageAt?: { seconds: number } | null;
  unread: number; /* normalized by useChat */
  typing?: Record<string, { seconds: number }>;
  peerName?: string;
  peerAvatar?: string | null;
}

interface MessageRow {
  id: string;
  senderId: string;
  kind?: 'text' | 'image' | 'artisan_suggestions' | 'support_text';
  text?: string;
  imageUrl?: string;
  suggestions?: {
    userId: string; displayName: string; rating: number | null;
    trade: string | null; avatarUrl: string | null;
  }[];
  replyTo?: { text: string; senderName: string };
  readBy?: string[];
  createdAt?: { seconds: number; nanoseconds?: number } | null;
}

function fmtTime(seconds?: number): string {
  if (!seconds) return '';
  const d = new Date(seconds * 1000);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay
    ? d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
}

function peerOf(chat: ChatRow, uid: string | null): string {
  if (!uid) return '';
  return (chat.participants ?? []).find(p => p !== uid) ?? '';
}

/* In-memory cache so we don't re-hit Firestore for every peer name on
   every re-render. Cleared on page unload. */
const PEER_CACHE = new Map<string, { name: string; avatar: string | null }>();
async function hydratePeer(peerUid: string): Promise<{ name: string; avatar: string | null }> {
  if (peerUid === SUPPORT_UID) return { name: 'Maawa Support', avatar: null };
  if (PEER_CACHE.has(peerUid)) return PEER_CACHE.get(peerUid)!;
  try {
    if (!db) throw new Error('no db');
    const snap = await getDoc(doc(db, 'users', peerUid));
    if (snap.exists()) {
      const data = snap.data() as Record<string, unknown>;
      const v = {
        name:   String(data.displayName ?? peerUid),
        avatar: typeof data.avatarUrl === 'string' ? data.avatarUrl : null,
      };
      PEER_CACHE.set(peerUid, v);
      return v;
    }
  } catch { /* fall through */ }
  const fallback = { name: peerUid, avatar: null };
  PEER_CACHE.set(peerUid, fallback);
  return fallback;
}

/**
 * Default export wraps the page in Suspense — required by Next 15
 * for any client component that calls `useSearchParams()`.
 */
export default function ChatPageRoot() {
  return (
    <Suspense fallback={<div className="screen on" id="s-chat" />}>
      <ChatPage />
    </Suspense>
  );
}

function ChatPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { chats: rawChats } = useChat();
  const { user } = useMaawa();

  const [uid, setUid] = useState<string | null>(null);
  useEffect(() => onAuthStateChanged(auth, u => setUid(u?.uid ?? null)), []);

  /* Hydrate peer names for each chat (one-shot per peer). */
  const [chatsWithPeers, setChatsWithPeers] = useState<ChatRow[]>([]);
  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    (async () => {
      const result: ChatRow[] = await Promise.all(
        (rawChats as ChatRow[]).map(async (c) => {
          const peerUid = peerOf(c, uid);
          const peer = peerUid ? await hydratePeer(peerUid) : { name: 'Conversation', avatar: null };
          return { ...c, peerName: peer.name, peerAvatar: peer.avatar };
        })
      );
      if (!cancelled) {
        /* Pin support thread to the top regardless of lastMessageAt. */
        result.sort((a, b) => {
          if (a.isSupport && !b.isSupport) return -1;
          if (b.isSupport && !a.isSupport) return 1;
          return (b.lastMessageAt?.seconds ?? 0) - (a.lastMessageAt?.seconds ?? 0);
        });
        setChatsWithPeers(result);
      }
    })();
    return () => { cancelled = true; };
  }, [rawChats, uid]);

  /* Conversation list filter (search bar). */
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return chatsWithPeers;
    return chatsWithPeers.filter(c =>
      (c.peerName ?? '').toLowerCase().includes(s)
      || (c.lastMessage ?? '').toLowerCase().includes(s)
    );
  }, [chatsWithPeers, search]);

  /* Active chat — sourced from `?c=` query param or local state.
     Using a query param makes it shareable + back-navigable. */
  const [activeChatId, _setActiveChatId] = useState<string | null>(null);
  useEffect(() => {
    const c = params.get('c');
    _setActiveChatId(c);
  }, [params]);
  const setActiveChatId = useCallback((id: string | null) => {
    _setActiveChatId(id);
    const url = id ? `/chat?c=${encodeURIComponent(id)}` : '/chat';
    /* Use replace to keep history clean — chat selection isn't a back-button-worthy step on its own */
    router.replace(url);
  }, [router]);

  const activeChat = chatsWithPeers.find(c => c.id === activeChatId) ?? null;

  /* ── Mobile vs desktop layout ── */
  const [isDesktop, setIsDesktop] = useState(true);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(min-width: 900px)');
    const apply = () => setIsDesktop(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  return (
    <div className="screen on" id="s-chat">
      <div className="page-title-row">
        <div className="pt-head">💬 Messages</div>
      </div>

      <div style={{
        display: isDesktop ? 'grid' : 'block',
        gridTemplateColumns: isDesktop ? 'minmax(280px, 360px) 1fr' : undefined,
        gap: isDesktop ? 14 : 0,
        height: 'calc(100vh - 160px)',
      }}>
        {/* ── Conversation list ── */}
        {(isDesktop || !activeChatId) && (
          <div className="card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher…"
                className="cw-input"
                style={{ width: '100%' }}
              />
            </div>
            <div className="chat-list" style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
              {filtered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text3)' }}>
                  <div style={{ fontSize: '2.4rem', marginBottom: 8 }}>💬</div>
                  <div style={{ fontSize: '.85rem', color: 'var(--text2)', fontWeight: 600 }}>
                    {search ? 'Aucune conversation correspondante' : 'Aucune conversation'}
                  </div>
                  {!search && (
                    <button className="btn-primary" style={{ marginTop: 12 }} onClick={() => router.push('/explore')}>
                      Explorer les artisans →
                    </button>
                  )}
                </div>
              ) : (
                filtered.map((c) => (
                  <ChatListItem
                    key={c.id}
                    chat={c}
                    active={c.id === activeChatId}
                    onClick={() => setActiveChatId(c.id)}
                  />
                ))
              )}
            </div>
          </div>
        )}

        {/* ── Active thread ── */}
        {(isDesktop || activeChatId) && (
          activeChat && uid ? (
            <ChatThread
              key={activeChat.id}
              chat={activeChat}
              myUid={uid}
              myName={user?.displayName ?? ''}
              onBack={() => setActiveChatId(null)}
              showBack={!isDesktop}
            />
          ) : (
            isDesktop && (
              <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: '.9rem' }}>
                Sélectionnez une conversation pour commencer.
              </div>
            )
          )
        )}
      </div>
    </div>
  );
}

/* ─── Conversation list item ─────────────────────────────────────── */

function ChatListItem({ chat, active, onClick }: {
  chat: ChatRow; active: boolean; onClick: () => void;
}) {
  const initials = (chat.peerName ?? 'AA').split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase();
  const isSupport = chat.isSupport === true;

  return (
    <div
      className={`chat-item ${chat.unread > 0 ? 'unread' : ''}`}
      onClick={onClick}
      style={{
        background: active ? 'var(--b50)' : undefined,
        borderColor: active ? 'var(--b300)' : undefined,
      }}
    >
      {/* Avatar */}
      <div
        className="ci-av av1"
        style={{
          position: 'relative',
          background: isSupport
            ? 'linear-gradient(135deg, #29B6F6, #5C6BC0)'
            : undefined,
        }}
      >
        {isSupport ? '🛟' : initials}
      </div>
      <div className="ci-body">
        <div className="ci-top">
          <span className="ci-name">
            {chat.peerName}
            {isSupport && (
              <span style={{
                marginLeft: 6, fontSize: '.55rem', fontWeight: 700,
                color: '#fff', background: 'var(--b500)', padding: '1px 6px',
                borderRadius: 50, verticalAlign: 'middle',
              }}>
                SUPPORT
              </span>
            )}
          </span>
          <span className="ci-time">{fmtTime(chat.lastMessageAt?.seconds)}</span>
        </div>
        <div className="ci-preview">
          <span>{chat.lastMessage ?? (isSupport ? 'Bonjour 👋 — Comment pouvons-nous vous aider ?' : 'Nouvelle conversation')}</span>
        </div>
      </div>
      {chat.unread > 0 && <div className="ci-badge">{chat.unread}</div>}
    </div>
  );
}

/* ─── Active thread ──────────────────────────────────────────────── */

function ChatThread({ chat, myUid, myName, onBack, showBack }: {
  chat: ChatRow;
  myUid: string;
  myName: string;
  onBack: () => void;
  showBack: boolean;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<{ text: string; senderName: string } | null>(null);
  const [longPressId, _setLongPressId] = useState<string | null>(null);
  const scrollEnd = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastTypingSent = useRef<number>(0);
  const peerUid = peerOf(chat, myUid);
  const isSupport = chat.isSupport === true;

  /* ── Messages subscription ── */
  useEffect(() => {
    if (!db) return;
    const q = query(collection(db, 'chats', chat.id, 'messages'), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...(d.data() as object) } as MessageRow)));
    });
    return unsub;
  }, [chat.id]);

  /* ── Read receipts: mark unread messages as read in a batch ── */
  useEffect(() => {
    if (!db || !myUid || messages.length === 0) return;
    const batch = writeBatch(db);
    const messageRef = (mid: string) => doc(db, 'chats', chat.id, 'messages', mid);
    const count = markUnreadAsRead(batch, messages, myUid, messageRef);
    if (count === 0) return;
    /* Also clear my unread counter on the parent doc. */
    batch.set(doc(db, 'chats', chat.id), {
      unread: { [myUid]: 0 },
    }, { merge: true });
    batch.commit().catch(err => console.warn('read-receipt batch failed', err));
  }, [messages, myUid, chat.id]);

  /* ── Scroll to bottom on new messages ── */
  useEffect(() => {
    scrollEnd.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length]);

  /* ── Typing indicator (peer's typing state) ── */
  const isPeerTyping = useMemo(() => {
    const t = chat.typing?.[peerUid];
    if (!t) return false;
    return (Date.now() - t.seconds * 1000) < TYPING_TIMEOUT;
  }, [chat.typing, peerUid]);

  /* Throttled write of our typing field. Cleared after TYPING_TIMEOUT
     of silence. */
  const typingClearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onTextChange = (v: string) => {
    setText(v);
    if (!db || !myUid || isSupport) return; /* don't send typing to bot */
    const now = Date.now();
    if (now - lastTypingSent.current > TYPING_THROTTLE) {
      lastTypingSent.current = now;
      setDoc(doc(db, 'chats', chat.id), {
        typing: { [myUid]: ClientTimestamp.now() },
      }, { merge: true }).catch(() => { /* silent */ });
    }
    if (typingClearTimer.current) clearTimeout(typingClearTimer.current);
    typingClearTimer.current = setTimeout(() => {
      setDoc(doc(db, 'chats', chat.id), {
        typing: { [myUid]: ClientTimestamp.fromMillis(0) },
      }, { merge: true }).catch(() => { /* silent */ });
    }, TYPING_TIMEOUT);
  };

  /* ── Send message ── */
  const send = async () => {
    if (!text.trim() || sending) return;
    const body = text.trim();
    setSending(true);
    setText('');
    /* Clear typing right away. */
    if (typingClearTimer.current) clearTimeout(typingClearTimer.current);
    setDoc(doc(db!, 'chats', chat.id), {
      typing: { [myUid]: ClientTimestamp.fromMillis(0) },
    }, { merge: true }).catch(() => { /* silent */ });

    try {
      if (isSupport) {
        /* Support thread goes through the API so the bot can auto-reply. */
        const res = await fetch('/api/chat/send-to-support', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ text: body }),
        });
        if (!res.ok) throw new Error('support send failed');
      } else {
        const msgRef = await addDoc(collection(db!, 'chats', chat.id, 'messages'), {
          senderId:  myUid,
          kind:      'text',
          text:      body,
          replyTo:   replyTo ?? null,
          readBy:    [myUid],
          createdAt: serverTimestamp(),
        });
        await updateDoc(doc(db!, 'chats', chat.id), {
          lastMessage:   body.slice(0, 200),
          lastMessageAt: serverTimestamp(),
          unread:        { [myUid]: 0, [peerUid]: incrementOrOne((chat.unread as unknown) ?? 0, peerUid) },
          updatedAt:     serverTimestamp(),
        });
        void msgRef;
      }
      setReplyTo(null);
    } catch (err) {
      console.error('send error', err);
      toast('Erreur lors de l\'envoi');
      setText(body); /* restore the unsent text */
    } finally {
      setSending(false);
    }
  };

  /* ── Attachment upload ── */
  const onAttachmentPick = async (file: File | null) => {
    if (!file || !myUid) return;
    if (!file.type.startsWith('image/')) { toast('Format image uniquement'); return; }
    if (file.size > 10 * 1024 * 1024)    { toast('Image trop volumineuse'); return; }
    try {
      const path = `chats/${chat.id}/${myUid}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 60)}`;
      const r = storageRef(storage, path);
      await uploadBytes(r, file, { contentType: file.type });
      const url = await getDownloadURL(r);
      await addDoc(collection(db!, 'chats', chat.id, 'messages'), {
        senderId:  myUid,
        kind:      'image',
        imageUrl:  url,
        readBy:    [myUid],
        createdAt: serverTimestamp(),
      });
      await updateDoc(doc(db!, 'chats', chat.id), {
        lastMessage:   '📷 Image',
        lastMessageAt: serverTimestamp(),
        updatedAt:     serverTimestamp(),
      });
    } catch (err) {
      console.error('attachment failed', err);
      toast('Échec de l\'envoi');
    }
  };

  /* ── Long-press → reply ── */
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setLongPressId = (id: string | null) => _setLongPressId(id);
  const onPointerDown = (msg: MessageRow) => {
    if (msg.kind === 'artisan_suggestions') return;
    longPressTimer.current = setTimeout(() => {
      const sender = msg.senderId === myUid ? myName : (chat.peerName ?? '');
      setReplyTo({ text: msg.text ?? '[image]', senderName: sender });
      setLongPressId(msg.id);
      setTimeout(() => setLongPressId(null), 250);
    }, 350);
  };
  const onPointerUp = () => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
  };

  /* ── Header ── */
  const initials = (chat.peerName ?? 'AA').split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div className="cw-header">
        {showBack && (
          <button className="ib" onClick={onBack} aria-label="Retour">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
        )}
        <div
          className="cw-av av1"
          style={{
            background: isSupport ? 'linear-gradient(135deg, #29B6F6, #5C6BC0)' : undefined,
            cursor: !isSupport && peerUid ? 'pointer' : 'default',
          }}
          onClick={() => !isSupport && peerUid && router.push(`/profile/${peerUid}`)}
        >
          {isSupport ? '🛟' : initials}
        </div>
        <div>
          <div className="cw-name">
            {chat.peerName}
            {isSupport && (
              <span style={{
                marginLeft: 6, fontSize: '.55rem', fontWeight: 700,
                color: '#fff', background: 'var(--b500)', padding: '1px 6px', borderRadius: 50,
              }}>SUPPORT</span>
            )}
          </div>
          <div style={{ fontSize: '.66rem', color: 'var(--text2)' }}>
            {isSupport ? 'Réponse automatique disponible' : peerUid ? 'Cliquez pour voir le profil' : ''}
          </div>
        </div>
      </div>

      <div className="cw-messages" style={{ flex: 1, height: 'auto', minHeight: 0 }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text3)', fontSize: '.85rem', marginTop: 20 }}>
            {isSupport
              ? 'Posez votre question — un agent ou notre algorithme vous répondra.'
              : 'Démarrez une conversation.'}
          </div>
        )}
        {messages.map((m, idx) => (
          <MessageBubble
            key={m.id}
            msg={m}
            previous={messages[idx - 1]}
            mine={m.senderId === myUid}
            peerName={chat.peerName ?? ''}
            highlighted={longPressId === m.id}
            onPointerDown={() => onPointerDown(m)}
            onPointerUp={onPointerUp}
            onSuggestionTap={(id) => router.push(`/profile/${id}`)}
          />
        ))}
        {isPeerTyping && <TypingDots />}
        <div ref={scrollEnd} />
      </div>

      {/* Reply quote (when set) */}
      {replyTo && (
        <div style={{
          padding: '6px 12px',
          borderTop: '1px solid var(--border)',
          background: 'var(--b50)',
          display: 'flex', alignItems: 'center', gap: 8,
          fontSize: '.74rem', color: 'var(--text2)',
        }}>
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <strong>{replyTo.senderName}</strong> · {replyTo.text}
          </span>
          <button onClick={() => setReplyTo(null)} aria-label="Annuler"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}>✕</button>
        </div>
      )}

      <div className="cw-input-row">
        {!isSupport && (
          <button className="ib" onClick={() => fileInputRef.current?.click()} aria-label="Pièce jointe">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={e => onAttachmentPick(e.target.files?.[0] ?? null)}
        />
        <input
          type="text"
          className="cw-input"
          placeholder={isSupport ? 'Posez votre question à Maawa…' : 'Message…'}
          value={text}
          onChange={e => onTextChange(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())}
          disabled={sending}
        />
        <button className="btn-primary sm" onClick={send} disabled={sending || !text.trim()} aria-label="Envoyer">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  );
}

/* ─── Single message bubble (with timestamps + ticks + replies) ──── */

function MessageBubble({ msg, previous, mine, peerName, highlighted, onPointerDown, onPointerUp, onSuggestionTap }: {
  msg: MessageRow;
  previous: MessageRow | undefined;
  mine: boolean;
  peerName: string;
  highlighted: boolean;
  onPointerDown: () => void;
  onPointerUp: () => void;
  onSuggestionTap: (artisanUid: string) => void;
}) {
  /* Show a timestamp divider when ≥ 5 minutes since the previous msg. */
  const showTimeDivider = (() => {
    if (!msg.createdAt) return false;
    if (!previous?.createdAt) return true;
    return msg.createdAt.seconds - previous.createdAt.seconds >= 300;
  })();

  /* Read state: how many recipients (excluding self) acknowledged. */
  const readByOthers = (msg.readBy ?? []).filter(u => u !== msg.senderId).length;
  const tickCount = readByOthers > 0 ? 2 : 1;

  /* Suggestion-card body */
  if (msg.kind === 'artisan_suggestions' && msg.suggestions && msg.suggestions.length > 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {showTimeDivider && <TimeDivider seconds={msg.createdAt?.seconds} />}
        <div className="msg-bubble them" style={{ maxWidth: '85%' }}>{msg.text}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: '85%' }}>
          {msg.suggestions.map(s => (
            <button
              key={s.userId}
              onClick={() => onSuggestionTap(s.userId)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px',
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--rx)', cursor: 'pointer',
                textAlign: 'left',
                transition: 'all .18s',
              }}
            >
              <SuggestionAvatar name={s.displayName} avatarUrl={s.avatarUrl} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: '.85rem', color: 'var(--text)' }}>
                  {s.displayName}
                </div>
                <div style={{ fontSize: '.72rem', color: 'var(--text2)' }}>
                  {s.trade ?? '—'}{s.rating !== null && <> · ⭐ {s.rating.toFixed(1)}</>}
                </div>
              </div>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      {showTimeDivider && <TimeDivider seconds={msg.createdAt?.seconds} />}
      <div style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
        <div
          className={`msg-bubble ${mine ? 'me' : 'them'}`}
          style={{
            maxWidth: '75%',
            transform: highlighted ? 'scale(1.04)' : undefined,
            transition: 'transform .15s ease-out',
            cursor: 'pointer',
          }}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onContextMenu={(e) => { e.preventDefault(); onPointerDown(); setTimeout(onPointerUp, 50); }}
        >
          {msg.replyTo && (
            <div style={{
              borderLeft: '3px solid rgba(255,255,255,.4)',
              paddingLeft: 8, marginBottom: 6,
              fontSize: '.74rem',
              opacity: 0.85,
              fontStyle: 'italic',
            }}>
              <strong>{msg.replyTo.senderName}</strong> · {msg.replyTo.text.slice(0, 80)}
            </div>
          )}
          {msg.kind === 'image' && msg.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={msg.imageUrl} alt="" style={{ maxWidth: '100%', borderRadius: 10, display: 'block' }} />
          ) : (
            msg.text
          )}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
            gap: 4, marginTop: 3,
            fontSize: '.62rem', opacity: 0.7,
          }}>
            <span>{fmtTime(msg.createdAt?.seconds)}</span>
            {mine && <Ticks count={tickCount} />}
          </div>
        </div>
      </div>
    </>
  );
}

function TimeDivider({ seconds }: { seconds?: number }) {
  if (!seconds) return null;
  return (
    <div style={{ textAlign: 'center', fontSize: '.68rem', color: 'var(--text3)', margin: '8px 0 2px' }}>
      {fmtTime(seconds)}
    </div>
  );
}

function Ticks({ count }: { count: 1 | 2 }) {
  /* Single tick = sent, double = read. Inline SVG so it inherits
     the bubble's text color. */
  return (
    <span aria-label={count === 2 ? 'Lu' : 'Envoyé'} style={{ display: 'inline-flex' }}>
      <svg width="14" height="10" viewBox="0 0 18 12" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="2 7 5.5 10 11 3" />
        {count === 2 && <polyline points="7 7 10.5 10 16 3" />}
      </svg>
    </span>
  );
}

function TypingDots() {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start', gap: 4, padding: '4px 12px' }}>
      <span style={{ display: 'inline-flex', gap: 3, padding: '8px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14 }}>
        {[0, 1, 2].map(i => (
          <span key={i} style={{
            width: 6, height: 6, borderRadius: '50%', background: 'var(--text3)',
            animation: `typing-bob 1.2s infinite ease-in-out ${i * 0.15}s`,
          }} />
        ))}
      </span>
      <style>{`
        @keyframes typing-bob {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30%           { transform: translateY(-4px); opacity: 1;   }
        }
      `}</style>
    </div>
  );
}

function SuggestionAvatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  const [resolved, setResolved] = useState<string | null>(null);
  useEffect(() => {
    if (!avatarUrl) { setResolved(null); return; }
    let cancelled = false;
    resolveStorageUrl(avatarUrl).then(u => { if (!cancelled) setResolved(u); });
    return () => { cancelled = true; };
  }, [avatarUrl]);
  const initials = name.split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div style={{
      width: 36, height: 36, borderRadius: '50%',
      background: resolved ? `center/cover url("${resolved}")` : 'linear-gradient(135deg, var(--b400), var(--b600))',
      color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 700, fontSize: '.78rem', fontFamily: "'Sora',sans-serif",
      flexShrink: 0,
    }}>
      {!resolved && initials}
    </div>
  );
}

/* Helper: if `unread` is a number (legacy) bump by 1, else +1 to peer entry. */
function incrementOrOne(prev: unknown, _peer: string): number {
  /* Returning a literal "1" merge-patch ensures even legacy bare-number
     unreads get reset cleanly. The Admin SDK path uses FieldValue.increment
     directly; we mirror that with a simple +1 on the client. */
  if (typeof prev === 'number') return prev + 1;
  return 1;
}
