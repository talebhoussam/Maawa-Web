'use client';

import { useCallback, useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import {
  collection, getDocs, orderBy, query, where, limit, startAfter,
  type DocumentData, type QueryDocumentSnapshot, type QueryConstraint,
} from 'firebase/firestore';

/**
 * Admin Audit Log viewer.
 *
 * Paginated reader over the `audit_logs` collection. We deliberately
 * avoid `onSnapshot` here: audit logs append rapidly and a live
 * subscription with 100 rows would re-render on every server-side
 * audit, which adds zero value for a log viewer.
 *
 * Filters:
 *   - Action prefix (`admin.user.*`, `mission.*`, etc.) — typed in.
 *   - Actor uid — typed in.
 *
 * Pagination: cursor-based with startAfter on the last doc; page size
 * 50. We don't compute total count (would require a separate
 * aggregation query) — just show "Page N" and a Next/Prev pair.
 */

interface AuditEvent {
  id: string;
  action: string;
  actor: string;
  target?: string;
  meta?: Record<string, unknown>;
  createdAt?: { seconds: number } | null;
}

function fmtFull(seconds?: number): string {
  if (!seconds) return '—';
  return new Date(seconds * 1000).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

const PAGE_SIZE = 50;

export default function AdminAuditPage() {
  const [rows, setRows] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState('');
  const [actorFilter, setActorFilter] = useState('');
  const [cursors, setCursors] = useState<QueryDocumentSnapshot<DocumentData>[]>([]);
  const [pageIdx, setPageIdx] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const fetchPage = useCallback(async (cursor: QueryDocumentSnapshot<DocumentData> | null) => {
    if (!db) return;
    setLoading(true); setError(null);
    try {
      const constraints: QueryConstraint[] = [
        orderBy('createdAt', 'desc'),
        limit(PAGE_SIZE + 1),  /* +1 to detect hasMore without a count query */
      ];
      if (cursor) constraints.push(startAfter(cursor));
      const q = actionFilter
        ? query(collection(db, 'audit_logs'),
            where('action', '>=', actionFilter),
            where('action', '<', actionFilter + '\uf8ff'),
            ...constraints)
        : query(collection(db, 'audit_logs'), ...constraints);
      const snap = await getDocs(q);
      const docs = snap.docs.slice(0, PAGE_SIZE);
      const raw = docs.map(d => ({ id: d.id, ...(d.data() as object) } as AuditEvent));
      const visible = actorFilter
        ? raw.filter(r => r.actor.toLowerCase().includes(actorFilter.toLowerCase()))
        : raw;
      setRows(visible);
      setHasMore(snap.docs.length > PAGE_SIZE);
      /* Remember the last visible cursor so Next page can pick up. */
      if (docs.length > 0) {
        setCursors(prev => {
          const next = [...prev];
          next[pageIdx] = docs[docs.length - 1];
          return next;
        });
      }
    } catch (err) {
      console.error('audit fetch', err);
      setError('Impossible de charger les logs');
    } finally {
      setLoading(false);
    }
  }, [actionFilter, actorFilter, pageIdx]);

  /* Refresh on filter change — reset pagination. */
  useEffect(() => {
    setPageIdx(0);
    setCursors([]);
    fetchPage(null);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [actionFilter, actorFilter]);

  const next = () => {
    if (!hasMore) return;
    const cursor = cursors[pageIdx];
    if (!cursor) return;
    setPageIdx(p => p + 1);
    fetchPage(cursor);
  };
  const prev = () => {
    if (pageIdx === 0) return;
    const newIdx = pageIdx - 1;
    setPageIdx(newIdx);
    const cursor = newIdx > 0 ? cursors[newIdx - 1] : null;
    fetchPage(cursor);
  };

  return (
    <div className="page on" id="page-audit">
      <div className="page-header au">
        <div>
          <div className="page-h1">📜 Audit log</div>
          <div className="page-sub">Historique complet des actions privilégiées</div>
        </div>
      </div>

      <div className="au1" style={{ marginBottom: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input
          type="text"
          value={actionFilter}
          onChange={e => setActionFilter(e.target.value)}
          placeholder="Filtrer par action (ex. admin.user, mission)"
          style={{
            flex: '1 1 200px', minWidth: 180, padding: 9,
            border: '1.5px solid var(--border2)', borderRadius: 'var(--rx)',
            background: 'var(--surface)', color: 'var(--text)',
            fontSize: '.86rem',
          }}
        />
        <input
          type="text"
          value={actorFilter}
          onChange={e => setActorFilter(e.target.value)}
          placeholder="Filtrer par actor uid"
          style={{
            flex: '1 1 200px', minWidth: 180, padding: 9,
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
          <div style={{ padding: 32, textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: 8 }}>⚠️</div>
            <div style={{ color: 'var(--rd)', fontSize: '.88rem' }}>{error}</div>
          </div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>
            <div style={{ fontSize: '2.4rem', marginBottom: 8 }}>📭</div>
            <div style={{ fontSize: '.9rem', color: 'var(--text2)', fontWeight: 600 }}>
              Aucun log trouvé
            </div>
          </div>
        ) : (
          rows.map(r => (
            <div
              key={r.id}
              style={{
                padding: 12,
                borderBottom: '1px solid var(--border)',
                fontFamily: 'monospace',
                fontSize: '.76rem',
              }}
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'baseline' }}>
                <span style={{ color: 'var(--text3)' }}>{fmtFull(r.createdAt?.seconds)}</span>
                <span style={{ color: 'var(--b500)', fontWeight: 700 }}>{r.action}</span>
                <span style={{ color: 'var(--text2)' }}>
                  actor=<code style={{ background: 'var(--surface2)', padding: '1px 4px', borderRadius: 3 }}>{r.actor}</code>
                </span>
                {r.target && (
                  <span style={{ color: 'var(--text2)' }}>
                    target=<code style={{ background: 'var(--surface2)', padding: '1px 4px', borderRadius: 3 }}>{r.target}</code>
                  </span>
                )}
              </div>
              {r.meta && Object.keys(r.meta).length > 0 && (
                <div style={{ marginTop: 4, color: 'var(--text3)', fontSize: '.72rem', wordBreak: 'break-word' }}>
                  {JSON.stringify(r.meta).slice(0, 600)}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 14 }}>
        <button
          className="btn-outline sm"
          onClick={prev}
          disabled={pageIdx === 0 || loading}
        >
          ← Précédent
        </button>
        <span style={{ fontSize: '.8rem', color: 'var(--text2)', minWidth: 100, textAlign: 'center' }}>
          Page {pageIdx + 1}
        </span>
        <button
          className="btn-outline sm"
          onClick={next}
          disabled={!hasMore || loading}
        >
          Suivant →
        </button>
      </div>
    </div>
  );
}
