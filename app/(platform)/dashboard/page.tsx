'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@/lib/toast';
import { useMaawa } from '@/lib/store';
import { useMissions, useWallet } from '@/lib/hooks';
import ErrorBoundary from '@/components/ErrorBoundary';

/**
 * Artisan dashboard.
 *
 * Phase 2 cleanup:
 *   - Removed fake "4.9★ rating" and "1 247 profile views" tiles.
 *     The data sources don't exist yet (no reviews collection, no
 *     view-tracking pipeline). Those tiles will return when the
 *     corresponding aggregations are in place.
 *   - Removed "↑ Top 5% Maawa" / "↑ +34% boost" decorative trends.
 *   - Revenue chart bars are now computed from the user's own credit
 *     transactions, grouped by ISO week within the current month.
 *     Empty weeks render as 0 — honest, no synthetic noise.
 *
 * Online/offline status is still a UI toggle stub. Phase 3 wires it
 * to users/{uid}.available and the corresponding rule.
 */

interface WalletTxn {
  id: string;
  type?: 'credit' | 'debit';
  amount?: number;
  createdAt?: { seconds: number } | Date | null;
}

/* ISO week-of-month, 1..5. Week 1 = the week containing the 1st. */
function weekOfMonth(d: Date): number {
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const dayOfMonth = d.getDate();
  /* Offset to align with the first Monday (or first day if Sunday). */
  const firstDow = first.getDay() === 0 ? 7 : first.getDay(); /* Mon=1..Sun=7 */
  return Math.ceil((dayOfMonth + firstDow - 1) / 7);
}

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useMaawa();
  const { missions, loading: missionsLoading } = useMissions();
  const { transactions } = useWallet();

  /* Available flag — pulled from store (synced from user doc on auth)
     and mirrored locally so the toggle has an optimistic-update feel.
     The user doc field is `available` boolean, set server-side via
     POST /api/me/available. */
  const initialAvailable = (user as unknown as { available?: boolean } | null)?.available !== false;
  const [available, setAvailable] = useState(initialAvailable);
  const [toggling, setToggling]   = useState(false);

  const flipAvailable = async () => {
    if (toggling) return;
    setToggling(true);
    const next = !available;
    setAvailable(next); /* optimistic */
    try {
      const res = await fetch('/api/me/available', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ available: next }),
      });
      if (!res.ok) {
        setAvailable(!next); /* rollback */
        const j = await res.json().catch(() => ({}));
        toast('❌ ' + (j.message ?? 'Erreur'));
      } else {
        toast(next ? '🟢 Disponible' : '⏸️ Indisponible');
      }
    } catch {
      setAvailable(!next);
      toast('❌ Erreur réseau');
    } finally {
      setToggling(false);
    }
  };

  const firstName = user?.displayName?.split(' ')[0] || 'Artisan';
  const activeMissions = missions.filter(m => m.status !== 'terminee');
  const completedMissions = missions.filter(m => m.status === 'terminee');
  const totalEarned = (transactions as WalletTxn[])
    .filter(tx => tx.type === 'credit')
    .reduce((sum, tx) => sum + (tx.amount || 0), 0);
  const rateDzd = Number(process.env.NEXT_PUBLIC_MC_RATE_DZD ?? 50);

  /* Weekly credit-MC totals for the current month, weeks 1..4. */
  const weeklyBars = useMemo(() => {
    const now = new Date();
    const m = now.getMonth();
    const y = now.getFullYear();
    const buckets = [0, 0, 0, 0]; /* weeks 1..4 — week 5 rolled into 4 */

    for (const tx of transactions as WalletTxn[]) {
      if (tx.type !== 'credit' || !tx.amount) continue;
      let when: Date | null = null;
      if (tx.createdAt instanceof Date) {
        when = tx.createdAt;
      } else if (tx.createdAt && typeof tx.createdAt === 'object' && 'seconds' in tx.createdAt) {
        when = new Date(tx.createdAt.seconds * 1000);
      }
      if (!when || when.getMonth() !== m || when.getFullYear() !== y) continue;
      const w = Math.min(4, weekOfMonth(when));
      buckets[w - 1] += tx.amount;
    }

    const max = Math.max(1, ...buckets);
    return buckets.map(v => ({ raw: v, pct: Math.round((v / max) * 100) }));
  }, [transactions]);

  const monthHasActivity = weeklyBars.some(b => b.raw > 0);

  return (
    <ErrorBoundary>
      <div className="screen on" id="s-adash">
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '15px', flexWrap: 'wrap', gap: '8px' }} className="au">
          <div>
            <div className="pg-title">Tableau de bord 🔧</div>
            <div className="pg-sub" style={{ marginBottom: 0 }}>
              Bonjour {firstName} ! {activeMissions.length > 0 ? `${activeMissions.length} mission${activeMissions.length > 1 ? 's' : ''} active${activeMissions.length > 1 ? 's' : ''}.` : 'Aucune mission active.'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <div
              style={{
                background: available ? 'var(--gl)' : 'var(--ol)',
                border: `1px solid ${available ? 'var(--gn)' : 'var(--or)'}`,
                borderRadius: '50px', padding: '5px 12px',
                fontSize: '.76rem', fontWeight: 700,
                color: available ? 'var(--gn)' : 'var(--or)',
                display: 'flex', alignItems: 'center', gap: '4px',
                transition: 'all .18s',
              }}
            >
              <div style={{
                width: '6px', height: '6px', borderRadius: '50%',
                background: available ? 'var(--gn)' : 'var(--or)',
              }} />
              <span>{available ? 'En ligne' : 'Hors ligne'}</span>
            </div>
            <button
              className="btn-outline sm"
              onClick={flipAvailable}
              disabled={toggling}
            >
              {toggling ? '…' : available ? 'Passer hors ligne' : 'Passer en ligne'}
            </button>
          </div>
        </div>

        {/* KPI Grid — only real numbers now. Tiles for rating + views
            removed; will return when the reviews collection and
            view-tracking ship. */}
        <div className="dash-kpi-grid">
          <div className="kpi-card au1">
            <div className="kpi-icon" style={{ background: 'var(--b100)' }}>📋</div>
            <div className="kpi-v">{missionsLoading ? '…' : activeMissions.length}</div>
            <div className="kpi-l">Missions actives</div>
          </div>
          <div className="kpi-card au1">
            <div className="kpi-icon" style={{ background: 'var(--gl)' }}>✅</div>
            <div className="kpi-v">{missionsLoading ? '…' : completedMissions.length}</div>
            <div className="kpi-l">Missions terminées</div>
          </div>
          <div className="kpi-card au2">
            <div className="kpi-icon" style={{ background: 'var(--b100)' }}>💰</div>
            <div className="kpi-v">{(totalEarned * rateDzd).toLocaleString('fr-FR')}</div>
            <div className="kpi-l">DZD total</div>
            <div className="kpi-trend">Via SafePay</div>
          </div>
          <div className="kpi-card au2" style={{ cursor: 'pointer' }} onClick={() => router.push('/wallet')}>
            <div className="kpi-icon" style={{ background: 'var(--ol)' }}>🪙</div>
            <div className="kpi-v">{user?.maawaCoinBalance ?? 0} MC</div>
            <div className="kpi-l">Maawa Coins</div>
            <div className="kpi-trend" style={{ color: 'var(--b500)' }}>Gérer →</div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="card au4" style={{ padding: '15px', marginBottom: '15px' }}>
          <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: '.88rem', color: 'var(--text)', marginBottom: '10px' }}>🎯 Actions rapides</div>
          <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap' }}>
            <button className="btn-primary" onClick={() => router.push('/missions')}>
              Voir missions ({activeMissions.length})
            </button>
            <button className="btn-primary" style={{ background: 'linear-gradient(135deg,var(--or),#ea580c)' }} onClick={() => router.push('/dashboard/portfolio')}>
              📹 Ajouter Reel
            </button>
            <button className="btn-outline" onClick={() => router.push('/wallet')}>🚀 Booster profil</button>
            <button className="btn-outline" onClick={() => router.push('/chat')}>
              💬 Messages
            </button>
          </div>
        </div>

        {/* Revenue Chart — computed from real credit transactions */}
        <div className="revenue-chart au5" style={{ position: 'relative' }}>
          <div className="rev-chart-title">📈 Revenus — {new Date().toLocaleString('fr-FR', { month: 'long', year: 'numeric' })}</div>
          <div className="chart-bars">
            {weeklyBars.map((b, i) => (
              <div key={i} className="chart-bar">
                <div className="chart-bar-fill">
                  <div className="chart-bar-inner" style={{ height: `${b.pct}%` }}></div>
                </div>
                <div className="chart-bar-lbl">S{i + 1}</div>
              </div>
            ))}
          </div>
          <div className="rc-total">
            <span style={{ fontSize: '.76rem', color: 'rgba(255,255,255,.58)' }}>Total ce mois</span>
            <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: '.94rem', color: '#fff' }}>
              {(weeklyBars.reduce((s, b) => s + b.raw, 0) * rateDzd).toLocaleString('fr-FR')} DZD
            </span>
          </div>
          {!monthHasActivity && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.45)', borderRadius: 'inherit', backdropFilter: 'blur(2px)', pointerEvents: 'none' }}>
              <div style={{ fontSize: '.84rem', color: 'rgba(255,255,255,.85)', fontWeight: 600 }}>Aucune activité ce mois</div>
            </div>
          )}
        </div>

        {/* Profile completion tip */}
        {!user?.wilaya && (
          <div style={{ background: 'var(--ol)', border: '1px solid var(--or)', borderRadius: 'var(--r)', padding: '12px 14px', marginTop: '14px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }} onClick={() => router.push('/settings')}>
            <span style={{ fontSize: '1.2rem' }}>⚠️</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: '.82rem', color: 'var(--or)' }}>Complétez votre profil</div>
              <div style={{ fontSize: '.74rem', color: 'var(--text2)' }}>Ajoutez votre wilaya pour recevoir plus de missions</div>
            </div>
            <span style={{ color: 'var(--or)', fontSize: '.8rem' }}>→</span>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}
