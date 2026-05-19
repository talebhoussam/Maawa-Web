'use client';

import { useEffect, useState } from 'react';
import { toast } from '@/lib/toast';
import { db, auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection, deleteDoc, doc, onSnapshot,
  orderBy, query, limit,
} from 'firebase/firestore';
import { useRequireAuth } from '@/components/ConnectOrCallModal';
import ReportButton from '@/components/ReportButton';

/**
 * CommentsSheet — full-screen overlay listing a post's comments and
 * letting the viewer add one. Used by feed and reels via a render-prop
 * pattern: parent owns the `open` state, this component handles its
 * own data fetching once mounted.
 *
 * Guests can read comments freely. Posting one is wrapped in
 * useRequireAuth so unauth taps open the connect modal instead.
 */

interface Comment {
  id: string;
  authorId: string;
  authorName?: string;
  text: string;
  createdAt?: { seconds: number } | null;
}

function fmtRel(seconds?: number): string {
  if (!seconds) return '';
  const diff = Date.now() - seconds * 1000;
  if (diff < 60_000)    return 'à l\'instant';
  if (diff < 3600_000)  return `il y a ${Math.floor(diff / 60_000)} min`;
  if (diff < 86_400_000) return `il y a ${Math.floor(diff / 3600_000)} h`;
  const d = new Date(seconds * 1000);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
}

interface Props {
  postId: string;
  postAuthorId?: string;
  onClose: () => void;
}

export default function CommentsSheet({ postId, postAuthorId, onClose }: Props) {
  const requireAuth = useRequireAuth();
  const [myUid, setMyUid] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => onAuthStateChanged(auth, u => setMyUid(u?.uid ?? null)), []);

  useEffect(() => {
    if (!db) { setLoading(false); return; }
    const q = query(
      collection(db, 'feed_posts', postId, 'comments'),
      orderBy('createdAt', 'asc'),
      limit(200),
    );
    const unsub = onSnapshot(q, snap => {
      setComments(snap.docs.map(d => ({ id: d.id, ...(d.data() as object) } as Comment)));
      setLoading(false);
    }, err => {
      console.warn('comments snapshot', err);
      setLoading(false);
    });
    return unsub;
  }, [postId]);

  const submit = () => requireAuth(async () => {
    const trimmed = text.trim();
    if (trimmed.length === 0 || sending) return;
    setSending(true);
    try {
      const res = await fetch('/api/comments/create', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ postId, text: trimmed }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast('❌ ' + (j.message ?? 'Erreur'));
      } else {
        setText('');
        /* Snapshot will refresh — no optimistic write needed. */
      }
    } catch {
      toast('❌ Erreur réseau');
    } finally {
      setSending(false);
    }
  }, 'commenter');

  const removeComment = async (commentId: string, authorId: string) => {
    if (myUid !== authorId && myUid !== postAuthorId) return;
    if (!confirm('Supprimer ce commentaire ?')) return;
    try {
      await deleteDoc(doc(db, 'feed_posts', postId, 'comments', commentId));
      /* Snapshot updates automatically. We DON'T decrement
         commentsCount here — that would require a server route. The
         counter mildly over-reports until the parent doc is rewritten;
         acceptable for a v1, and the visible list is always correct. */
    } catch (err) {
      console.warn('comment delete failed', err);
      toast('❌ Erreur');
    }
  };

  return (
    <div
      className="modal-bg on"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ alignItems: 'flex-end' }}
    >
      <div
        className="modal-box"
        style={{
          maxWidth: 560,
          width: '100%',
          maxHeight: '80vh',
          padding: 0,
          display: 'flex', flexDirection: 'column',
        }}
      >
        <div className="modal-header" style={{ padding: 14, borderBottom: '1px solid var(--border)' }}>
          <div className="modal-title">💬 Commentaires{comments.length > 0 ? ` (${comments.length})` : ''}</div>
          <button className="modal-close" onClick={onClose} aria-label="Fermer">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
          {loading ? (
            <div style={{ textAlign: 'center', color: 'var(--text3)', padding: 32 }}>…</div>
          ) : comments.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--text3)' }}>
              <div style={{ fontSize: '2.2rem', marginBottom: 6 }}>💭</div>
              <div style={{ fontSize: '.86rem', color: 'var(--text2)', fontWeight: 600 }}>
                Soyez le premier à commenter
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {comments.map(c => {
                const canDelete = myUid && (myUid === c.authorId || myUid === postAuthorId);
                return (
                  <div key={c.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <div style={{
                      width: 32, height: 32, flexShrink: 0,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, var(--b400), var(--b600))',
                      color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 700, fontSize: '.72rem', fontFamily: "'Sora',sans-serif",
                    }}>
                      {(c.authorName?.[0] ?? '?').toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: '.82rem', color: 'var(--text)' }}>
                          {c.authorName ?? c.authorId}
                        </span>
                        <span style={{ fontSize: '.7rem', color: 'var(--text3)' }}>
                          {fmtRel(c.createdAt?.seconds)}
                        </span>
                      </div>
                      <div style={{ fontSize: '.86rem', color: 'var(--text)', marginTop: 2, lineHeight: 1.5, wordBreak: 'break-word' }}>
                        {c.text}
                      </div>
                      <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
                        <ReportButton targetKind="comment" targetId={c.id} parentId={postId} label="" />
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => removeComment(c.id, c.authorId)}
                            style={{
                              background: 'none', border: 'none', cursor: 'pointer',
                              color: 'var(--text3)', fontSize: '.74rem', padding: '4px 8px',
                            }}
                          >
                            🗑️ Supprimer
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, padding: 12, borderTop: '1px solid var(--border)' }}>
          <input
            type="text"
            value={text}
            onChange={e => setText(e.target.value.slice(0, 1000))}
            placeholder="Ajoutez un commentaire…"
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), submit())}
            disabled={sending}
            style={{
              flex: 1, padding: '9px 11px',
              border: '1.5px solid var(--border2)', borderRadius: 'var(--rx)',
              background: 'var(--surface)', color: 'var(--text)',
              fontSize: '.86rem',
            }}
          />
          <button
            className="btn-primary sm"
            onClick={submit}
            disabled={sending || text.trim().length === 0}
            style={{ justifyContent: 'center' }}
          >
            Envoyer
          </button>
        </div>
      </div>
    </div>
  );
}
