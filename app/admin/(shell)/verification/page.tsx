'use client';

import { useEffect, useState } from 'react';
import { toast } from '@/lib/toast';
import { db } from '@/lib/firebase';
import {
  collection, onSnapshot, query, where, orderBy, limit,
} from 'firebase/firestore';

/**
 * Admin Verification — roster of verified artisans.
 *
 * Read-only by default. The Unverify button is a destructive action
 * for cases like fraud, expired credentials, customer complaints
 * confirmed by moderation. Calls /api/admin/users/unverify which
 * flips verified=false without deleting the account — the artisan
 * can resubmit through /apply later.
 *
 * For new approvals, point the admin at /admin/applications.
 */

interface ArtisanRow {
  id: string;
  displayName: string;
  email?: string;
  trade?: string;
  wilaya?: string;
  rating?: number;
  reviewCount?: number;
  verifiedAt?: { seconds: number } | null;
}

function fmtDate(seconds?: number): string {
  if (!seconds) return '—';
  return new Date(seconds * 1000).toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

export default function AdminVerificationPage() {
  const [rows, setRows] = useState<ArtisanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [acting, setActing] = useState<string | null>(null);
  const [unverifyFor, setUnverifyFor] = useState<ArtisanRow | null>(null);
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!db) { setLoading(false); return; }
    setLoading(true); setError(null);
    /* role + verified filter — we don't sort by verifiedAt because
       the field may be unset on artisans who were created via the
       admin bootstrap path before verifiedAt existed. */
    const q = query(
      collection(db, 'users'),
      where('role', '==', 'artisan'),
      where('verified', '==', true),
      orderBy('displayName'),
      limit(50),
    );
    const unsub = onSnapshot(q, snap => {
      setRows(snap.docs.map(d => {
        const x = d.data() as Record<string, unknown>;
        return {
          id: d.id,
          displayName: String(x.displayName ?? d.id),
          email:       typeof x.email === 'string' ? x.email : undefined,
          trade:       typeof x.trade === 'string' ? x.trade : undefined,
          wilaya:      typeof x.wilaya === 'string' ? x.wilaya : undefined,
          rating:      typeof x.rating === 'number' ? x.rating : undefined,
          reviewCount: typeof x.reviewCount === 'number' ? x.reviewCount : undefined,
          verifiedAt:  (x.verifiedAt as { seconds: number } | null) ?? null,
        };
      }));
      setLoading(false);
    }, err => {
      console.error('verification snapshot', err);
      setError('Impossible de charger les artisans');
      setLoading(false);
    });
    return unsub;
  }, []);

  const filtered = filter
    ? rows.filter(r =>
        r.displayName.toLowerCase().includes(filter.toLowerCase())
        || (r.trade ?? '').toLowerCase().includes(filter.toLowerCase())
        || (r.wilaya ?? '').toLowerCase().includes(filter.toLowerCase())
      )
    : rows;

  const performUnverify = async () => {
    if (!unverifyFor) return;
    if (reason.trim().length < 5) {
      toast('⚠️ La raison doit faire au moins 5 caractères');
      return;
    }
    setActing(unverifyFor.id);
    try {
      const res = await fetch('/api/admin/users/unverify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ uid: unverifyFor.id, reason: reason.trim() }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast('❌ ' + (j.message ?? 'Erreur'));
      } else {
        toast('Vérification révoquée');
        setUnverifyFor(null);
        setReason('');
      }
    } catch {
      toast('❌ Erreur réseau');
    } finally {
      setActing(null);
    }
  };

  return (
    <div className="page on" id="page-verification">
      <div className="page-header au">
        <div>
          <div className="page-h1">✅ Vérification</div>
          <div className="page-sub">
            {rows.length} artisans vérifiés · Pour de nouvelles approbations, voir <a href="/admin/applications" style={{ color: 'var(--b500)' }}>Candidatures</a>
          </div>
        </div>
      </div>

      <div className="au1" style={{ marginBottom: 14 }}>
        <input
          type="text"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="🔍 Filtrer par nom, métier ou wilaya"
          style={{
            width: '100%', maxWidth: 360, padding: 9,
            border: '1.5px solid var(--border2)', borderRadius: 'var(--rx)',
            background: 'var(--surface)', color: 'var(--text)',
            fontSize: '.86rem',
          }}
        />
      </div>

      <div className="card au2" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)' }}>Chargement…</div>
        ) : error ? (
          <div style={{ padding: 32, textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: 8 }}>⚠️</div>
            <div style={{ color: 'var(--rd)', fontSize: '.88rem' }}>{error}</div>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>
            <div style={{ fontSize: '2.4rem', marginBottom: 8 }}>🔍</div>
            <div style={{ fontSize: '.9rem', color: 'var(--text2)', fontWeight: 600 }}>
              {filter ? 'Aucun artisan ne correspond' : 'Aucun artisan vérifié'}
            </div>
          </div>
        ) : (
          filtered.map(r => (
            <div
              key={r.id}
              style={{
                display: 'flex', gap: 12, alignItems: 'center',
                padding: 14, borderBottom: '1px solid var(--border)',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: '.92rem', color: 'var(--text)' }}>
                    {r.displayName}
                  </span>
                  <span style={{
                    fontSize: '.66rem', fontWeight: 700, color: 'var(--gn)',
                    background: 'var(--gl)', padding: '2px 8px', borderRadius: 50,
                  }}>
                    ✓ Vérifié
                  </span>
                  {r.rating !== undefined && r.reviewCount !== undefined && r.reviewCount > 0 && (
                    <span style={{ fontSize: '.76rem', color: 'var(--text2)' }}>
                      ⭐ {r.rating.toFixed(1)} · {r.reviewCount} avis
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '.78rem', color: 'var(--text2)', marginTop: 3 }}>
                  {r.trade && <>🔧 {r.trade} · </>}
                  {r.wilaya && <>📍 {r.wilaya} · </>}
                  Vérifié le {fmtDate(r.verifiedAt?.seconds)}
                </div>
                {r.email && (
                  <div style={{ fontSize: '.72rem', color: 'var(--text3)', marginTop: 2 }}>
                    {r.email}
                  </div>
                )}
              </div>
              <button
                className="btn-outline sm"
                onClick={() => setUnverifyFor(r)}
                disabled={acting === r.id}
                style={{ justifyContent: 'center', borderColor: 'var(--or)', color: 'var(--or)' }}
              >
                Révoquer
              </button>
            </div>
          ))
        )}
      </div>

      {unverifyFor && (
        <div
          className="modal-bg on"
          onClick={e => { if (e.target === e.currentTarget) { setUnverifyFor(null); setReason(''); } }}
        >
          <div className="modal-box" style={{ maxWidth: 440, padding: 22 }}>
            <div className="modal-header">
              <div className="modal-title">⚠️ Révoquer la vérification</div>
              <button className="modal-close" onClick={() => { setUnverifyFor(null); setReason(''); }} aria-label="Fermer">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div style={{ fontSize: '.85rem', color: 'var(--text2)', marginBottom: 12, lineHeight: 1.55 }}>
              Vous êtes sur le point de retirer le statut vérifié de <strong>{unverifyFor.displayName}</strong>.
              Le compte reste actif mais l&apos;artisan n&apos;apparaîtra plus dans les résultats vérifiés.
            </div>
            <label style={{ display: 'block', fontSize: '.76rem', fontWeight: 600, marginBottom: 4 }}>
              Raison <span style={{ color: 'var(--rd)' }}>*</span>
            </label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value.slice(0, 500))}
              rows={3}
              maxLength={500}
              placeholder="Ex. Documents NIN expirés — relance demandée"
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
                onClick={() => { setUnverifyFor(null); setReason(''); }}
                disabled={acting === unverifyFor.id}
                style={{ flex: 1, justifyContent: 'center' }}
              >
                Annuler
              </button>
              <button
                className="btn-primary"
                onClick={performUnverify}
                disabled={acting === unverifyFor.id || reason.trim().length < 5}
                style={{ flex: 2, justifyContent: 'center', background: 'var(--or)' }}
              >
                Révoquer la vérification
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
