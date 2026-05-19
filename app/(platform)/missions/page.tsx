'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMissions } from '@/lib/hooks';
import { SkeletonList } from '@/components/Skeleton';
import ErrorBoundary from '@/components/ErrorBoundary';
import RatingModal from '@/components/RatingModal';

/**
 * Client-facing "Mes missions" page.
 *
 * Lists every mission this user (as client) has opened, with a star-
 * rating prompt on any `terminee` mission where the client hasn't
 * rated yet (i.e. `clientRatedAt` is missing). Tapping it opens the
 * shared RatingModal.
 */

interface MissionDoc {
  id: string;
  service?: string;
  description?: string;
  wilaya?: string;
  address?: string;
  amount?: number;
  status?: string;
  artisanId?: string;
  artisanName?: string;
  clientRatedAt?: { seconds: number } | null;
  createdAt?: { seconds: number } | null;
}

function fmtDate(seconds?: number): string {
  if (!seconds) return '';
  return new Date(seconds * 1000).toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

const STATUS_LABEL: Record<string, { lbl: string; cls: string; emoji: string }> = {
  pending:     { lbl: 'En attente',  cls: 'st-orange', emoji: '⏳' },
  confirmed:   { lbl: 'Confirmée',   cls: 'st-blue',   emoji: '✅' },
  in_progress: { lbl: 'En cours',    cls: 'st-blue',   emoji: '🔄' },
  terminee:    { lbl: 'Terminée',    cls: 'st-green',  emoji: '✅' },
  cancelled:   { lbl: 'Annulée',     cls: 'st-red',    emoji: '❌' },
};

export default function MissionsPage() {
  const router = useRouter();
  const { missions, loading } = useMissions();
  const [ratingFor, setRatingFor] = useState<{ id: string; label: string } | null>(null);

  const sorted = [...(missions as MissionDoc[])].sort(
    (a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0),
  );

  return (
    <ErrorBoundary>
    <div className="screen on" id="s-missions">
      <div className="pg-title au" id="t-miss-title">Mes Missions</div>
      <div className="pg-sub au" id="t-miss-sub">Suivi en temps réel de toutes vos demandes</div>

      {loading ? (
        <SkeletonList count={3} />
      ) : sorted.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text3)' }}>
          <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📋</div>
          <div>Aucune mission pour l&apos;instant.</div>
          <button className="btn-primary sm" style={{ marginTop: 12 }} onClick={() => router.push('/quote')}>
            Demander un devis
          </button>
        </div>
      ) : (
        sorted.map((m, idx) => {
          const meta = STATUS_LABEL[m.status ?? 'pending'] ?? STATUS_LABEL.pending;
          const isTerminee = m.status === 'terminee';
          const canRate = isTerminee && !m.clientRatedAt && Boolean(m.artisanId);
          return (
            <div key={m.id} className={`mission-card au${(idx % 4) + 2}`}>
              <div className="mc-head">
                <div
                  className="mc-icon"
                  style={{ background: isTerminee ? 'var(--gl)' : 'var(--b100)' }}
                >
                  {meta.emoji}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: '.88rem', color: 'var(--text)' }}>
                    {m.service ?? 'Mission'}
                  </div>
                  <div style={{ fontSize: '.69rem', color: 'var(--text3)', marginTop: '1px' }}>
                    📍 {m.wilaya ?? '—'} · #{m.id.slice(0, 8)} · {fmtDate(m.createdAt?.seconds)}
                  </div>
                </div>
                <span className={`mc-status ${meta.cls}`}>{meta.lbl}</span>
              </div>

              {m.description && (
                <div style={{ fontSize: '.78rem', color: 'var(--text2)', padding: '0 14px', lineHeight: 1.5 }}>
                  {m.description}
                </div>
              )}

              <div className="mc-footer">
                <div style={{ flex: 1, fontSize: '.74rem', color: 'var(--text2)' }}>
                  {m.artisanId ? (
                    <span>👷 Artisan assigné</span>
                  ) : (
                    <span>👀 En recherche d&apos;artisan</span>
                  )}
                </div>
                {m.amount !== undefined && m.amount > 0 && (
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '.65rem', color: 'var(--text3)' }}>Budget</div>
                    <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: '.9rem', color: 'var(--b600)' }}>
                      {m.amount.toLocaleString('fr-FR')} DZD
                    </div>
                  </div>
                )}
              </div>

              {canRate && (
                <div style={{ padding: '0 14px 12px', display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    className="btn-primary sm"
                    onClick={() => setRatingFor({ id: m.id, label: m.artisanName ?? 'votre artisan' })}
                  >
                    ⭐ Noter cette mission
                  </button>
                </div>
              )}
              {isTerminee && m.clientRatedAt && (
                <div style={{ padding: '0 14px 12px', fontSize: '.72rem', color: 'var(--gn)' }}>
                  ✓ Vous avez évalué cette mission
                </div>
              )}
            </div>
          );
        })
      )}
    </div>

    {ratingFor && (
      <RatingModal
        missionId={ratingFor.id}
        peerLabel={ratingFor.label}
        onClose={() => setRatingFor(null)}
      />
    )}
    </ErrorBoundary>
  );
}
