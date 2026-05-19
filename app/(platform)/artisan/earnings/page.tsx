'use client';

import { useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, doc, onSnapshot, query, where, orderBy, limit } from 'firebase/firestore';
import { useMaawa } from '@/lib/store';
import { toast } from '@/lib/toast';

/**
 * Artisan earnings.
 *
 * Thin wrapper over the existing wallet pattern but the headline is
 * `payableBalance` (DZD, server-controlled — credited when the
 * client's SafePay funds clear and the mission completes) instead of
 * `maawaCoinBalance`.
 *
 * Three sections:
 *   - Hero: payableBalance with "Demander un retrait" button (route
 *     opens the existing recharge-modal id placeholder for now — the
 *     real withdraw flow lives in a later phase).
 *   - Payouts requested: rows from `payout_requests where userId == uid`
 *     ordered by createdAt desc. Status badges as in /wallet's
 *     "Mes demandes".
 *   - Recent earnings: rows from `transactions where userId == uid
 *     && kind == 'mission_payout'`.
 *
 * Read-only; mutations live elsewhere.
 */

interface PayoutRequest {
  id: string;
  amountDZD: number;
  status: 'pending' | 'approved' | 'rejected';
  createdAt?: { seconds: number } | null;
  reviewNote?: string | null;
}

interface EarningTxn {
  id: string;
  amount: number;
  kind?: string;
  missionId?: string | null;
  createdAt?: { seconds: number } | null;
}

function fmtDate(seconds?: number): string {
  if (!seconds) return '—';
  return new Date(seconds * 1000).toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

export default function ArtisanEarningsPage() {
  const { user } = useMaawa();
  const [uid, setUid] = useState<string | null>(null);
  const [profileBalance, setProfileBalance] = useState<number | null>(null);
  const [requests, setRequests] = useState<PayoutRequest[]>([]);
  const [earnings, setEarnings] = useState<EarningTxn[]>([]);
  const [loading, setLoading] = useState(true);

  /* Withdraw modal state. Inline because it's a single-purpose form
     with three fields — not worth lifting into a shared component. */
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [wAmount, setWAmount] = useState(1000);
  const [wMethod, setWMethod] = useState<'ccp' | 'baridimob' | 'cash_pickup'>('ccp');
  const [wInfo, setWInfo] = useState('');
  const [wError, setWError] = useState('');
  const [wSubmitting, setWSubmitting] = useState(false);

  const submitWithdraw = async () => {
    setWError('');
    if (wAmount < 1000) {
      setWError('Le montant minimum est de 1 000 DZD.');
      return;
    }
    if (wInfo.trim().length < 3) {
      setWError('Veuillez préciser vos coordonnées de paiement.');
      return;
    }
    setWSubmitting(true);
    try {
      const res = await fetch('/api/wallet/payout-request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          amountDZD:   wAmount,
          method:      wMethod,
          accountInfo: wInfo.trim(),
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setWError(j.message ?? 'Erreur');
        return;
      }
      toast('📨 Demande de retrait envoyée');
      setWithdrawOpen(false);
      setWAmount(1000);
      setWInfo('');
      setWError('');
    } catch {
      setWError('Erreur réseau');
    } finally {
      setWSubmitting(false);
    }
  };

  useEffect(() => onAuthStateChanged(auth, u => setUid(u?.uid ?? null)), []);

  /* Live user-doc snapshot for payableBalance (the rule allows owner
     to read their own users/{uid} doc). */
  useEffect(() => {
    if (!uid || !db) return;
    const unsub = onSnapshot(doc(db, 'users', uid), snap => {
      const data = snap.data() as Record<string, unknown> | undefined;
      const v = data?.payableBalance;
      setProfileBalance(typeof v === 'number' ? v : 0);
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [uid]);

  /* Payout requests (admin-reviewed off-platform via a future
     /admin/payouts page; here we just show the user's own queue). */
  useEffect(() => {
    if (!uid || !db) return;
    const q = query(
      collection(db, 'payout_requests'),
      where('userId', '==', uid),
      orderBy('createdAt', 'desc'),
      limit(20),
    );
    const unsub = onSnapshot(q, snap => {
      setRequests(snap.docs.map(d => {
        const x = d.data() as Record<string, unknown>;
        return {
          id:         d.id,
          amountDZD:  Number(x.amountDZD ?? 0),
          status:     (x.status as PayoutRequest['status']) ?? 'pending',
          createdAt:  (x.createdAt as { seconds: number } | null) ?? null,
          reviewNote: (x.reviewNote as string | null) ?? null,
        };
      }));
    }, () => { /* collection may not exist yet — silent */ });
    return unsub;
  }, [uid]);

  /* Recent mission-payout transactions. */
  useEffect(() => {
    if (!uid || !db) return;
    const q = query(
      collection(db, 'transactions'),
      where('userId', '==', uid),
      where('kind', '==', 'mission_payout'),
      orderBy('createdAt', 'desc'),
      limit(10),
    );
    const unsub = onSnapshot(q, snap => {
      setEarnings(snap.docs.map(d => {
        const x = d.data() as Record<string, unknown>;
        return {
          id:        d.id,
          amount:    Number(x.amount ?? 0),
          kind:      typeof x.kind === 'string' ? x.kind : undefined,
          missionId: typeof x.missionId === 'string' ? x.missionId : null,
          createdAt: (x.createdAt as { seconds: number } | null) ?? null,
        };
      }));
    }, () => { /* silent — collection optional */ });
    return unsub;
  }, [uid]);

  const balance = profileBalance ?? 0;

  return (
    <div className="screen on" id="s-artisan-earnings">
      <div className="page-title-row au">
        <div>
          <div className="pt-head">💰 Mes revenus</div>
          <div className="pt-sub">Solde, retraits, et historique de paiements</div>
        </div>
      </div>

      {/* Hero — payable balance */}
      <div className="wallet-hero au1">
        <div className="wh-label">Solde payable (DZD)</div>
        <div className="wh-balance">
          <span>{loading ? '…' : balance.toLocaleString('fr-FR')}</span>
          <span className="wh-sym">DZD</span>
        </div>
        <div className="wh-sub">
          {user?.displayName ?? 'Artisan Maawa'} · payé via SafePay
        </div>
        <div className="wh-actions">
          <button
            className="wbtn wbtn-w"
            onClick={() => setWithdrawOpen(true)}
            disabled={balance < 1000}
            title={balance < 1000 ? 'Solde insuffisant (min 1 000 DZD)' : 'Demander un retrait'}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 5v14M5 12l7 7 7-7" />
            </svg>
            <span>Demander un retrait</span>
          </button>
        </div>
      </div>

      {/* Payout requests */}
      <div className="wpanel au2" style={{ marginTop: 14 }}>
        <div className="wp-title">
          <span>📨</span>
          <span>Demandes de retrait</span>
        </div>
        {requests.length === 0 ? (
          <div style={{ padding: 16, textAlign: 'center', color: 'var(--text3)', fontSize: '.85rem' }}>
            Aucune demande pour le moment.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {requests.map(r => {
              const colors: Record<PayoutRequest['status'], { bg: string; fg: string; lbl: string }> = {
                pending:  { bg: 'var(--ol)', fg: 'var(--or)', lbl: 'En attente' },
                approved: { bg: 'var(--gl)', fg: 'var(--gn)', lbl: 'Approuvée'  },
                rejected: { bg: 'var(--rl)', fg: 'var(--rd)', lbl: 'Refusée'    },
              };
              const c = colors[r.status];
              return (
                <div key={r.id} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '10px 12px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--rx)',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: '.9rem' }}>
                      {r.amountDZD.toLocaleString('fr-FR')} DZD
                    </div>
                    <div style={{ fontSize: '.74rem', color: 'var(--text2)', marginTop: 2 }}>
                      {fmtDate(r.createdAt?.seconds)}
                    </div>
                    {r.status === 'rejected' && r.reviewNote && (
                      <div style={{ fontSize: '.74rem', color: 'var(--rd)', marginTop: 4, fontStyle: 'italic' }}>
                        {r.reviewNote}
                      </div>
                    )}
                  </div>
                  <span style={{
                    background: c.bg, color: c.fg,
                    fontSize: '.7rem', fontWeight: 700,
                    padding: '4px 10px', borderRadius: 50,
                  }}>
                    {c.lbl}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent earnings */}
      <div className="wpanel au3" style={{ marginTop: 14 }}>
        <div className="wp-title">
          <span>📋</span>
          <span>Paiements récents</span>
        </div>
        {earnings.length === 0 ? (
          <div style={{ padding: 16, textAlign: 'center', color: 'var(--text3)', fontSize: '.85rem' }}>
            Aucun paiement reçu pour le moment.
          </div>
        ) : (
          earnings.map(e => (
            <div key={e.id} className="tx-item">
              <div className="txi-icon" style={{ background: 'var(--gl)' }}>↓</div>
              <div style={{ flex: 1 }}>
                <div className="txi-label">
                  Paiement {e.missionId ? `mission ${e.missionId.slice(0, 8)}…` : ''}
                </div>
                <div className="txi-date">{fmtDate(e.createdAt?.seconds)}</div>
              </div>
              <div className="txi-amount income">+{e.amount.toLocaleString('fr-FR')} DZD</div>
            </div>
          ))
        )}
      </div>

      {/* Withdraw request modal */}
      {withdrawOpen && (
        <div
          className="modal-bg on"
          onClick={e => { if (e.target === e.currentTarget) setWithdrawOpen(false); }}
        >
          <div className="modal-box" style={{ maxWidth: 440, padding: 22 }}>
            <div className="modal-header">
              <div className="modal-title">💸 Demande de retrait</div>
              <button className="modal-close" onClick={() => setWithdrawOpen(false)} aria-label="Fermer">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div style={{ fontSize: '.82rem', color: 'var(--text2)', marginBottom: 12 }}>
              Solde disponible : <strong style={{ color: 'var(--text)' }}>{balance.toLocaleString('fr-FR')} DZD</strong>
            </div>

            <label style={{ display: 'block', fontSize: '.76rem', fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
              Montant à retirer (DZD)
            </label>
            <input
              type="number"
              min={1000}
              max={Math.min(balance, 1_000_000)}
              step={100}
              value={wAmount}
              onChange={e => setWAmount(Math.max(1000, Math.min(1_000_000, Number(e.target.value) || 0)))}
              disabled={wSubmitting}
              style={{
                width: '100%', padding: 9,
                border: '1.5px solid var(--border2)', borderRadius: 'var(--rx)',
                background: 'var(--surface)', color: 'var(--text)',
                fontSize: '.88rem', marginBottom: 12,
              }}
            />

            <label style={{ display: 'block', fontSize: '.76rem', fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
              Méthode de paiement
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
              {([
                { id: 'ccp',         label: '🏦 CCP — Compte chèques postaux' },
                { id: 'baridimob',   label: '📱 Baridimob' },
                { id: 'cash_pickup', label: '💵 Retrait en espèces au bureau' },
              ] as const).map(opt => (
                <label
                  key={opt.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 10px',
                    background: wMethod === opt.id ? 'var(--b50)' : 'var(--surface)',
                    border: `1px solid ${wMethod === opt.id ? 'var(--b300)' : 'var(--border)'}`,
                    borderRadius: 'var(--rx)',
                    cursor: 'pointer',
                    fontSize: '.84rem',
                    color: 'var(--text)',
                  }}
                >
                  <input
                    type="radio"
                    name="w-method"
                    checked={wMethod === opt.id}
                    onChange={() => setWMethod(opt.id)}
                    style={{ accentColor: 'var(--b500)' }}
                  />
                  {opt.label}
                </label>
              ))}
            </div>

            <label style={{ display: 'block', fontSize: '.76rem', fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
              {wMethod === 'ccp' ? 'Numéro CCP'
                : wMethod === 'baridimob' ? 'Numéro Baridimob'
                : 'Disponibilités pour le retrait'}
            </label>
            <input
              type="text"
              value={wInfo}
              onChange={e => setWInfo(e.target.value.slice(0, 200))}
              placeholder={wMethod === 'ccp' ? 'Ex. 1234567890 clé 12'
                : wMethod === 'baridimob' ? '+213 6X XX XX XX XX'
                : 'Ex. Lundi-vendredi 9h-17h'}
              disabled={wSubmitting}
              maxLength={200}
              style={{
                width: '100%', padding: 9,
                border: '1.5px solid var(--border2)', borderRadius: 'var(--rx)',
                background: 'var(--surface)', color: 'var(--text)',
                fontSize: '.86rem', marginBottom: 12,
              }}
            />

            {wError && (
              <div className="pf-error-banner" role="alert" style={{ marginBottom: 12 }}>
                {wError}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn-outline"
                onClick={() => setWithdrawOpen(false)}
                disabled={wSubmitting}
                style={{ flex: 1, justifyContent: 'center' }}
              >
                Annuler
              </button>
              <button
                className="btn-primary"
                onClick={submitWithdraw}
                disabled={wSubmitting || wAmount < 1000 || wInfo.trim().length < 3}
                style={{ flex: 2, justifyContent: 'center' }}
              >
                {wSubmitting ? 'Envoi…' : 'Envoyer la demande'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
