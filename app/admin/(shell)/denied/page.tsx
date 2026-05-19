'use client';

import { useEffect, useState } from 'react';
import { toast } from '@/lib/toast';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, where, orderBy, limit } from 'firebase/firestore';

/**
 * Admin Denied/Banned Users.
 *
 * Lists every user with banned=true. The Firestore query needs an
 * index on (banned, bannedAt) — that index is in firestore.indexes.json.
 *
 * Unban posts to /api/admin/users/unban which restores both the
 * Firestore flags AND the Firebase Auth account.
 */

interface BannedUser {
  id: string;
  displayName: string;
  email?: string;
  role?: string;
  bannedAt?: { seconds: number } | null;
  deletedReason?: string | null;
  bannedBy?: string | null;
}

function fmt(s?: number): string {
  if (!s) return '—';
  return new Date(s * 1000).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function AdminDeniedPage() {
  const [rows, setRows] = useState<BannedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [acting, setActing] = useState<string | null>(null);
  const [unbanFor, setUnbanFor] = useState<BannedUser | null>(null);
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!db) { setLoading(false); return; }
    /* Query by banned=true. We DON'T orderBy bannedAt because the
       index would need a separate composite (banned asc, bannedAt
       desc). Order client-side instead — fine at 50-row caps. */
    const q = query(
      collection(db, 'users'),
      where('banned', '==', true),
      limit(100),
    );
    const unsub = onSnapshot(q, snap => {
      const list: BannedUser[] = snap.docs.map(d => {
        const x = d.data() as Record<string, unknown>;
        return {
          id: d.id,
          displayName: String(x.displayName ?? d.id),
          email:       typeof x.email         === 'string' ? x.email         : undefined,
          role:        typeof x.role          === 'string' ? x.role          : undefined,
          bannedAt:    (x.bannedAt as { seconds: number } | null) ?? null,
          deletedReason: typeof x.deletedReason === 'string' ? x.deletedReason : null,
          bannedBy:    typeof x.bannedBy      === 'string' ? x.bannedBy      : null,
        };
      });
      list.sort((a, b) => (b.bannedAt?.seconds ?? 0) - (a.bannedAt?.seconds ?? 0));
      setRows(list);
      setLoading(false);
    }, err => {
      console.error('denied snapshot', err);
      setError('Impossible de charger la liste');
      setLoading(false);
    });
    return unsub;
  }, []);

  const filtered = filter
    ? rows.filter(r =>
        r.displayName.toLowerCase().includes(filter.toLowerCase())
        || (r.email ?? '').toLowerCase().includes(filter.toLowerCase())
        || r.id.toLowerCase().includes(filter.toLowerCase())
      )
    : rows;

  const performUnban = async () => {
    if (!unbanFor) return;
    if (reason.trim().length < 5) {
      toast('⚠️ La raison doit faire au moins 5 caractères');
      return;
    }
    setActing(unbanFor.id);
    try {
      const res = await fetch('/api/admin/users/unban', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ uid: unbanFor.id, reason: reason.trim() }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast('❌ ' + (j.message ?? 'Erreur'));
      } else {
        toast('✅ Utilisateur réactivé');
        setUnbanFor(null);
        setReason('');
      }
    } catch {
      toast('❌ Erreur réseau');
    } finally {
      setActing(null);
    }
  };

  return (
    <div className="page on" id="page-denied">
      <div className="page-header au">
        <div>
          <div className="page-h1">🚫 Comptes bannis</div>
          <div className="page-sub">{rows.length} compte{rows.length !== 1 ? 's' : ''} actuellement banni{rows.length !== 1 ? 's' : ''}</div>
        </div>
      </div>

      <div className="au1" style={{ marginBottom: 14 }}>
        <input
          type="text"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="🔍 Filtrer par nom, email ou UID"
          style={{
            width: '100%', maxWidth: 360, padding: 9,
            border: '1.5px solid var(--border2)', borderRadius: 'var(--rx)',
            background: 'var(--surface)', color: 'var(--text)',
            fontSize: '.86rem',
          }}
        />
      </div>

      <div className="card au2" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)' }}>Chargement…</div>
        ) : error ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--rd)' }}>{error}</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>
            <div style={{ fontSize: '2.4rem', marginBottom: 8 }}>✓</div>
            <div style={{ fontSize: '.9rem', color: 'var(--text2)', fontWeight: 600 }}>
              {filter ? 'Aucun compte ne correspond' : 'Aucun compte banni'}
            </div>
          </div>
        ) : filtered.map(r => (
          <div key={r.id} style={{
            display: 'flex', gap: 12, alignItems: 'flex-start',
            padding: 14, borderBottom: '1px solid var(--border)',
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: '.92rem', color: 'var(--text)' }}>
                  {r.displayName}
                </span>
                <span style={{
                  fontSize: '.66rem', fontWeight: 700, color: 'var(--rd)',
                  background: 'var(--rl)', padding: '2px 8px', borderRadius: 50,
                }}>Banni</span>
                {r.role && <span style={{ fontSize: '.72rem', color: 'var(--text3)' }}>· {r.role}</span>}
              </div>
              {r.email && <div style={{ fontSize: '.78rem', color: 'var(--text2)', marginTop: 2 }}>{r.email}</div>}
              <div style={{ fontSize: '.72rem', color: 'var(--text3)', marginTop: 4, fontFamily: 'monospace' }}>
                uid: {r.id}
              </div>
              {r.deletedReason && (
                <div style={{ fontSize: '.78rem', color: 'var(--rd)', marginTop: 6, fontStyle: 'italic', lineHeight: 1.5 }}>
                  Raison du bannissement : {r.deletedReason}
                </div>
              )}
              {r.bannedAt && (
                <div style={{ fontSize: '.7rem', color: 'var(--text3)', marginTop: 2 }}>
                  Banni le {fmt(r.bannedAt.seconds)}
                </div>
              )}
            </div>
            <button
              className="btn-outline sm"
              onClick={() => { setUnbanFor(r); setReason(''); }}
              disabled={acting === r.id}
              style={{ justifyContent: 'center', borderColor: 'var(--gn)', color: 'var(--gn)' }}
            >
              ✓ Réactiver
            </button>
          </div>
        ))}
      </div>

      {unbanFor && (
        <div className="modal-bg on" onClick={e => { if (e.target === e.currentTarget) setUnbanFor(null); }}>
          <div className="modal-box" style={{ maxWidth: 440, padding: 22 }}>
            <div className="modal-header">
              <div className="modal-title">✓ Réactiver le compte</div>
              <button className="modal-close" onClick={() => setUnbanFor(null)} aria-label="Fermer">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div style={{ fontSize: '.85rem', color: 'var(--text2)', marginBottom: 12, lineHeight: 1.55 }}>
              Vous êtes sur le point de réactiver <strong>{unbanFor.displayName}</strong>.
              Le compte redeviendra utilisable. Cette action est tracée dans le journal d&apos;audit.
            </div>
            <label style={{ display: 'block', fontSize: '.76rem', fontWeight: 600, marginBottom: 4 }}>
              Justification de la réactivation <span style={{ color: 'var(--rd)' }}>*</span>
            </label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value.slice(0, 500))}
              rows={3}
              maxLength={500}
              placeholder="Ex. Faux positif — bannissement levé après revue"
              style={{
                width: '100%', padding: 9,
                border: '1.5px solid var(--border2)', borderRadius: 'var(--rx)',
                background: 'var(--surface)', color: 'var(--text)',
                fontSize: '.85rem', fontFamily: 'inherit', resize: 'vertical',
              }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button className="btn-outline" onClick={() => setUnbanFor(null)} disabled={acting === unbanFor.id} style={{ flex: 1, justifyContent: 'center' }}>
                Annuler
              </button>
              <button
                className="btn-primary"
                onClick={performUnban}
                disabled={acting === unbanFor.id || reason.trim().length < 5}
                style={{ flex: 2, justifyContent: 'center', background: 'var(--gn)' }}
              >
                Confirmer la réactivation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
