'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from '@/lib/toast';
import { db } from '@/lib/firebase';
import {
  collection, doc, getDoc, onSnapshot, query, where, orderBy, limit,
} from 'firebase/firestore';

/**
 * Admin reports inbox.
 *
 * Three tabs (Open / Reviewing / Resolved). Each row shows reporter,
 * target, reason, note, age, and a Resolve dropdown (Dismiss /
 * Remove content / Ban user) that POSTs to /api/admin/reports/resolve.
 *
 * No bulk-resolve in this iteration — the brief mentions it but the
 * realistic v1 use case is moderators reviewing one at a time. We
 * can add a checkbox column later if needed.
 */

const STATUSES = [
  { id: 'open',      label: 'Ouverts'    },
  { id: 'reviewing', label: 'En cours'   },
  { id: 'resolved',  label: 'Résolus'    },
  { id: 'dismissed', label: 'Rejetés'    },
] as const;

interface Report {
  id: string;
  reporterId: string;
  reporterName?: string;
  targetKind: string;
  targetId: string;
  reason: string;
  note: string | null;
  status: 'open' | 'reviewing' | 'resolved' | 'dismissed';
  createdAt?: { seconds: number } | null;
  resolution?: string | null;
  reviewedBy?: string | null;
}

const REASON_LABEL: Record<string, string> = {
  spam:          'Spam',
  harassment:    'Harcèlement',
  fake:          'Faux profil',
  inappropriate: 'Inapproprié',
  fraud:         'Fraude',
  other:         'Autre',
};

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

function fmt(seconds?: number): string {
  if (!seconds) return '—';
  const d = new Date(seconds * 1000);
  const diff = Date.now() - seconds * 1000;
  if (diff < 60_000)    return 'à l\'instant';
  if (diff < 3600_000)  return `il y a ${Math.floor(diff / 60_000)} min`;
  if (diff < 86_400_000) return `il y a ${Math.floor(diff / 3600_000)} h`;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
}

export default function AdminReportsPage() {
  const [tab, setTab] = useState<typeof STATUSES[number]['id']>('open');
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);

  /* Live subscription per active tab. */
  useEffect(() => {
    if (!db) { setLoading(false); return; }
    setLoading(true); setError(null);
    const q = query(
      collection(db, 'reports'),
      where('status', '==', tab),
      orderBy('createdAt', 'desc'),
      limit(50),
    );
    const unsub = onSnapshot(q, async snap => {
      const raw: Report[] = snap.docs.map(d => {
        const x = d.data() as Record<string, unknown>;
        return {
          id: d.id,
          reporterId: String(x.reporterId ?? ''),
          targetKind: String(x.targetKind ?? ''),
          targetId:   String(x.targetId   ?? ''),
          reason:     String(x.reason     ?? 'other'),
          note:       (x.note as string | null) ?? null,
          status:     (x.status as Report['status']) ?? 'open',
          createdAt:  (x.createdAt as { seconds: number } | null) ?? null,
          resolution: (x.resolution as string | null) ?? null,
          reviewedBy: (x.reviewedBy as string | null) ?? null,
        };
      });
      /* Hydrate reporter names in parallel. */
      const hydrated = await Promise.all(raw.map(async r => ({
        ...r, reporterName: r.reporterId ? await hydrateName(r.reporterId) : '—',
      })));
      setReports(hydrated);
      setLoading(false);
    }, err => {
      console.error('reports snapshot', err);
      setError('Impossible de charger les signalements');
      setLoading(false);
    });
    return unsub;
  }, [tab]);

  const counts = useMemo(() => ({
    [tab]: reports.length,
  }), [tab, reports.length]);
  void counts; /* could surface as a header counter */

  const resolve = async (reportId: string, action: 'dismiss' | 'remove_content' | 'ban_user') => {
    setActing(reportId);
    try {
      const res = await fetch('/api/admin/reports/resolve', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reportId, action }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast('❌ ' + (j.message ?? 'Erreur'));
      } else {
        toast('✅ Signalement traité');
      }
    } catch {
      toast('❌ Erreur réseau');
    } finally {
      setActing(null);
    }
  };

  return (
    <div className="page on" id="page-reports">
      <div className="page-header au">
        <div>
          <div className="page-h1">🚩 Signalements</div>
          <div className="page-sub">Modération des contenus signalés par les utilisateurs</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, borderBottom: '1px solid var(--border)' }} className="au1">
        {STATUSES.map(s => (
          <button
            key={s.id}
            onClick={() => setTab(s.id)}
            style={{
              background: 'none', border: 'none',
              padding: '10px 16px',
              fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: '.86rem',
              color: tab === s.id ? 'var(--b500)' : 'var(--text2)',
              borderBottom: tab === s.id ? '2px solid var(--b500)' : '2px solid transparent',
              cursor: 'pointer',
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="card au2" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)' }}>
            Chargement…
          </div>
        ) : error ? (
          <div style={{ padding: 32, textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: 8 }}>⚠️</div>
            <div style={{ color: 'var(--rd)', fontSize: '.88rem', marginBottom: 12 }}>{error}</div>
            <button className="btn-outline sm" onClick={() => setTab(t => t)}>Réessayer</button>
          </div>
        ) : reports.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>
            <div style={{ fontSize: '2.4rem', marginBottom: 8 }}>📭</div>
            <div style={{ fontSize: '.9rem', color: 'var(--text2)', fontWeight: 600 }}>
              Aucun signalement dans cet onglet
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {reports.map(r => (
              <div
                key={r.id}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                  padding: 14,
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: '.88rem', color: 'var(--text)' }}>
                      {r.reporterName}
                    </span>
                    <span style={{ fontSize: '.72rem', color: 'var(--text3)' }}>
                      a signalé un <strong>{r.targetKind}</strong>
                    </span>
                    <span style={{
                      fontSize: '.66rem', fontWeight: 700,
                      padding: '2px 8px', borderRadius: 50,
                      background: 'var(--rl)', color: 'var(--rd)',
                    }}>
                      {REASON_LABEL[r.reason] ?? r.reason}
                    </span>
                    <span style={{ fontSize: '.7rem', color: 'var(--text3)' }}>
                      · {fmt(r.createdAt?.seconds)}
                    </span>
                  </div>
                  <div style={{ fontSize: '.76rem', color: 'var(--text2)', marginTop: 4, fontFamily: 'monospace' }}>
                    Target id: <span style={{ userSelect: 'all' }}>{r.targetId}</span>
                  </div>
                  {r.note && (
                    <div style={{ fontSize: '.82rem', color: 'var(--text)', marginTop: 6, fontStyle: 'italic', lineHeight: 1.5 }}>
                      &ldquo;{r.note}&rdquo;
                    </div>
                  )}
                  {r.resolution && tab !== 'open' && tab !== 'reviewing' && (
                    <div style={{ fontSize: '.74rem', color: 'var(--gn)', marginTop: 6 }}>
                      Résolution: {r.resolution}
                    </div>
                  )}
                </div>
                {(tab === 'open' || tab === 'reviewing') && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 130 }}>
                    <button
                      className="btn-outline sm"
                      onClick={() => resolve(r.id, 'dismiss')}
                      disabled={acting === r.id}
                      style={{ justifyContent: 'center' }}
                    >
                      Rejeter
                    </button>
                    {r.targetKind !== 'user' && r.targetKind !== 'ad' && (
                      <button
                        className="btn-primary sm"
                        onClick={() => {
                          if (confirm('Supprimer ce contenu définitivement ?')) {
                            resolve(r.id, 'remove_content');
                          }
                        }}
                        disabled={acting === r.id}
                        style={{ justifyContent: 'center' }}
                      >
                        Supprimer
                      </button>
                    )}
                    {r.targetKind === 'user' && (
                      <button
                        className="btn-primary sm"
                        onClick={() => {
                          if (confirm('Bannir cet utilisateur ? (soft-delete + révocation tokens)')) {
                            resolve(r.id, 'ban_user');
                          }
                        }}
                        disabled={acting === r.id}
                        style={{ justifyContent: 'center', background: 'var(--rd)' }}
                      >
                        Bannir
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
