'use client';

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, limit } from 'firebase/firestore';
import { parseWilaya } from '@/lib/wilayas';

/**
 * Admin Heatmap — well, NOT a heatmap.
 *
 * A real geographic heatmap needs lat/lng per mission. We don't
 * capture that today (only wilaya text), so a tile-based density map
 * would be fictional. Instead, this page shows a per-wilaya bar
 * chart built from real data: number of missions + verified
 * artisans per wilaya, sorted by activity.
 *
 * This is the same information a heatmap would convey (where is
 * the activity?) without pretending we have granular geo data.
 */

interface WilayaStat {
  code: string;
  label: string;
  missions: number;
  artisans: number;
}

export default function AdminHeatmapPage() {
  const [rows, setRows] = useState<WilayaStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!db) { setLoading(false); return; }
    setLoading(true); setError(null);

    /* Pull missions + verified artisans. We cap at 500 each — at
       typical platform scale this is fine; if the platform grows past
       that, swap to scheduled aggregation. */
    Promise.all([
      getDocs(query(collection(db, 'missions'),    limit(500))),
      getDocs(query(collection(db, 'users'),       limit(500))),
    ]).then(([missionsSnap, usersSnap]) => {
      const bucket = new Map<string, WilayaStat>();

      const getBucket = (raw: string | undefined | null): WilayaStat | null => {
        const w = parseWilaya(raw ?? undefined);
        if (!w) return null;
        const key = w.code;
        if (!bucket.has(key)) {
          bucket.set(key, { code: w.code, label: w.name, missions: 0, artisans: 0 });
        }
        return bucket.get(key)!;
      };

      for (const d of missionsSnap.docs) {
        const x = d.data() as Record<string, unknown>;
        const b = getBucket(typeof x.wilaya === 'string' ? x.wilaya : null);
        if (b) b.missions++;
      }
      for (const d of usersSnap.docs) {
        const x = d.data() as Record<string, unknown>;
        if (x.role !== 'artisan' || x.verified !== true) continue;
        const b = getBucket(typeof x.wilaya === 'string' ? x.wilaya : null);
        if (b) b.artisans++;
      }

      const list = Array.from(bucket.values())
        .sort((a, b) => (b.missions + b.artisans) - (a.missions + a.artisans));
      setRows(list);
      setLoading(false);
    }).catch(err => {
      console.error('heatmap fetch', err);
      setError('Erreur lors du chargement');
      setLoading(false);
    });
  }, []);

  const maxValue = rows.reduce(
    (m, r) => Math.max(m, r.missions, r.artisans),
    1,
  );

  return (
    <div className="page on" id="page-heatmap">
      <div className="page-header au">
        <div>
          <div className="page-h1">🗺️ Activité par wilaya</div>
          <div className="page-sub">
            Densité de missions et d&apos;artisans par wilaya — un vrai heatmap géographique nécessite des coordonnées par mission (pas encore capturées)
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)' }}>Chargement…</div>
      ) : error ? (
        <div style={{ padding: 24, color: 'var(--rd)' }}>{error}</div>
      ) : rows.length === 0 ? (
        <div className="card au1" style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>
          <div style={{ fontSize: '2.4rem', marginBottom: 8 }}>📭</div>
          <div style={{ fontSize: '.9rem', fontWeight: 600 }}>Aucune activité enregistrée</div>
        </div>
      ) : (
        <>
          <div className="card au1" style={{ padding: 12, marginBottom: 14, fontSize: '.82rem', color: 'var(--text2)' }}>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <div>📋 <strong style={{ color: 'var(--text)' }}>{rows.reduce((s, r) => s + r.missions, 0)}</strong> missions totales</div>
              <div>🔧 <strong style={{ color: 'var(--text)' }}>{rows.reduce((s, r) => s + r.artisans, 0)}</strong> artisans vérifiés</div>
              <div>🗺️ <strong style={{ color: 'var(--text)' }}>{rows.length}</strong> wilayas actives</div>
            </div>
          </div>

          <div className="card au2" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(140px, 1fr) 80px 1fr 80px 1fr',
              gap: 8, padding: '10px 14px',
              borderBottom: '2px solid var(--border)',
              fontSize: '.72rem', fontWeight: 700, color: 'var(--text2)',
              textTransform: 'uppercase',
            }}>
              <div>Wilaya</div>
              <div>Missions</div>
              <div></div>
              <div>Artisans</div>
              <div></div>
            </div>
            {rows.map((r, i) => (
              <div key={r.code} style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(140px, 1fr) 80px 1fr 80px 1fr',
                gap: 8, padding: '10px 14px',
                borderBottom: '1px solid var(--border)',
                alignItems: 'center',
                background: i % 2 === 0 ? 'transparent' : 'var(--surface2)',
              }}>
                <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: '.84rem' }}>
                  <span style={{ color: 'var(--text3)', fontWeight: 400, marginRight: 4 }}>{r.code}</span>
                  {r.label}
                </div>
                <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, color: 'var(--b600)', fontSize: '.92rem' }}>
                  {r.missions}
                </div>
                <Bar value={r.missions} max={maxValue} color="var(--b500)" />
                <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, color: 'var(--gn)', fontSize: '.92rem' }}>
                  {r.artisans}
                </div>
                <Bar value={r.artisans} max={maxValue} color="var(--gn)" />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
      <div style={{
        width: `${pct}%`, height: '100%',
        background: color, transition: 'width .3s',
      }} />
    </div>
  );
}
