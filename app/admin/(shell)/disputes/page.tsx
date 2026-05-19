'use client';

import { useEffect, useState } from 'react';
import { toast } from '@/lib/toast';
import { db } from '@/lib/firebase';
import {
  collection, doc, getDoc, onSnapshot, query, where, orderBy, limit,
} from 'firebase/firestore';

const TABS = [
  { id: 'open',      label: 'Ouverts',   color: 'var(--rd)' },
  { id: 'reviewing', label: 'En cours',  color: 'var(--or)' },
  { id: 'resolved',  label: 'Résolus',   color: 'var(--gn)' },
  { id: 'dismissed', label: 'Rejetés',   color: 'var(--text3)' },
] as const;

const REASON_LABEL: Record<string, string> = {
  no_show:         'Absence',
  incomplete_work: 'Travail incomplet',
  damage:          'Dommage',
  overcharge:      'Surfacturation',
  unsafe:          'Sécurité',
  payment_issue:   'Paiement',
  other:           'Autre',
};

interface Dispute {
  id: string;
  missionId: string;
  openedBy: string;
  openedByName?: string;
  againstUid: string;
  againstName?: string;
  reason: string;
  note: string | null;
  status: 'open' | 'reviewing' | 'resolved' | 'dismissed';
  outcome?: string;
  resolution?: string | null;
  createdAt?: { seconds: number } | null;
  reviewedAt?: { seconds: number } | null;
}

function fmt(s?: number): string {
  if (!s) return '—';
  return new Date(s * 1000).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

const NAME_CACHE = new Map<string, string>();
async function hydrateName(uid: string): Promise<string> {
  if (!uid) return '—';
  if (NAME_CACHE.has(uid)) return NAME_CACHE.get(uid)!;
  try {
    if (!db) throw new Error();
    const s = await getDoc(doc(db, 'users', uid));
    if (s.exists()) {
      const n = String((s.data() as Record<string, unknown>).displayName ?? uid);
      NAME_CACHE.set(uid, n);
      return n;
    }
  } catch { /* ignore */ }
  NAME_CACHE.set(uid, uid);
  return uid;
}

export default function AdminDisputesPage() {
  const [tab, setTab] = useState<typeof TABS[number]['id']>('open');
  const [rows, setRows] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);
  const [resolveFor, setResolveFor] = useState<Dispute | null>(null);
  const [outcome, setOutcome] = useState<'dismiss' | 'favor_opener' | 'favor_against'>('dismiss');
  const [resolutionNote, setResolutionNote] = useState('');

  useEffect(() => {
    if (!db) { setLoading(false); return; }
    setLoading(true); setError(null);
    const q = query(
      collection(db, 'disputes'),
      where('status', '==', tab),
      orderBy('createdAt', 'desc'),
      limit(50),
    );
    const unsub = onSnapshot(q, async snap => {
      const raw: Dispute[] = snap.docs.map(d => {
        const x = d.data() as Record<string, unknown>;
        return {
          id: d.id,
          missionId:  String(x.missionId ?? ''),
          openedBy:   String(x.openedBy ?? ''),
          againstUid: String(x.againstUid ?? ''),
          reason:     String(x.reason ?? 'other'),
          note:       (x.note as string | null) ?? null,
          status:     (x.status as Dispute['status']) ?? 'open',
          outcome:    typeof x.outcome === 'string' ? x.outcome : undefined,
          resolution: (x.resolution as string | null) ?? null,
          createdAt:  (x.createdAt  as { seconds: number } | null) ?? null,
          reviewedAt: (x.reviewedAt as { seconds: number } | null) ?? null,
        };
      });
      const hydrated = await Promise.all(raw.map(async r => ({
        ...r,
        openedByName: await hydrateName(r.openedBy),
        againstName:  await hydrateName(r.againstUid),
      })));
      setRows(hydrated);
      setLoading(false);
    }, err => {
      console.error('disputes snapshot', err);
      setError('Impossible de charger les litiges');
      setLoading(false);
    });
    return unsub;
  }, [tab]);

  const performResolve = async () => {
    if (!resolveFor) return;
    if (resolutionNote.trim().length < 5) {
      toast('⚠️ La résolution doit faire au moins 5 caractères');
      return;
    }
    setActing(resolveFor.id);
    try {
      const res = await fetch('/api/admin/disputes/resolve', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          disputeId: resolveFor.id,
          outcome,
          resolution: resolutionNote.trim(),
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast('❌ ' + (j.message ?? 'Erreur'));
      } else {
        toast('✅ Litige traité');
        setResolveFor(null);
        setResolutionNote('');
      }
    } catch {
      toast('❌ Erreur réseau');
    } finally {
      setActing(null);
    }
  };

  return (
    <div className="page on" id="page-disputes">
      <div className="page-header au">
        <div>
          <div className="page-h1">⚖️ Litiges</div>
          <div className="page-sub">Arbitrage des conflits client–artisan</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 14, borderBottom: '1px solid var(--border)' }} className="au1">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              background: 'none', border: 'none',
              padding: '10px 16px',
              fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: '.86rem',
              color: tab === t.id ? t.color : 'var(--text2)',
              borderBottom: tab === t.id ? `2px solid ${t.color}` : '2px solid transparent',
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
        ) : error ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--rd)' }}>{error}</div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>
            <div style={{ fontSize: '2.4rem', marginBottom: 8 }}>📭</div>
            <div style={{ fontSize: '.9rem', color: 'var(--text2)', fontWeight: 600 }}>
              Aucun litige dans cet onglet
            </div>
          </div>
        ) : rows.map(r => (
          <div key={r.id} style={{
            display: 'flex', gap: 12, padding: 14,
            borderBottom: '1px solid var(--border)', alignItems: 'flex-start',
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: '.9rem', color: 'var(--text)' }}>
                  {r.openedByName}
                </span>
                <span style={{ fontSize: '.74rem', color: 'var(--text3)' }}>vs</span>
                <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: '.9rem', color: 'var(--text)' }}>
                  {r.againstName}
                </span>
                <span style={{
                  fontSize: '.66rem', fontWeight: 700,
                  background: 'var(--rl)', color: 'var(--rd)',
                  padding: '2px 8px', borderRadius: 50,
                }}>{REASON_LABEL[r.reason] ?? r.reason}</span>
                <span style={{ fontSize: '.72rem', color: 'var(--text3)' }}>· {fmt(r.createdAt?.seconds)}</span>
              </div>
              <div style={{ fontSize: '.76rem', color: 'var(--text2)', marginTop: 4, fontFamily: 'monospace' }}>
                mission: {r.missionId.slice(0, 16)}…
              </div>
              {r.note && (
                <div style={{ fontSize: '.84rem', color: 'var(--text)', marginTop: 6, fontStyle: 'italic', lineHeight: 1.5 }}>
                  &ldquo;{r.note}&rdquo;
                </div>
              )}
              {r.resolution && (tab === 'resolved' || tab === 'dismissed') && (
                <div style={{ fontSize: '.78rem', color: 'var(--gn)', marginTop: 6 }}>
                  ✓ {r.outcome === 'favor_opener'  ? 'Favorable au plaignant'
                    : r.outcome === 'favor_against' ? 'Favorable à l\'autre partie'
                    : 'Rejeté'} — {r.resolution}
                  <div style={{ fontSize: '.7rem', color: 'var(--text3)', marginTop: 2 }}>
                    Traité le {fmt(r.reviewedAt?.seconds)}
                  </div>
                </div>
              )}
            </div>
            {(tab === 'open' || tab === 'reviewing') && (
              <button
                className="btn-primary sm"
                onClick={() => { setResolveFor(r); setOutcome('dismiss'); setResolutionNote(''); }}
                disabled={acting === r.id}
                style={{ justifyContent: 'center', minWidth: 110 }}
              >
                Arbitrer
              </button>
            )}
          </div>
        ))}
      </div>

      {resolveFor && (
        <div className="modal-bg on" onClick={e => { if (e.target === e.currentTarget) setResolveFor(null); }}>
          <div className="modal-box" style={{ maxWidth: 480, padding: 22 }}>
            <div className="modal-header">
              <div className="modal-title">⚖️ Arbitrer le litige</div>
              <button className="modal-close" onClick={() => setResolveFor(null)} aria-label="Fermer">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div style={{ fontSize: '.85rem', color: 'var(--text2)', marginBottom: 12, lineHeight: 1.55 }}>
              <strong>{resolveFor.openedByName}</strong> contre <strong>{resolveFor.againstName}</strong>
              <br />
              Motif : {REASON_LABEL[resolveFor.reason] ?? resolveFor.reason}
              {resolveFor.note && (
                <div style={{ marginTop: 6, fontStyle: 'italic', color: 'var(--text)' }}>
                  &ldquo;{resolveFor.note}&rdquo;
                </div>
              )}
            </div>

            <label style={{ display: 'block', fontSize: '.76rem', fontWeight: 600, marginBottom: 4 }}>
              Décision
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
              {([
                { id: 'dismiss',       label: '🚫 Rejeter — pas de fondement' },
                { id: 'favor_opener',  label: `✓ Favorable à ${resolveFor.openedByName}` },
                { id: 'favor_against', label: `✓ Favorable à ${resolveFor.againstName}` },
              ] as const).map(o => (
                <label key={o.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 10px',
                  background: outcome === o.id ? 'var(--b50)' : 'var(--surface)',
                  border: `1px solid ${outcome === o.id ? 'var(--b300)' : 'var(--border)'}`,
                  borderRadius: 'var(--rx)',
                  cursor: 'pointer',
                  fontSize: '.84rem',
                  color: 'var(--text)',
                }}>
                  <input
                    type="radio"
                    name="outcome"
                    checked={outcome === o.id}
                    onChange={() => setOutcome(o.id)}
                    style={{ accentColor: 'var(--b500)' }}
                  />
                  {o.label}
                </label>
              ))}
            </div>

            <label style={{ display: 'block', fontSize: '.76rem', fontWeight: 600, marginBottom: 4 }}>
              Détails / justification <span style={{ color: 'var(--rd)' }}>*</span>
            </label>
            <textarea
              value={resolutionNote}
              onChange={e => setResolutionNote(e.target.value.slice(0, 1000))}
              rows={4}
              maxLength={1000}
              placeholder="Décrivez la décision et les actions demandées (remboursement off-platform, rappel SLA, etc.)"
              style={{
                width: '100%', padding: 9,
                border: '1.5px solid var(--border2)', borderRadius: 'var(--rx)',
                background: 'var(--surface)', color: 'var(--text)',
                fontSize: '.85rem', fontFamily: 'inherit', resize: 'vertical',
              }}
            />

            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button className="btn-outline" onClick={() => setResolveFor(null)} disabled={acting === resolveFor.id} style={{ flex: 1, justifyContent: 'center' }}>
                Annuler
              </button>
              <button
                className="btn-primary"
                onClick={performResolve}
                disabled={acting === resolveFor.id || resolutionNote.trim().length < 5}
                style={{ flex: 2, justifyContent: 'center' }}
              >
                Confirmer l&apos;arbitrage
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
