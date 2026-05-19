'use client';

import { useEffect, useState } from 'react';
import { toast } from '@/lib/toast';
import { db } from '@/lib/firebase';
import {
  collection, doc, getDoc, onSnapshot, query, orderBy, limit,
} from 'firebase/firestore';

/**
 * Admin content — list recent posts + reels + stories, with toggles
 * for sponsor + a destructive delete action.
 *
 * Three independent live subscriptions (one per collection / type)
 * keep the page responsive without complex joins. Each row knows its
 * own kind so the sponsor + delete buttons hit the right endpoint
 * with the right payload.
 *
 * Sponsor goes through /api/admin/content/sponsor (Phase 6 route).
 * Delete goes through /api/admin/content/delete (Phase 7 route).
 */

type Kind = 'post' | 'reel' | 'story';

interface Row {
  id: string;
  kind: Kind;
  authorId?: string;
  authorName?: string;
  preview: string;          /* short text or media descriptor */
  thumb?: string | null;    /* poster/thumb url if available */
  sponsored: boolean;
  createdAt?: { seconds: number } | null;
}

function fmt(seconds?: number): string {
  if (!seconds) return '—';
  const d = new Date(seconds * 1000);
  const diff = Date.now() - seconds * 1000;
  if (diff < 60_000)     return 'à l\'instant';
  if (diff < 3600_000)   return `il y a ${Math.floor(diff / 60_000)} min`;
  if (diff < 86_400_000) return `il y a ${Math.floor(diff / 3600_000)} h`;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
}

const NAME_CACHE = new Map<string, string>();
async function hydrateName(uid: string): Promise<string> {
  if (!uid) return '—';
  if (NAME_CACHE.has(uid)) return NAME_CACHE.get(uid)!;
  try {
    if (!db) throw new Error();
    const s = await getDoc(doc(db, 'users', uid));
    if (s.exists()) {
      const name = String((s.data() as Record<string, unknown>).displayName ?? uid);
      NAME_CACHE.set(uid, name);
      return name;
    }
  } catch { /* fall through */ }
  NAME_CACHE.set(uid, uid);
  return uid;
}

export default function AdminContentPage() {
  const [tab, setTab] = useState<Kind | 'all'>('all');
  const [posts, setPosts] = useState<Row[]>([]);
  const [reels, setReels] = useState<Row[]>([]);
  const [stories, setStories] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [deleteFor, setDeleteFor] = useState<{ kind: Kind; id: string; preview: string } | null>(null);
  const [deleteReason, setDeleteReason] = useState('');

  /* Subscribe to feed_posts and split by type='reel' vs everything else. */
  useEffect(() => {
    if (!db) { setLoading(false); return; }
    const q = query(collection(db, 'feed_posts'), orderBy('createdAt', 'desc'), limit(50));
    const unsub = onSnapshot(q, async snap => {
      const all = snap.docs.map(d => {
        const x = d.data() as Record<string, unknown>;
        const kind: Kind = x.type === 'reel' ? 'reel' : 'post';
        const preview = kind === 'reel'
          ? (typeof x.title === 'string' && x.title ? x.title : 'Reel')
          : (typeof x.text === 'string' ? x.text.slice(0, 160) : 'Post');
        return {
          id: d.id,
          kind,
          authorId: typeof x.authorId === 'string' ? x.authorId : undefined,
          preview,
          thumb: typeof x.posterUrl === 'string' ? x.posterUrl : null,
          sponsored: x.sponsored === true,
          createdAt: (x.createdAt as { seconds: number } | null) ?? null,
        } as Row;
      });
      const hydrated = await Promise.all(all.map(async r => ({
        ...r, authorName: r.authorId ? await hydrateName(r.authorId) : '—',
      })));
      setPosts(hydrated.filter(r => r.kind === 'post'));
      setReels(hydrated.filter(r => r.kind === 'reel'));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, []);

  /* Stories — separate collection. */
  useEffect(() => {
    if (!db) return;
    const q = query(collection(db, 'stories'), orderBy('createdAt', 'desc'), limit(50));
    const unsub = onSnapshot(q, async snap => {
      const all = snap.docs.map(d => {
        const x = d.data() as Record<string, unknown>;
        return {
          id: d.id,
          kind: 'story' as const,
          authorId: typeof x.userId === 'string' ? x.userId : undefined,
          preview: x.kind === 'text'
            ? (typeof x.text === 'string' ? x.text.slice(0, 160) : 'Story texte')
            : 'Story photo',
          thumb: typeof x.mediaUrl === 'string' ? x.mediaUrl : null,
          sponsored: x.sponsored === true,
          createdAt: (x.createdAt as { seconds: number } | null) ?? null,
        } as Row;
      });
      const hydrated = await Promise.all(all.map(async r => ({
        ...r, authorName: r.authorId ? await hydrateName(r.authorId) : '—',
      })));
      setStories(hydrated);
    }, () => { /* silent — collection may not exist yet */ });
    return unsub;
  }, []);

  const rows = tab === 'all'
    ? [...posts, ...reels, ...stories].sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))
    : tab === 'post'  ? posts
    : tab === 'reel'  ? reels
    : stories;

  const toggleSponsor = async (row: Row) => {
    setActing(row.id);
    /* Payload kind matches the API enum: feed_post / reel / story. */
    const kind = row.kind === 'post' ? 'feed_post' : row.kind;
    try {
      const res = await fetch('/api/admin/content/sponsor', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind, id: row.id, sponsored: !row.sponsored }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast('❌ ' + (j.message ?? 'Erreur'));
      } else {
        toast(row.sponsored ? 'Sponsor retiré' : '⭐ Contenu sponsorisé');
      }
    } catch {
      toast('❌ Erreur réseau');
    } finally {
      setActing(null);
    }
  };

  const performDelete = async () => {
    if (!deleteFor) return;
    if (deleteReason.trim().length < 5) {
      toast('⚠️ La raison doit faire au moins 5 caractères');
      return;
    }
    setActing(deleteFor.id);
    try {
      const res = await fetch('/api/admin/content/delete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          kind: deleteFor.kind,
          id:   deleteFor.id,
          reason: deleteReason.trim(),
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast('❌ ' + (j.message ?? 'Erreur'));
      } else {
        toast('🗑️ Contenu supprimé');
        setDeleteFor(null);
        setDeleteReason('');
      }
    } catch {
      toast('❌ Erreur réseau');
    } finally {
      setActing(null);
    }
  };

  const counts = { all: posts.length + reels.length + stories.length, post: posts.length, reel: reels.length, story: stories.length };

  return (
    <div className="page on" id="page-content">
      <div className="page-header au">
        <div>
          <div className="page-h1">📝 Contenu</div>
          <div className="page-sub">
            Sponsoriser ou supprimer des posts, reels et stories
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, borderBottom: '1px solid var(--border)' }} className="au1">
        {([
          { id: 'all',   label: `Tous (${counts.all})` },
          { id: 'post',  label: `Posts (${counts.post})` },
          { id: 'reel',  label: `Reels (${counts.reel})` },
          { id: 'story', label: `Stories (${counts.story})` },
        ] as const).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              background: 'none', border: 'none',
              padding: '10px 14px',
              fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: '.84rem',
              color: tab === t.id ? 'var(--b500)' : 'var(--text2)',
              borderBottom: tab === t.id ? '2px solid var(--b500)' : '2px solid transparent',
              cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="card au2" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)' }}>Chargement…</div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>
            <div style={{ fontSize: '2.4rem', marginBottom: 8 }}>📭</div>
            <div style={{ fontSize: '.9rem', color: 'var(--text2)', fontWeight: 600 }}>
              Aucun contenu dans cet onglet
            </div>
          </div>
        ) : (
          rows.map(r => (
            <div
              key={`${r.kind}_${r.id}`}
              style={{
                display: 'flex', gap: 12, alignItems: 'flex-start',
                padding: 14, borderBottom: '1px solid var(--border)',
              }}
            >
              {/* Kind chip */}
              <div style={{
                flexShrink: 0, width: 56,
                fontSize: '.62rem', fontWeight: 700,
                textAlign: 'center', padding: '3px 6px', borderRadius: 6,
                background: r.kind === 'reel' ? '#9b59b6'
                  : r.kind === 'story' ? '#e67e22' : 'var(--b500)',
                color: '#fff',
                textTransform: 'uppercase',
              }}>
                {r.kind}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: '.86rem', color: 'var(--text)' }}>
                    {r.authorName}
                  </span>
                  <span style={{ fontSize: '.7rem', color: 'var(--text3)' }}>· {fmt(r.createdAt?.seconds)}</span>
                  {r.sponsored && (
                    <span style={{ fontSize: '.62rem', fontWeight: 700, background: 'var(--gol)', color: '#fff', padding: '1px 8px', borderRadius: 50 }}>
                      ⭐ Sponsorisé
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '.82rem', color: 'var(--text2)', marginTop: 4, lineHeight: 1.5, wordBreak: 'break-word' }}>
                  {r.preview}
                </div>
                <div style={{ fontSize: '.68rem', color: 'var(--text3)', marginTop: 4, fontFamily: 'monospace' }}>
                  id: <span style={{ userSelect: 'all' }}>{r.id}</span>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 130 }}>
                <button
                  className={r.sponsored ? 'btn-outline sm' : 'btn-primary sm'}
                  onClick={() => toggleSponsor(r)}
                  disabled={acting === r.id}
                  style={{ justifyContent: 'center' }}
                >
                  {r.sponsored ? 'Retirer ⭐' : 'Sponsoriser'}
                </button>
                <button
                  className="btn-outline sm"
                  onClick={() => setDeleteFor({ kind: r.kind, id: r.id, preview: r.preview })}
                  disabled={acting === r.id}
                  style={{ justifyContent: 'center', borderColor: 'var(--rd)', color: 'var(--rd)' }}
                >
                  Supprimer
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Hard-delete confirm */}
      {deleteFor && (
        <div
          className="modal-bg on"
          onClick={(e) => { if (e.target === e.currentTarget) { setDeleteFor(null); setDeleteReason(''); } }}
        >
          <div className="modal-box" style={{ maxWidth: 460, padding: 22 }}>
            <div className="modal-header">
              <div className="modal-title">🗑️ Supprimer le contenu</div>
              <button
                className="modal-close"
                onClick={() => { setDeleteFor(null); setDeleteReason(''); }}
                aria-label="Fermer"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div style={{ fontSize: '.85rem', color: 'var(--text2)', lineHeight: 1.55, marginBottom: 12 }}>
              Suppression d&apos;un <strong>{deleteFor.kind}</strong> :
              <div style={{ fontStyle: 'italic', marginTop: 6, color: 'var(--text)' }}>
                &ldquo;{deleteFor.preview}&rdquo;
              </div>
              Le doc Firestore et les médias Storage seront supprimés. Un instantané reste dans l&apos;audit pour restauration manuelle.
            </div>
            <label style={{ display: 'block', fontSize: '.76rem', fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
              Raison <span style={{ color: 'var(--rd)' }}>*</span>
            </label>
            <textarea
              value={deleteReason}
              onChange={e => setDeleteReason(e.target.value.slice(0, 500))}
              rows={3}
              maxLength={500}
              placeholder="Ex. Contenu inapproprié signalé"
              style={{
                width: '100%', padding: 9,
                border: '1.5px solid var(--border2)', borderRadius: 'var(--rx)',
                background: 'var(--surface)', color: 'var(--text)',
                fontSize: '.85rem', fontFamily: 'inherit', resize: 'vertical',
              }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button
                className="btn-outline"
                onClick={() => { setDeleteFor(null); setDeleteReason(''); }}
                disabled={acting === deleteFor.id}
                style={{ flex: 1, justifyContent: 'center' }}
              >
                Annuler
              </button>
              <button
                className="btn-primary"
                onClick={performDelete}
                disabled={acting === deleteFor.id || deleteReason.trim().length < 5}
                style={{ flex: 2, justifyContent: 'center', background: 'var(--rd)' }}
              >
                {acting === deleteFor.id ? 'Suppression…' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
