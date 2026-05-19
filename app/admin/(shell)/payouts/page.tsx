'use client';

import { useEffect, useState } from 'react';
import { toast } from '@/lib/toast';
import { db } from '@/lib/firebase';
import {
  collection, doc, getDoc, onSnapshot, query, where, orderBy, limit,
} from 'firebase/firestore';

/**
 * Admin payouts inbox.
 *
 * Mirrors /admin/coin-requests — same three-tab shape. Pending tab
 * has Approve / Reject buttons. Approved + Rejected tabs are
 * read-only.
 */

const TABS = [
  { id: 'pending',  label: 'En attente', color: 'var(--or)' },
  { id: 'approved', label: 'Approuvés',  color: 'var(--gn)' },
  { id: 'rejected', label: 'Refusés',    color: 'var(--rd)' },
] as const;

interface PayoutRequest {
  id: string;
  userId: string;
  userName?: string;
  amountDZD: number;
  method: 'ccp' | 'baridimob' | 'cash_pickup';
  accountInfo: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt?: { seconds: number } | null;
  reviewedAt?: { seconds: number } | null;
  reviewNote?: string | null;
}

const METHOD_LABEL: Record<string, string> = {
  ccp:         '🏦 CCP',
  baridimob:   '📱 Baridimob',
  cash_pickup: '💵 Bureau',
};

function fmt(seconds?: number): string {
  if (!seconds) return '—';
  return new Date(seconds * 1000).toLocaleString('fr-FR', {
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
      const name = String((s.data() as Record<string, unknown>).displayName ?? uid);
      NAME_CACHE.set(uid, name);
      return name;
    }
  } catch { /* fall through */ }
  NAME_CACHE.set(uid, uid);
  return uid;
}

export default function AdminPayoutsPage() {
  const [tab, setTab] = useState<typeof TABS[number]['id']>('pending');
  const [rows, setRows] = useState<PayoutRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);
  const [rejectFor, setRejectFor] = useState<PayoutRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    if (!db) { setLoading(false); return; }
    setLoading(true); setError(null);
    const q = query(
      collection(db, 'payout_requests'),
      where('status', '==', tab),
      orderBy('createdAt', 'desc'),
      limit(50),
    );
    const unsub = onSnapshot(q, async snap => {
      const raw: PayoutRequest[] = snap.docs.map(d => {
        const x = d.data() as Record<string, unknown>;
        return {
          id: d.id,
          userId:      String(x.userId ?? ''),
          amountDZD:   Number(x.amountDZD ?? 0),
          method:      (x.method as PayoutRequest['method']) ?? 'ccp',
          accountInfo: String(x.accountInfo ?? ''),
          status:      (x.status as PayoutRequest['status']) ?? 'pending',
          createdAt:   (x.createdAt as { seconds: number } | null) ?? null,
          reviewedAt:  (x.reviewedAt as { seconds: number } | null) ?? null,
          reviewNote:  (x.reviewNote as string | null) ?? null,
        };
      });
      const hydrated = await Promise.all(raw.map(async r => ({
        ...r, userName: r.userId ? await hydrateName(r.userId) : '—',
      })));
      setRows(hydrated);
      setLoading(false);
    }, err => {
      console.error('payouts snapshot', err);
      setError('Impossible de charger les demandes');
      setLoading(false);
    });
    return unsub;
  }, [tab]);

  const approve = async (r: PayoutRequest) => {
    if (!confirm(`Approuver le retrait de ${r.amountDZD.toLocaleString('fr-FR')} DZD pour ${r.userName} ? Le solde sera débité.`)) return;
    setActing(r.id);
    try {
      const res = await fetch('/api/admin/wallet/approve-payout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ requestId: r.id }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast('❌ ' + (j.message ?? 'Erreur'));
      } else {
        toast('✅ Retrait approuvé');
      }
    } catch {
      toast('❌ Erreur réseau');
    } finally {
      setActing(null);
    }
  };

  const performReject = async () => {
    if (!rejectFor) return;
    if (rejectReason.trim().length < 3) {
      toast('⚠️ La raison doit faire au moins 3 caractères');
      return;
    }
    setActing(rejectFor.id);
    try {
      const res = await fetch('/api/admin/wallet/reject-payout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ requestId: rejectFor.id, reason: rejectReason.trim() }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast('❌ ' + (j.message ?? 'Erreur'));
      } else {
        toast('Demande refusée');
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
    <div className="page on" id="page-payouts">
      <div className="page-header au">
        <div>
          <div className="page-h1">💸 Demandes de retrait</div>
          <div className="page-sub">Approuver ou refuser les retraits artisans</div>
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
          <div style={{ padding: 32, textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: 8 }}>⚠️</div>
            <div style={{ color: 'var(--rd)', fontSize: '.88rem', marginBottom: 12 }}>{error}</div>
            <button className="btn-outline sm" onClick={() => setTab(t => t)}>Réessayer</button>
          </div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>
            <div style={{ fontSize: '2.4rem', marginBottom: 8 }}>📭</div>
            <div style={{ fontSize: '.9rem', color: 'var(--text2)', fontWeight: 600 }}>
              Aucune demande dans cet onglet
            </div>
          </div>
        ) : (
          rows.map(r => (
            <div
              key={r.id}
              style={{
                display: 'flex', gap: 12, alignItems: 'flex-start',
                padding: 14, borderBottom: '1px solid var(--border)',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: '.92rem', color: 'var(--text)' }}>
                    {r.userName}
                  </span>
                  <span style={{
                    fontSize: '.82rem', fontWeight: 700, color: 'var(--b600)',
                    background: 'var(--b50)', padding: '2px 8px', borderRadius: 50,
                  }}>
                    {r.amountDZD.toLocaleString('fr-FR')} DZD
                  </span>
                  <span style={{ fontSize: '.72rem', color: 'var(--text3)' }}>
                    · {fmt(r.createdAt?.seconds)}
                  </span>
                </div>
                <div style={{ fontSize: '.78rem', color: 'var(--text2)', marginTop: 4 }}>
                  {METHOD_LABEL[r.method] ?? r.method} — <code style={{ fontSize: '.78rem' }}>{r.accountInfo}</code>
                </div>
                {r.reviewNote && (
                  <div style={{ fontSize: '.74rem', color: r.status === 'approved' ? 'var(--gn)' : 'var(--rd)', marginTop: 4, fontStyle: 'italic' }}>
                    {r.status === 'approved' ? '✓ ' : '✗ '}{r.reviewNote}
                  </div>
                )}
              </div>
              {r.status === 'pending' && (
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
                    Refuser
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
              <div className="modal-title">Refuser la demande</div>
              <button className="modal-close" onClick={() => { setRejectFor(null); setRejectReason(''); }} aria-label="Fermer">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div style={{ fontSize: '.85rem', color: 'var(--text2)', marginBottom: 12 }}>
              Refus de {rejectFor.amountDZD.toLocaleString('fr-FR')} DZD pour <strong>{rejectFor.userName}</strong>.
            </div>
            <label style={{ display: 'block', fontSize: '.76rem', fontWeight: 600, marginBottom: 4 }}>
              Raison <span style={{ color: 'var(--rd)' }}>*</span>
            </label>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value.slice(0, 500))}
              rows={3}
              maxLength={500}
              placeholder="Ex. Coordonnées CCP invalides"
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
                disabled={acting === rejectFor.id || rejectReason.trim().length < 3}
                style={{ flex: 2, justifyContent: 'center', background: 'var(--rd)' }}
              >
                Confirmer le refus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
