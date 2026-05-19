'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { db, auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection, query, where, onSnapshot, orderBy, limit,
} from 'firebase/firestore';

/**
 * Artisan calendar — month grid of confirmed missions.
 *
 * Reads `missions where artisanId == uid && status in (confirmed,
 * in_progress, terminee)` for the visible month. Mission `scheduledAt`
 * is preferred when present; otherwise `confirmedAt`; otherwise
 * `createdAt`. Day cells with one or more missions show colored dots;
 * tapping a day reveals the list for that date.
 *
 * Built without any calendar library — month logic is short enough
 * inline and the design tokens are CSS vars from the platform theme.
 */

interface Mission {
  id: string;
  service?: string;
  description?: string;
  wilaya?: string;
  status: string;
  scheduledAt?: { seconds: number } | null;
  confirmedAt?: { seconds: number } | null;
  createdAt?: { seconds: number } | null;
}

const MONTH_NAMES_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];
const DAY_LABELS_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

function missionDate(m: Mission): Date | null {
  const s = m.scheduledAt?.seconds ?? m.confirmedAt?.seconds ?? m.createdAt?.seconds;
  return s ? new Date(s * 1000) : null;
}

export default function ArtisanCalendarPage() {
  const router = useRouter();
  const [uid, setUid] = useState<string | null>(null);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  useEffect(() => onAuthStateChanged(auth, u => setUid(u?.uid ?? null)), []);

  useEffect(() => {
    if (!uid || !db) return;
    const q = query(
      collection(db, 'missions'),
      where('artisanId', '==', uid),
      where('status', 'in', ['confirmed', 'in_progress', 'terminee']),
      orderBy('createdAt', 'desc'),
      limit(200),
    );
    const unsub = onSnapshot(q, snap => {
      setMissions(snap.docs.map(d => ({ id: d.id, ...(d.data() as object) } as Mission)));
    }, (err) => console.warn('calendar snapshot', err));
    return unsub;
  }, [uid]);

  /* Group missions by their day (1..31) within the visible month. */
  const byDay = useMemo(() => {
    const map = new Map<number, Mission[]>();
    for (const m of missions) {
      const d = missionDate(m);
      if (!d) continue;
      if (d.getFullYear() !== cursor.year || d.getMonth() !== cursor.month) continue;
      const day = d.getDate();
      const arr = map.get(day) ?? [];
      arr.push(m);
      map.set(day, arr);
    }
    return map;
  }, [missions, cursor]);

  /* Days grid. JS getDay() is 0=Sun..6=Sat; we want Mon=0..Sun=6. */
  const firstOfMonth = new Date(cursor.year, cursor.month, 1);
  const lastOfMonth  = new Date(cursor.year, cursor.month + 1, 0);
  const startCol     = (firstOfMonth.getDay() + 6) % 7;
  const daysInMonth  = lastOfMonth.getDate();
  const cells: Array<number | null> = [
    ...Array(startCol).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const today = new Date();
  const isToday = (day: number) =>
    today.getFullYear() === cursor.year
    && today.getMonth() === cursor.month
    && today.getDate()  === day;

  const monthLabel = `${MONTH_NAMES_FR[cursor.month]} ${cursor.year}`;
  const selectedList = selectedDay !== null ? (byDay.get(selectedDay) ?? []) : [];

  return (
    <div className="screen on" id="s-artisan-calendar">
      <div className="page-title-row au">
        <div>
          <div className="pt-head">📅 Calendrier</div>
          <div className="pt-sub">Vos missions confirmées par jour</div>
        </div>
      </div>

      <div className="card au1" style={{ padding: 14 }}>
        {/* Month navigator */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <button
            className="ib"
            onClick={() => setCursor(c => c.month === 0 ? { year: c.year - 1, month: 11 } : { year: c.year, month: c.month - 1 })}
            aria-label="Mois précédent"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: '1.05rem', color: 'var(--text)' }}>
            {monthLabel}
          </div>
          <button
            className="ib"
            onClick={() => setCursor(c => c.month === 11 ? { year: c.year + 1, month: 0 } : { year: c.year, month: c.month + 1 })}
            aria-label="Mois suivant"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>

        {/* Day-of-week header */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 6 }}>
          {DAY_LABELS_FR.map(d => (
            <div key={d} style={{ textAlign: 'center', fontSize: '.7rem', fontWeight: 700, color: 'var(--text3)' }}>
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
          {cells.map((day, i) => {
            if (day === null) return <div key={`empty-${i}`} />;
            const count = byDay.get(day)?.length ?? 0;
            const sel   = selectedDay === day;
            return (
              <button
                key={`d-${day}`}
                onClick={() => setSelectedDay(sel ? null : day)}
                aria-label={`${day} ${monthLabel}`}
                style={{
                  position: 'relative',
                  aspectRatio: '1/1',
                  borderRadius: 8,
                  background: sel ? 'var(--b500)'
                    : isToday(day) ? 'var(--b50)' : 'var(--surface)',
                  color: sel ? '#fff' : 'var(--text)',
                  cursor: 'pointer',
                  fontWeight: count > 0 ? 700 : 500,
                  fontSize: '.85rem',
                  transition: 'all .15s',
                  border: `1px solid ${isToday(day) ? 'var(--b300)' : 'var(--border)'}`,
                }}
              >
                {day}
                {count > 0 && (
                  <span style={{
                    position: 'absolute', bottom: 4, left: '50%', transform: 'translateX(-50%)',
                    width: 6, height: 6, borderRadius: '50%',
                    background: sel ? '#fff' : 'var(--gn)',
                  }} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Day detail */}
      {selectedDay !== null && (
        <div className="card au2" style={{ marginTop: 14, padding: 14 }}>
          <div className="wp-title">
            <span>📍</span>
            <span>{selectedDay} {monthLabel}</span>
          </div>
          {selectedList.length === 0 ? (
            <div style={{ padding: 16, textAlign: 'center', color: 'var(--text3)', fontSize: '.85rem' }}>
              Aucune mission ce jour.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {selectedList.map(m => (
                <div
                  key={m.id}
                  onClick={() => router.push('/missions')}
                  style={{
                    padding: 10,
                    background: 'var(--surface2)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--rx)',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '.9rem', color: 'var(--text)' }}>{m.service ?? 'Mission'}</div>
                  <div style={{ fontSize: '.76rem', color: 'var(--text2)' }}>
                    📍 {m.wilaya ?? '—'} · {m.status}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
