'use client';

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import {
  collection, getCountFromServer, query, where,
} from 'firebase/firestore';

/**
 * Admin Analytics.
 *
 * Reads real counts via getCountFromServer aggregations. No event
 * pipeline — these are point-in-time totals refreshed on page load.
 * If a count fails (rules or transient error) we show "—" rather
 * than fake a number.
 *
 * Each card represents a single aggregation query, which is what
 * Firestore bills on for COUNT(). For typical platform scale this is
 * fast and cheap.
 */

interface Tile {
  label: string;
  value: number | null;
  hint: string;
  emoji: string;
}

const FMT = new Intl.NumberFormat('fr-FR');

export default function AdminAnalyticsPage() {
  const [tiles, setTiles] = useState<Tile[]>([
    { label: 'Utilisateurs',          value: null, hint: 'Comptes actifs (non bannis)',       emoji: '👥' },
    { label: 'Artisans vérifiés',     value: null, hint: 'role=artisan, verified=true',        emoji: '🔧' },
    { label: 'Missions au total',     value: null, hint: 'Toutes statuts confondus',           emoji: '📋' },
    { label: 'Missions terminées',    value: null, hint: 'status=terminee',                    emoji: '✅' },
    { label: 'Missions actives',      value: null, hint: 'pending + confirmed + in_progress',  emoji: '🔄' },
    { label: 'Publications',          value: null, hint: 'feed_posts (posts + reels)',         emoji: '📝' },
    { label: 'Signalements ouverts',  value: null, hint: 'reports.status=open',                emoji: '🚩' },
    { label: 'Litiges actifs',        value: null, hint: 'disputes.status=open',               emoji: '⚖️' },
  ]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  useEffect(() => {
    if (!db) { setLoading(false); return; }
    setLoading(true); setError(null);

    /* Run all aggregations in parallel. Each one is independent — if
       one fails we still show the others. */
    const run = async <T,>(p: Promise<T>): Promise<T | null> => {
      try { return await p; } catch (err) {
        console.warn('analytics aggregation failed', err);
        return null;
      }
    };

    const usersCol    = collection(db, 'users');
    const missionsCol = collection(db, 'missions');
    const feedCol     = collection(db, 'feed_posts');
    const reportsCol  = collection(db, 'reports');
    const disputesCol = collection(db, 'disputes');

    Promise.all([
      /* Active users — users where banned is not true. */
      run(getCountFromServer(query(usersCol, where('banned', '!=', true)))),
      /* Verified artisans. */
      run(getCountFromServer(query(usersCol, where('role', '==', 'artisan'), where('verified', '==', true)))),
      /* All missions. */
      run(getCountFromServer(missionsCol)),
      /* Terminated missions. */
      run(getCountFromServer(query(missionsCol, where('status', '==', 'terminee')))),
      /* Active missions — pending + confirmed + in_progress. */
      run(getCountFromServer(query(missionsCol, where('status', 'in', ['pending', 'confirmed', 'in_progress'])))),
      /* All feed posts. */
      run(getCountFromServer(feedCol)),
      /* Open reports. */
      run(getCountFromServer(query(reportsCol, where('status', '==', 'open')))),
      /* Open disputes. */
      run(getCountFromServer(query(disputesCol, where('status', '==', 'open')))),
    ]).then(results => {
      const counts = results.map(r => r ? r.data().count : null);
      setTiles(t => t.map((tile, i) => ({ ...tile, value: counts[i] })));
      setLastRefresh(new Date());
      setLoading(false);
    }).catch(err => {
      console.error('analytics fetch', err);
      setError('Erreur lors du chargement des compteurs');
      setLoading(false);
    });
  }, [refreshKey]);

  return (
    <div className="page on" id="page-analytics">
      <div className="page-header au">
        <div>
          <div className="page-h1">📊 Analytics</div>
          <div className="page-sub">
            Compteurs en temps réel · pas de pipeline d&apos;événements
            {lastRefresh && <> · actualisé à {lastRefresh.toLocaleTimeString('fr-FR')}</>}
          </div>
        </div>
        <button
          className="btn-outline"
          onClick={() => setRefreshKey(k => k + 1)}
          disabled={loading}
        >
          🔄 Actualiser
        </button>
      </div>

      {error && (
        <div style={{
          padding: 12, marginBottom: 14,
          background: 'var(--rl)', color: 'var(--rd)',
          border: '1px solid var(--rd)', borderRadius: 'var(--rx)',
          fontSize: '.86rem',
        }}>
          {error}
        </div>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 14,
      }} className="au1">
        {tiles.map((t, idx) => (
          <div key={t.label} className={`card au${(idx % 3) + 2}`} style={{ padding: 16 }}>
            <div style={{ fontSize: '1.6rem', marginBottom: 6 }}>{t.emoji}</div>
            <div style={{ fontSize: '.78rem', color: 'var(--text2)', fontWeight: 600, marginBottom: 4 }}>
              {t.label}
            </div>
            <div style={{
              fontFamily: "'Sora',sans-serif",
              fontSize: '1.8rem', fontWeight: 800,
              color: 'var(--b600)',
              lineHeight: 1,
            }}>
              {loading ? '…' : t.value !== null ? FMT.format(t.value) : '—'}
            </div>
            <div style={{ fontSize: '.7rem', color: 'var(--text3)', marginTop: 6 }}>
              {t.hint}
            </div>
          </div>
        ))}
      </div>

      <div className="card au5" style={{ padding: 14, marginTop: 16, background: 'var(--surface2)' }}>
        <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: '.86rem', marginBottom: 6 }}>
          ℹ️ À propos de ces compteurs
        </div>
        <div style={{ fontSize: '.82rem', color: 'var(--text2)', lineHeight: 1.6 }}>
          Chaque chiffre est une agrégation côté serveur (<code>getCountFromServer</code>),
          actualisée à chaque chargement de page. Aucun événement n&apos;est instrumenté pour
          l&apos;instant — il n&apos;y a donc pas de vues, clics, conversions, ou cohortes.
          Une vraie pipeline analytics (BigQuery export ou Cloud Function d&apos;agrégation)
          viendra avec la phase post-launch.
        </div>
      </div>
    </div>
  );
}
