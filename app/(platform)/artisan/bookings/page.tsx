'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@/lib/toast';
import { db, auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection, query, where, onSnapshot, orderBy, limit,
  collectionGroup, getDocs,
} from 'firebase/firestore';
import RatingModal from '@/components/RatingModal';

/**
 * Artisan bookings inbox.
 *
 * Three sections:
 *   - "Demandes en attente" — missions with status='pending' that this
 *     artisan can accept (and hasn't declined).
 *   - "Missions confirmées" — assigned to me, status='confirmed' or
 *     'in_progress'. Workflow buttons live here (Commencer / Terminer).
 *   - "À évaluer" — terminée missions assigned to me where I haven't
 *     yet rated the client. Tapping opens RatingModal.
 *
 * Firestore can't express "documents WHERE NOT EXISTS sub-doc", so
 * we filter the declines client-side after fetching once on mount.
 */

interface Mission {
  id: string;
  clientId: string;
  service: string;
  description: string;
  wilaya: string;
  address?: string;
  amount?: number;
  urgency?: string;
  status: 'pending' | 'confirmed' | 'in_progress' | 'terminee' | 'cancelled';
  artisanId?: string;
  artisanRatedAt?: { seconds: number } | null;
  createdAt?: { seconds: number } | null;
}

function fmtDate(seconds?: number): string {
  if (!seconds) return '';
  return new Date(seconds * 1000).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

export default function ArtisanBookingsPage() {
  const router = useRouter();
  const [uid, setUid] = useState<string | null>(null);
  const [pending, setPending] = useState<Mission[]>([]);
  const [confirmed, setConfirmed] = useState<Mission[]>([]);
  const [terminees, setTerminees] = useState<Mission[]>([]);
  const [declinedIds, setDeclinedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [ratingFor, setRatingFor] = useState<{ id: string; label: string } | null>(null);

  useEffect(() => onAuthStateChanged(auth, u => setUid(u?.uid ?? null)), []);

  /* My declines (so we can filter them out of the pending list). */
  useEffect(() => {
    if (!uid || !db) return;
    let cancelled = false;
    (async () => {
      try {
        const q = query(collectionGroup(db, 'declines'), where('artisanId', '==', uid), limit(200));
        const snap = await getDocs(q);
        if (cancelled) return;
        const ids = new Set<string>();
        for (const d of snap.docs) {
          /* path looks like missions/{missionId}/declines/{artisanUid} */
          const parts = d.ref.path.split('/');
          if (parts.length >= 4) ids.add(parts[1]);
        }
        setDeclinedIds(ids);
      } catch (err) {
        console.warn('declines fetch failed', err);
      }
    })();
    return () => { cancelled = true; };
  }, [uid]);

  /* Live: pending missions I haven't declined. */
  useEffect(() => {
    if (!uid || !db) { setLoading(false); return; }
    /* Pending missions — we don't filter by wilaya server-side because
       Firestore can't AND on three different fields without a composite
       index AND we don't know the artisan's wilaya here at query time.
       The amount of pending missions is small; client-side filter ok. */
    const q = query(
      collection(db, 'missions'),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc'),
      limit(50),
    );
    const unsub = onSnapshot(q, snap => {
      const rows: Mission[] = snap.docs.map(d => ({ id: d.id, ...(d.data() as object) } as Mission));
      setPending(rows.filter(m => !declinedIds.has(m.id) && (!m.artisanId || m.artisanId === uid)));
      setLoading(false);
    }, (err) => {
      console.warn('pending missions snapshot error', err);
      setLoading(false);
    });
    return unsub;
  }, [uid, declinedIds]);

  /* Live: missions assigned to me, not yet terminated. */
  useEffect(() => {
    if (!uid || !db) return;
    const q = query(
      collection(db, 'missions'),
      where('artisanId', '==', uid),
      where('status', 'in', ['confirmed', 'in_progress']),
      orderBy('createdAt', 'desc'),
      limit(50),
    );
    const unsub = onSnapshot(q, snap => {
      setConfirmed(snap.docs.map(d => ({ id: d.id, ...(d.data() as object) } as Mission)));
    }, (err) => console.warn('confirmed missions snapshot error', err));
    return unsub;
  }, [uid]);

  /* Live: terminée missions I haven't yet rated.
     We can't WHERE on "artisanRatedAt missing" — Firestore doesn't
     support absence — so we pull the last 50 terminée missions and
     client-filter. Fine at the scale of a single artisan. */
  useEffect(() => {
    if (!uid || !db) return;
    const q = query(
      collection(db, 'missions'),
      where('artisanId', '==', uid),
      where('status', '==', 'terminee'),
      orderBy('createdAt', 'desc'),
      limit(50),
    );
    const unsub = onSnapshot(q, snap => {
      const all = snap.docs.map(d => ({ id: d.id, ...(d.data() as object) } as Mission));
      setTerminees(all.filter(m => !m.artisanRatedAt));
    }, (err) => console.warn('terminee missions snapshot error', err));
    return unsub;
  }, [uid]);

  const accept = async (missionId: string) => {
    setActingId(missionId);
    try {
      const res = await fetch('/api/artisan/mission/accept', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ missionId }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast('❌ ' + (j.message ?? 'Erreur'));
      } else {
        toast('✅ Mission acceptée');
      }
    } catch {
      toast('❌ Erreur réseau');
    } finally {
      setActingId(null);
    }
  };

  const decline = async (missionId: string) => {
    setActingId(missionId);
    try {
      const res = await fetch('/api/artisan/mission/decline', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ missionId }),
      });
      if (!res.ok) {
        toast('❌ Erreur');
      } else {
        toast('Mission refusée');
        setDeclinedIds(s => { const n = new Set(s); n.add(missionId); return n; });
      }
    } catch {
      toast('❌ Erreur réseau');
    } finally {
      setActingId(null);
    }
  };

  /* Workflow transitions — confirmed → in_progress → terminee.
     Each calls the corresponding API route and lets the live snapshot
     update the card status. We don't need to mutate local state. */
  const startMission = async (missionId: string) => {
    setActingId(missionId);
    try {
      const res = await fetch('/api/artisan/mission/start', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ missionId }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast('❌ ' + (j.message ?? 'Erreur'));
      } else {
        toast('🛠️ Mission démarrée');
      }
    } catch {
      toast('❌ Erreur réseau');
    } finally {
      setActingId(null);
    }
  };

  const completeMission = async (missionId: string) => {
    if (!confirm('Confirmer la fin de la mission ? Cette action est définitive.')) return;
    setActingId(missionId);
    try {
      const res = await fetch('/api/artisan/mission/complete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ missionId }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast('❌ ' + (j.message ?? 'Erreur'));
      } else {
        toast('✅ Mission terminée');
      }
    } catch {
      toast('❌ Erreur réseau');
    } finally {
      setActingId(null);
    }
  };

  return (
    <>
    <div className="screen on" id="s-artisan-bookings">
      <div className="page-title-row au">
        <div>
          <div className="pt-head">📋 Mes demandes</div>
          <div className="pt-sub">
            {loading ? '…' : `${pending.length} en attente · ${confirmed.length} confirmées · ${terminees.length} à évaluer`}
          </div>
        </div>
      </div>

      {/* Pending offers */}
      <div className="card au1" style={{ marginBottom: 14 }}>
        <div className="wp-title">
          <span>⏳</span>
          <span>Demandes en attente</span>
        </div>
        {loading ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)' }}>…</div>
        ) : pending.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text3)' }}>
            <div style={{ fontSize: '2rem', marginBottom: 8 }}>📭</div>
            <div style={{ fontSize: '.85rem', color: 'var(--text2)' }}>Aucune demande pour le moment.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {pending.map(m => (
              <div key={m.id} style={{
                padding: 12,
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--rx)',
                display: 'flex', flexDirection: 'column', gap: 8,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                  <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: '.95rem', color: 'var(--text)' }}>
                    {m.service}
                  </div>
                  <div style={{ fontSize: '.74rem', color: 'var(--text3)' }}>
                    {fmtDate(m.createdAt?.seconds)}
                  </div>
                </div>
                <div style={{ fontSize: '.82rem', color: 'var(--text2)', lineHeight: 1.5 }}>
                  {m.description}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, fontSize: '.72rem', color: 'var(--text2)' }}>
                  <span>📍 {m.wilaya}</span>
                  {m.amount !== undefined && <span>· 💰 {m.amount.toLocaleString('fr-FR')} DZD</span>}
                  {m.urgency && <span>· ⚡ {m.urgency}</span>}
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  <button
                    className="btn-primary sm"
                    disabled={actingId === m.id}
                    onClick={() => accept(m.id)}
                  >
                    {actingId === m.id ? '…' : '✅ Accepter'}
                  </button>
                  <button
                    className="btn-outline sm"
                    disabled={actingId === m.id}
                    onClick={() => decline(m.id)}
                    style={{ borderColor: 'var(--rd)', color: 'var(--rd)' }}
                  >
                    Refuser
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirmed */}
      <div className="card au2">
        <div className="wp-title">
          <span>✅</span>
          <span>Missions confirmées</span>
        </div>
        {confirmed.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)', fontSize: '.85rem' }}>
            Aucune mission active.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {confirmed.map(m => (
              <div
                key={m.id}
                style={{
                  padding: 12,
                  background: 'var(--surface)',
                  border: '1px solid var(--gn)',
                  borderRadius: 'var(--rx)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                  <div style={{ fontWeight: 700, fontSize: '.92rem', color: 'var(--text)' }}>{m.service}</div>
                  <span style={{ fontSize: '.66rem', fontWeight: 700, background: 'var(--gl)', color: 'var(--gn)', padding: '2px 8px', borderRadius: 50 }}>
                    {m.status === 'in_progress' ? 'En cours' : 'Confirmée'}
                  </span>
                </div>
                <div style={{ fontSize: '.78rem', color: 'var(--text2)', marginTop: 4 }}>
                  📍 {m.wilaya}
                  {m.amount !== undefined && <> · 💰 {m.amount.toLocaleString('fr-FR')} DZD</>}
                </div>
                {/* Workflow actions. The button shown depends on status:
                    confirmed → Commencer mission;
                    in_progress → Terminer mission. */}
                <div style={{ display: 'flex', gap: 6, marginTop: 10, alignItems: 'center' }}>
                  {m.status === 'confirmed' && (
                    <button
                      className="btn-primary sm"
                      disabled={actingId === m.id}
                      onClick={() => startMission(m.id)}
                    >
                      🛠️ Commencer
                    </button>
                  )}
                  {m.status === 'in_progress' && (
                    <button
                      className="btn-primary sm"
                      disabled={actingId === m.id}
                      onClick={() => completeMission(m.id)}
                      style={{ background: 'var(--gn)' }}
                    >
                      ✅ Terminer
                    </button>
                  )}
                  <button
                    className="btn-outline sm"
                    onClick={() => router.push('/artisan/calendar')}
                    style={{ marginLeft: 'auto' }}
                  >
                    Voir le calendrier
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* À évaluer — terminée missions awaiting artisan's rating */}
      {terminees.length > 0 && (
        <div className="card au3" style={{ marginTop: 14 }}>
          <div className="wp-title">
            <span>⭐</span>
            <span>À évaluer ({terminees.length})</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {terminees.map(m => (
              <div key={m.id} style={{
                padding: 12,
                background: 'var(--surface)',
                border: '1px solid var(--gol)',
                borderRadius: 'var(--rx)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                  <div style={{ fontWeight: 700, fontSize: '.92rem', color: 'var(--text)' }}>{m.service}</div>
                  <span style={{ fontSize: '.66rem', fontWeight: 700, background: 'var(--gol)', color: '#fff', padding: '2px 8px', borderRadius: 50 }}>
                    Terminée
                  </span>
                </div>
                <div style={{ fontSize: '.78rem', color: 'var(--text2)', marginTop: 4 }}>
                  📍 {m.wilaya}
                </div>
                <div style={{ marginTop: 10 }}>
                  <button
                    className="btn-primary sm"
                    onClick={() => setRatingFor({ id: m.id, label: 'votre client' })}
                  >
                    ⭐ Noter le client
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>

    {ratingFor && (
      <RatingModal
        missionId={ratingFor.id}
        peerLabel={ratingFor.label}
        onClose={() => setRatingFor(null)}
      />
    )}
    </>
  );
}
