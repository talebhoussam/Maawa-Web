'use client';

import { useEffect, useState } from 'react';
import { useWallet } from '@/lib/hooks';
import { useMaawa } from '@/lib/store';
import { useT } from '@/lib/useT';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, onSnapshot, query, where, orderBy, limit } from 'firebase/firestore';

/**
 * Wallet — Maawa Coins balance and transactions.
 *
 * Real-data sources only:
 *   - balance:      users/{uid}.maawaCoinBalance  (set server-side after
 *                   admin manually credits a "demande de recharge").
 *   - transactions: transactions/* filtered by userId via useWallet().
 *
 * Removed in Phase 2 cleanup:
 *   - Hardcoded month totals (+820 / -470 / +120 MC) — there's no
 *     "this month" aggregation yet; Phase 3 will add it once the
 *     recharge-request flow writes real transaction docs.
 *   - "Maawa Rewards / Niveau Argent" card — depends on a
 *     `loyaltyLevel` field that doesn't exist on the user doc.
 *     Re-add when the loyalty system ships.
 *
 * "Dépenser vos Coins" tiles are kept as a roadmap preview, but each
 * Activer button is disabled with "Bientôt disponible" tagging — the
 * Phase 3 spend flow (server-side balance debit + audit log) hasn't
 * been wired yet, and a button that just toast()s is dishonest.
 */
export default function WalletPage() {
  const { transactions, loading } = useWallet();
  const { user } = useMaawa();

  /* Authoritative balance lives on the user doc; the transaction sum is
     only a fallback for the rare race where the user doc is stale. */
  const balance = user?.maawaCoinBalance ?? 0;
  const rateDzd = Number(process.env.NEXT_PUBLIC_MC_RATE_DZD ?? 50);

  return (
    <div className="screen on" id="s-wallet">
      <div className="pg-title au" id="t-w-title">🪙 Maawa Coin — Mon Portefeuille</div>
      <div className="pg-sub au" id="t-w-sub">1 Maawa Coin = {rateDzd} DZD · Monnaie interne sécurisée</div>

      <div className="wallet-hero au1">
        <div className="wh-label" id="t-w-balance-lbl">Solde disponible</div>
        <div className="wh-balance">
          <span>{balance}</span>
          <span className="wh-sym">MC</span>
          <span style={{ fontSize: '.82rem', color: 'rgba(255,255,255,.58)', fontWeight: 400 }}>
            = {(balance * rateDzd).toLocaleString('fr-FR')} DZD
          </span>
        </div>
        <div className="wh-sub">Maawa Coins · {user?.displayName || 'Maawa'}</div>
        <div className="wh-actions">
          {/* Recharger opens the recharge-request modal (Phase 3 wires the
              full flow; for now we leave the existing button in place so
              the layout is preserved). */}
          <button
            className="wbtn wbtn-w"
            onClick={() => document.getElementById('recharge-modal')?.classList.add('on')}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span id="t-w-recharge">Recharger</span>
          </button>
          <button className="wbtn wbtn-d" disabled title="Bientôt disponible" style={{ opacity: 0.55, cursor: 'not-allowed' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12l7 7 7-7" /></svg>
            <span id="t-w-withdraw">Retrait</span>
          </button>
          <button className="wbtn wbtn-d" disabled title="Bientôt disponible" style={{ opacity: 0.55, cursor: 'not-allowed' }}>
            🏪 <span id="t-w-agency">Agence</span>
          </button>
        </div>
        {/* Removed the four fake monthly stat tiles (+820 / -470 / +120 / 🥈).
            Phase 3 will add real "earned this month" / "spent this month"
            aggregations once the transactions collection has real data. */}
      </div>

      <div className="wallet-grid">
        <div className="wpanel au2">
          <div className="wp-title"><span>🛒</span><span id="t-w-spend-title">Dépenser vos Coins</span></div>
          {/* Spend-flow not wired yet. Buttons are disabled with explicit
              "Bientôt disponible" labelling so we're not dishonest about
              what they do. Phase 3 owns the server-side debit + audit. */}
          {([
            { icon: '🚀', bg: 'var(--b100)', name: 'Boost Profil 7 jours',  desc: 'Top résultats de recherche', price: 50 },
            { icon: '📹', bg: 'var(--rl)',   name: 'Boost Reel 24h',        desc: 'Mise en avant vidéo',        price: 20 },
            { icon: '💎', bg: 'var(--gol)',  name: 'Badge Premium 1 mois',  desc: 'Missions premium + visibilité', price: 100 },
            { icon: '📊', bg: 'var(--gl)',   name: 'Analytics Avancés',     desc: 'Stats détaillées profil',    price: 30 },
          ] as const).map(item => (
            <div key={item.name} className="mc-item">
              <div className="mci-icon" style={{ background: item.bg }}>{item.icon}</div>
              <div style={{ flex: 1 }}>
                <div className="mci-name">{item.name}</div>
                <div className="mci-desc">{item.desc}</div>
              </div>
              <div>
                <div className="mci-price">{item.price} MC</div>
                <button
                  className="btn-primary sm"
                  style={{ marginTop: '3px', opacity: 0.55, cursor: 'not-allowed' }}
                  disabled
                  title="Bientôt disponible"
                >
                  Bientôt
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="wpanel au3">
          <div className="wp-title"><span>📋</span><span id="t-tx-title">Transactions récentes</span></div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text3)' }}>…</div>
          ) : transactions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 12px', color: 'var(--text3)' }}>
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🪙</div>
              <div style={{ fontSize: '.85rem', color: 'var(--text2)', fontWeight: 600 }}>Aucune transaction</div>
              <button
                className="btn-primary sm"
                style={{ marginTop: '12px' }}
                onClick={() => document.getElementById('recharge-modal')?.classList.add('on')}
              >
                + Recharger mon solde
              </button>
            </div>
          ) : (
            transactions.map((tx) => (
              <div key={tx.id} className="tx-item">
                <div className="txi-icon" style={{ background: tx.type === 'credit' ? 'var(--gl)' : 'var(--rl)' }}>
                  {tx.type === 'credit' ? '↓' : '↑'}
                </div>
                <div style={{ flex: 1 }}>
                  <div className="txi-label">{tx.desc}</div>
                  <div className="txi-date">{tx.date}</div>
                </div>
                <div className={`txi-amount ${tx.type === 'credit' ? 'income' : 'expense'}`}>
                  {tx.type === 'credit' ? '+' : '-'}{tx.amount} MC
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Removed: "Maawa Rewards — Niveau Argent" card.
          Depended on a `loyaltyLevel` field that doesn't exist on the user
          doc. Add back when the loyalty system ships in a later phase. */}

      <MyRequests />
    </div>
  );
}

/* ─── "Mes demandes" — user's coin-purchase request history ─────────── */

interface CoinRequestDoc {
  id: string;
  amountMC: number;
  amountDZD: number;
  paymentMethod: 'ccp' | 'baridimob' | 'cash_office';
  status: 'pending' | 'approved' | 'rejected';
  reviewNote?: string | null;
  createdAt?: { seconds: number } | null;
}

function fmtDate(seconds?: number): string {
  if (!seconds) return '—';
  return new Date(seconds * 1000).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

/**
 * Lists the current user's coin-purchase requests in reverse chronological
 * order. Subscribes via onSnapshot so the row flips from "En attente" to
 * "Approuvée" as soon as the admin acts.
 *
 * Hidden when the user has no requests AND the transactions list is empty
 * — keeps the wallet page tidy for fresh accounts.
 */
function MyRequests() {
  const t = useT();
  const [uid, setUid] = useState<string | null>(null);
  const [requests, setRequests] = useState<CoinRequestDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => onAuthStateChanged(auth, u => setUid(u?.uid ?? null)), []);

  useEffect(() => {
    if (!uid || !db) { setLoading(false); return; }
    const q = query(
      collection(db, 'coin_purchase_requests'),
      where('userId', '==', uid),
      orderBy('createdAt', 'desc'),
      limit(20),
    );
    const unsub = onSnapshot(q, snap => {
      setRequests(snap.docs.map(d => {
        const data = d.data() as Record<string, unknown>;
        return {
          id: d.id,
          amountMC:      Number(data.amountMC ?? 0),
          amountDZD:     Number(data.amountDZD ?? 0),
          paymentMethod: (data.paymentMethod as CoinRequestDoc['paymentMethod']) ?? 'ccp',
          status:        (data.status as CoinRequestDoc['status']) ?? 'pending',
          reviewNote:    (data.reviewNote as string | null | undefined) ?? null,
          createdAt:     (data.createdAt as { seconds: number } | null | undefined) ?? null,
        };
      }));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [uid]);

  /* Hide entirely when there's nothing to show — avoids an empty card
     on freshly created accounts. */
  if (loading) return null;
  if (requests.length === 0) return null;

  /* Status colour token map — uses existing CSS vars for consistency
     with the wallet hero's hue palette. */
  const statusColors: Record<CoinRequestDoc['status'], { bg: string; fg: string }> = {
    pending:  { bg: 'var(--ol)', fg: 'var(--or)' },
    approved: { bg: 'var(--gl)', fg: 'var(--gn)' },
    rejected: { bg: 'var(--rl)', fg: 'var(--rd)' },
  };

  const methodLabel: Record<CoinRequestDoc['paymentMethod'], string> = {
    ccp:         t('rch_method_ccp'),
    baridimob:   t('rch_method_baridi'),
    cash_office: t('rch_method_cash'),
  };

  return (
    <div className="wpanel au4" style={{ marginTop: 14 }}>
      <div className="wp-title">
        <span>📨</span>
        <span>{t('rch_my_requests_title')}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {requests.map(r => {
          const c = statusColors[r.status];
          return (
            <div
              key={r.id}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '10px 12px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--rx)',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: '.9rem', color: 'var(--text)' }}>
                  {r.amountMC} MC <span style={{ fontWeight: 400, color: 'var(--text2)', fontSize: '.8rem' }}>= {r.amountDZD.toLocaleString('fr-FR')} DZD</span>
                </div>
                <div style={{ fontSize: '.74rem', color: 'var(--text2)', marginTop: 2 }}>
                  {methodLabel[r.paymentMethod]} · {fmtDate(r.createdAt?.seconds)}
                </div>
                {r.status === 'rejected' && r.reviewNote && (
                  <div style={{ fontSize: '.74rem', color: 'var(--rd)', marginTop: 4, fontStyle: 'italic' }}>
                    {r.reviewNote}
                  </div>
                )}
              </div>
              <span style={{
                background: c.bg,
                color: c.fg,
                fontSize: '.7rem',
                fontWeight: 700,
                padding: '4px 10px',
                borderRadius: 50,
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}>
                {t(`rch_status_${r.status}`)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
