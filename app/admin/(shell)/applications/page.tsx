'use client';

import { useEffect, useState } from 'react';
import { toast } from '@/lib/toast';
import { db } from '@/lib/firebase';
import {
  collection, doc, getDoc, onSnapshot, query, where, orderBy, limit,
} from 'firebase/firestore';

/**
 * Admin Applications inbox.
 *
 * Lists artisan-application docs from /applications, split by status.
 * Approve calls /api/admin/applications/approve which flips the user
 * doc to role='artisan' + verified=true; reject leaves the user as a
 * client and stamps the application as rejected with a reason.
 *
 * NIN documents are linked by Storage path; admin clicks "Voir le
 * document" to download via a short-lived signed URL (issued by the
 * existing applications-review download route — TODO if missing).
 * For v1 we just show the bare path so the admin knows what to look
 * up in the Storage console.
 */

const TABS = [
  { id: 'pending',  label: 'En attente', color: 'var(--or)' },
  { id: 'approved', label: 'Approuvées', color: 'var(--gn)' },
  { id: 'rejected', label: 'Rejetées',   color: 'var(--rd)' },
] as const;

interface AppDoc {
  id: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  trade: string;
  experience: number;
  ninNumber: string;
  bio?: string;
  documents: string[];
  status: 'pending' | 'approved' | 'rejected';
  createdAt?: { seconds: number } | null;
  reviewedAt?: { seconds: number } | null;
  rejectReason?: string | null;
}

function fmt(seconds?: number): string {
  if (!seconds) return '—';
  return new Date(seconds * 1000).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const NAME_CACHE = new Map<string, { name: string; email: string | null }>();
async function hydrateUser(uid: string): Promise<{ name: string; email: string | null }> {
  if (NAME_CACHE.has(uid)) return NAME_CACHE.get(uid)!;
  try {
    if (!db) throw new Error();
    const s = await getDoc(doc(db, 'users', uid));
    if (s.exists()) {
      const d = s.data() as Record<string, unknown>;
      const r = {
        name:  String(d.displayName ?? uid),
        email: typeof d.email === 'string' ? d.email : null,
      };
      NAME_CACHE.set(uid, r);
      return r;
    }
  } catch { /* fall through */ }
  const fallback = { name: uid, email: null };
  NAME_CACHE.set(uid, fallback);
  return fallback;
}

export default function AdminApplicationsPage() {
  const [tab, setTab] = useState<typeof TABS[number]['id']>('pending');
  const [rows, setRows] = useState<AppDoc[]>([]);
  const [counts, setCounts] = useState<{ pending: number; approved: number; rejected: number }>({
    pending: 0, approved: 0, rejected: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);
  const [rejectFor, setRejectFor] = useState<AppDoc | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  /* Three count subscriptions — one per status. Kept separate from
     the main `rows` query because the tab counts need to be visible
     even when looking at a different tab. */
  useEffect(() => {
    if (!db) return;
    const subs: Array<() => void> = [];
    for (const status of ['pending', 'approved', 'rejected'] as const) {
      const q = query(collection(db, 'applications'), where('status', '==', status), limit(50));
      subs.push(onSnapshot(q,
        snap => setCounts(c => ({ ...c, [status]: snap.size })),
        () => { /* silent */ },
      ));
    }
    return () => { for (const u of subs) u(); };
  }, []);

  /* Active-tab live list. */
  useEffect(() => {
    if (!db) { setLoading(false); return; }
    setLoading(true); setError(null);
    const q = query(
      collection(db, 'applications'),
      where('status', '==', tab),
      orderBy('createdAt', 'desc'),
      limit(50),
    );
    const unsub = onSnapshot(q, async snap => {
      const raw: AppDoc[] = snap.docs.map(d => {
        const x = d.data() as Record<string, unknown>;
        return {
          id: d.id,
          userId:       String(x.userId ?? ''),
          trade:        String(x.trade ?? ''),
          experience:   Number(x.experience ?? 0),
          ninNumber:    String(x.ninNumber ?? ''),
          bio:          typeof x.bio === 'string' ? x.bio : undefined,
          documents:    Array.isArray(x.documents) ? x.documents as string[] : [],
          status:       (x.status as AppDoc['status']) ?? 'pending',
          createdAt:    (x.createdAt as { seconds: number } | null) ?? null,
          reviewedAt:   (x.reviewedAt as { seconds: number } | null) ?? null,
          rejectReason: (x.rejectReason as string | null) ?? null,
        };
      });
      const hydrated = await Promise.all(raw.map(async r => {
        const u = await hydrateUser(r.userId);
        return { ...r, userName: u.name, userEmail: u.email ?? undefined };
      }));
      setRows(hydrated);
      setLoading(false);
    }, err => {
      console.error('applications snapshot', err);
      setError('Impossible de charger les candidatures');
      setLoading(false);
    });
    return unsub;
  }, [tab]);

  const approve = async (r: AppDoc) => {
    if (!confirm(`Approuver la candidature de ${r.userName} ? L'utilisateur deviendra artisan vérifié.`)) return;
    setActing(r.id);
    try {
      const res = await fetch('/api/admin/applications/approve', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ applicationId: r.id }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast('❌ ' + (j.message ?? 'Erreur'));
      } else {
        toast('✅ Candidature approuvée');
      }
    } catch {
      toast('❌ Erreur réseau');
    } finally {
      setActing(null);
    }
  };

  const performReject = async () => {
    if (!rejectFor) return;
    if (rejectReason.trim().length < 5) {
      toast('⚠️ La raison doit faire au moins 5 caractères');
      return;
    }
    setActing(rejectFor.id);
    try {
      const res = await fetch('/api/admin/applications/reject', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ applicationId: rejectFor.id, reason: rejectReason.trim() }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast('❌ ' + (j.message ?? 'Erreur'));
      } else {
        toast('Candidature rejetée');
        setRejectFor(null);
        setRejectReason('');
      }
    } catch {
      toast('❌ Erreur réseau');
    } finally {
      setActing(null);
    }
  };

  return (
    <div className="page on" id="page-applications">
      <div className="page-header au">
        <div>
          <div className="page-h1">🔧 Candidatures Artisans</div>
          <div className="page-sub">
            {counts.pending} en attente · {counts.approved} approuvées · {counts.rejected} rejetées
          </div>
        </div>
      </div>

      <div className="tab-group-bar au1">
        {TABS.map(t => (
          <button
            key={t.id}
            className={tab === t.id ? 'tgb-btn on' : 'tgb-btn'}
            onClick={() => setTab(t.id)}
          >
            {t.label} ({counts[t.id]})
          </button>
        ))}
      </div>

      <div className="card au2" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)' }}>Chargement…</div>
        ) : error ? (
          <div style={{ padding: 32, textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: 8 }}>⚠️</div>
            <div style={{ color: 'var(--rd)', fontSize: '.88rem', marginBottom: 12 }}>{error}</div>
            <button className="btn-outline sm" onClick={() => setTab(t => t)}>Réessayer</button>
          </div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>
            <div style={{ fontSize: '2.4rem', marginBottom: 8 }}>📭</div>
            <div style={{ fontSize: '.9rem', color: 'var(--text2)', fontWeight: 600 }}>
              Aucune candidature dans cet onglet
            </div>
          </div>
        ) : (
          rows.map(r => (
            <div
              key={r.id}
              style={{
                display: 'flex', gap: 14, padding: 14,
                borderBottom: '1px solid var(--border)',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: '.94rem', color: 'var(--text)' }}>
                    {r.userName}
                  </span>
                  {r.userEmail && (
                    <span style={{ fontSize: '.74rem', color: 'var(--text3)' }}>· {r.userEmail}</span>
                  )}
                  <span style={{ fontSize: '.72rem', color: 'var(--text3)' }}>· {fmt(r.createdAt?.seconds)}</span>
                </div>
                <div style={{ fontSize: '.84rem', color: 'var(--text)', marginTop: 4 }}>
                  <strong>{r.trade}</strong> — {r.experience} an{r.experience !== 1 ? 's' : ''} d&apos;expérience
                </div>
                <div style={{ fontSize: '.76rem', color: 'var(--text2)', marginTop: 2, fontFamily: 'monospace' }}>
                  NIN: {r.ninNumber.replace(/(\d{4})(?=\d)/g, '$1 ')}
                </div>
                {r.bio && (
                  <div style={{ fontSize: '.82rem', color: 'var(--text2)', marginTop: 4, lineHeight: 1.5 }}>
                    {r.bio}
                  </div>
                )}
                <div style={{ fontSize: '.74rem', color: 'var(--text3)', marginTop: 6 }}>
                  📎 {r.documents.length} document{r.documents.length !== 1 ? 's' : ''} :
                  {r.documents.map((d, i) => (
                    <code key={i} style={{ fontSize: '.72rem', marginLeft: 4, padding: '1px 4px', background: 'var(--surface2)', borderRadius: 3 }}>
                      {d}
                    </code>
                  ))}
                </div>
                {r.rejectReason && tab === 'rejected' && (
                  <div style={{ fontSize: '.78rem', color: 'var(--rd)', marginTop: 6, fontStyle: 'italic' }}>
                    ✗ {r.rejectReason}
                  </div>
                )}
                {r.reviewedAt && tab !== 'pending' && (
                  <div style={{ fontSize: '.72rem', color: 'var(--text3)', marginTop: 4 }}>
                    Examiné: {fmt(r.reviewedAt.seconds)}
                  </div>
                )}
              </div>
              {tab === 'pending' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 130 }}>
                  <button
                    className="btn-primary sm"
                    onClick={() => approve(r)}
                    disabled={acting === r.id}
                    style={{ justifyContent: 'center', background: 'var(--gn)' }}
                  >
                    ✅ Approuver
                  </button>
                  <button
                    className="btn-outline sm"
                    onClick={() => setRejectFor(r)}
                    disabled={acting === r.id}
                    style={{ justifyContent: 'center', borderColor: 'var(--rd)', color: 'var(--rd)' }}
                  >
                    Rejeter
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {rejectFor && (
        <div
          className="modal-bg on"
          onClick={e => { if (e.target === e.currentTarget) { setRejectFor(null); setRejectReason(''); } }}
        >
          <div className="modal-box" style={{ maxWidth: 440, padding: 22 }}>
            <div className="modal-header">
              <div className="modal-title">Rejeter la candidature</div>
              <button className="modal-close" onClick={() => { setRejectFor(null); setRejectReason(''); }} aria-label="Fermer">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div style={{ fontSize: '.85rem', color: 'var(--text2)', marginBottom: 12 }}>
              Rejet de la candidature de <strong>{rejectFor.userName}</strong> ({rejectFor.trade}).
              L&apos;utilisateur sera notifié.
            </div>
            <label style={{ display: 'block', fontSize: '.76rem', fontWeight: 600, marginBottom: 4 }}>
              Raison du rejet <span style={{ color: 'var(--rd)' }}>*</span>
            </label>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value.slice(0, 500))}
              rows={4}
              maxLength={500}
              placeholder="Ex. NIN illisible — merci de soumettre une copie plus claire"
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
                onClick={() => { setRejectFor(null); setRejectReason(''); }}
                disabled={acting === rejectFor.id}
                style={{ flex: 1, justifyContent: 'center' }}
              >
                Annuler
              </button>
              <button
                className="btn-primary"
                onClick={performReject}
                disabled={acting === rejectFor.id || rejectReason.trim().length < 5}
                style={{ flex: 2, justifyContent: 'center', background: 'var(--rd)' }}
              >
                Confirmer le rejet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
