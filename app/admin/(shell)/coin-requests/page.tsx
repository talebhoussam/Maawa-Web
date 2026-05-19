'use client';

import { useEffect, useState } from 'react';
import { toast } from '@/lib/toast';
import { useT } from '@/lib/useT';
import { db } from '@/lib/firebase';
import {
  collection, onSnapshot, orderBy, query, where, doc, getDoc, limit,
} from 'firebase/firestore';

/**
 * Admin: Coin purchase requests review.
 *
 * Reads `coin_purchase_requests` live (Firestore onSnapshot), grouped
 * by status (pending / approved / rejected). Pending requests get
 * Approve + Reject action buttons; approved / rejected rows are
 * read-only history.
 *
 * The user displayName for each request row is fetched once on hydration
 * via a small `users/{uid}` lookup cache. Misses (deleted users) fall
 * back to the userId itself.
 *
 * Approve / Reject open native confirm-style modal flows rendered
 * inline in this page (own React state, not the global modal layer
 * which is DOM-id driven). Cleaner for new admin pages.
 */

type Status = 'pending' | 'approved' | 'rejected';
type Method = 'ccp' | 'baridimob' | 'cash_office';

interface Req {
  id: string;
  userId: string;
  userName?: string;
  amountMC: number;
  amountDZD: number;
  paymentMethod: Method;
  proofUrl: string | null;
  reference: string | null;
  status: Status;
  createdAt?: { seconds: number } | null;
  reviewedAt?: { seconds: number } | null;
  reviewedBy?: string | null;
  reviewNote?: string | null;
}

function fmtDate(seconds?: number): string {
  if (!seconds) return '—';
  return new Date(seconds * 1000).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default function AdminCoinRequestsPage() {
  /* Recharge strings live in the platform table — `useT('platform')`
     keeps them all in one place rather than duplicating into the admin
     translation table. */
  const tp = useT('platform');
  const [tab, setTab] = useState<Status>('pending');
  const [items, setItems] = useState<Record<Status, Req[]>>({
    pending: [], approved: [], rejected: [],
  });
  const [loading, setLoading] = useState(true);

  /* Cache user displayName lookups so we don't re-fetch on every snapshot. */
  const [userCache] = useState<Map<string, string>>(() => new Map());

  /* Approve / Reject UI state */
  const [approveTarget, setApproveTarget] = useState<Req | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Req | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [busy, setBusy] = useState(false);

  /* Proof lightbox */
  const [proofUrl, setProofUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!db) { setLoading(false); return; }
    const q = query(
      collection(db, 'coin_purchase_requests'),
      orderBy('createdAt', 'desc'),
      limit(200),
    );
    const unsub = onSnapshot(q, async snap => {
      const buckets: Record<Status, Req[]> = { pending: [], approved: [], rejected: [] };
      const raw: Req[] = snap.docs.map(d => {
        const x = d.data() as Record<string, unknown>;
        return {
          id: d.id,
          userId: String(x.userId ?? ''),
          amountMC:      Number(x.amountMC ?? 0),
          amountDZD:     Number(x.amountDZD ?? 0),
          paymentMethod: (x.paymentMethod as Method) ?? 'ccp',
          proofUrl:      (x.proofUrl as string | null) ?? null,
          reference:     (x.reference as string | null) ?? null,
          status:        (x.status as Status) ?? 'pending',
          createdAt:     (x.createdAt as { seconds: number } | null) ?? null,
          reviewedAt:    (x.reviewedAt as { seconds: number } | null) ?? null,
          reviewedBy:    (x.reviewedBy as string | null) ?? null,
          reviewNote:    (x.reviewNote as string | null) ?? null,
        };
      });
      /* Hydrate user names (cached). Done in parallel; misses → use uid. */
      const unknownUids = Array.from(new Set(raw.map(r => r.userId).filter(uid => uid && !userCache.has(uid))));
      await Promise.all(unknownUids.map(async (uid) => {
        try {
          const snap = await getDoc(doc(db, 'users', uid));
          if (snap.exists()) {
            const d = snap.data() as Record<string, unknown>;
            userCache.set(uid, String(d.displayName ?? uid));
          } else {
            userCache.set(uid, uid);
          }
        } catch {
          userCache.set(uid, uid);
        }
      }));
      for (const r of raw) {
        r.userName = userCache.get(r.userId) ?? r.userId;
        buckets[r.status].push(r);
      }
      setItems(buckets);
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [userCache]);

  const methodLabel: Record<Method, string> = {
    ccp:         tp('rch_method_ccp'),
    baridimob:   tp('rch_method_baridi'),
    cash_office: tp('rch_method_cash'),
  };

  /* ── Approve flow ── */
  const onApprove = async () => {
    if (!approveTarget) return;
    setBusy(true);
    try {
      const res = await fetch('/api/admin/wallet/approve-request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ requestId: approveTarget.id }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast('❌ ' + (data.message || 'Erreur'));
      } else {
        toast('✅ Demande approuvée');
        setApproveTarget(null);
      }
    } catch {
      toast('❌ Erreur réseau');
    } finally {
      setBusy(false);
    }
  };

  /* ── Reject flow ── */
  const onReject = async () => {
    if (!rejectTarget) return;
    if (rejectReason.trim().length < 3) {
      toast('⚠️ Motif trop court');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/admin/wallet/reject-request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ requestId: rejectTarget.id, reason: rejectReason.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast('❌ ' + (data.message || 'Erreur'));
      } else {
        toast('✅ Demande refusée');
        setRejectTarget(null);
        setRejectReason('');
      }
    } catch {
      toast('❌ Erreur réseau');
    } finally {
      setBusy(false);
    }
  };

  /* ── Open proof in lightbox via signed URL ── */
  const openProof = async (path: string) => {
    try {
      const res = await fetch(`/api/admin/wallet/proof-url?path=${encodeURIComponent(path)}`);
      if (!res.ok) { toast('❌ Erreur'); return; }
      const data = await res.json();
      setProofUrl(data.url);
    } catch {
      toast('❌ Erreur réseau');
    }
  };

  const visible = items[tab];

  return (
    <div className="page on" id="page-coin-requests">
      <div className="page-header au">
        <div>
          <div className="page-h1">{tp('rch_admin_title')}</div>
          <div className="page-sub">{tp('rch_admin_sub')}</div>
        </div>
      </div>

      <div className="tab-group-bar au1">
        <button className={tab === 'pending' ? 'tgb-btn on' : 'tgb-btn'} onClick={() => setTab('pending')}>
          {tp('rch_admin_tab_pending')} ({items.pending.length})
        </button>
        <button className={tab === 'approved' ? 'tgb-btn on' : 'tgb-btn'} onClick={() => setTab('approved')}>
          {tp('rch_admin_tab_approved')} ({items.approved.length})
        </button>
        <button className={tab === 'rejected' ? 'tgb-btn on' : 'tgb-btn'} onClick={() => setTab('rejected')}>
          {tp('rch_admin_tab_rejected')} ({items.rejected.length})
        </button>
      </div>

      <div className="card au2">
        <div className="card-body" style={{ padding: 0 }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>…</div>
          ) : visible.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>
              {tp('rch_admin_empty')}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {visible.map(r => (
                <div
                  key={r.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1fr) auto',
                    gap: 12,
                    padding: '14px 16px',
                    borderTop: '1px solid var(--border)',
                    alignItems: 'center',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: '.94rem', color: 'var(--text)' }}>
                      {r.userName || r.userId}{' '}
                      <span style={{ fontWeight: 400, color: 'var(--text2)', fontSize: '.82rem' }}>
                        · {r.amountMC} MC = {r.amountDZD.toLocaleString('fr-FR')} DZD
                      </span>
                    </div>
                    <div style={{ fontSize: '.76rem', color: 'var(--text2)', marginTop: 3 }}>
                      {methodLabel[r.paymentMethod]}
                      {r.reference && <> · réf. {r.reference}</>}
                      {' · '}{fmtDate(r.createdAt?.seconds)}
                    </div>
                    {r.proofUrl && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs"
                        style={{ marginTop: 6 }}
                        onClick={() => openProof(r.proofUrl!)}
                      >
                        📷 Voir le justificatif
                      </button>
                    )}
                    {r.status === 'rejected' && r.reviewNote && (
                      <div style={{ fontSize: '.74rem', color: 'var(--rd)', marginTop: 4, fontStyle: 'italic' }}>
                        {r.reviewNote}
                      </div>
                    )}
                    {r.status === 'approved' && r.reviewedAt && (
                      <div style={{ fontSize: '.72rem', color: 'var(--gn)', marginTop: 4 }}>
                        Approuvée le {fmtDate(r.reviewedAt.seconds)}
                      </div>
                    )}
                  </div>
                  {r.status === 'pending' && (
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button className="btn btn-green btn-sm" onClick={() => setApproveTarget(r)}>
                        {tp('rch_admin_approve')}
                      </button>
                      <button className="btn btn-red btn-sm" onClick={() => setRejectTarget(r)}>
                        {tp('rch_admin_reject')}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Approve confirmation */}
      {approveTarget && (
        <div className="modal-bg on" onClick={(e) => { if (e.target === e.currentTarget && !busy) setApproveTarget(null); }}>
          <div className="modal-box" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <div className="modal-title">{tp('rch_admin_confirm_approve_title')}</div>
              <button className="modal-close" onClick={() => !busy && setApproveTarget(null)}>✕</button>
            </div>
            <div style={{ fontSize: '.9rem', color: 'var(--text)', lineHeight: 1.6, marginBottom: 16 }}>
              {tp('rch_admin_confirm_approve_body', {
                mc:  approveTarget.amountMC,
                dzd: approveTarget.amountDZD.toLocaleString('fr-FR'),
              })}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" disabled={busy} onClick={() => setApproveTarget(null)}>
                {tp('rch_admin_cancel')}
              </button>
              <button className="btn btn-green" disabled={busy} onClick={onApprove}>
                {busy ? '…' : tp('rch_admin_confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject reason */}
      {rejectTarget && (
        <div className="modal-bg on" onClick={(e) => { if (e.target === e.currentTarget && !busy) { setRejectTarget(null); setRejectReason(''); } }}>
          <div className="modal-box" style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <div className="modal-title">{tp('rch_admin_reject_title')}</div>
              <button className="modal-close" onClick={() => !busy && (setRejectTarget(null), setRejectReason(''))}>✕</button>
            </div>
            <div style={{ fontSize: '.85rem', color: 'var(--text2)', marginBottom: 8 }}>
              {tp('rch_admin_reject_help')}
            </div>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder={tp('rch_admin_reject_ph')}
              maxLength={500}
              rows={4}
              style={{
                width: '100%',
                padding: 10,
                border: '1.5px solid var(--border2)',
                borderRadius: 'var(--rx)',
                background: 'var(--surface)',
                color: 'var(--text)',
                fontSize: '.88rem',
                fontFamily: 'inherit',
                resize: 'vertical',
                marginBottom: 14,
              }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" disabled={busy} onClick={() => { setRejectTarget(null); setRejectReason(''); }}>
                {tp('rch_admin_cancel')}
              </button>
              <button className="btn btn-red" disabled={busy || rejectReason.trim().length < 3} onClick={onReject}>
                {busy ? '…' : tp('rch_admin_confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Proof lightbox */}
      {proofUrl && (
        <div
          className="modal-bg on"
          onClick={() => setProofUrl(null)}
          style={{ cursor: 'zoom-out' }}
        >
          <div style={{ maxWidth: '90vw', maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={proofUrl}
              alt="Justificatif"
              style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,.4)' }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
