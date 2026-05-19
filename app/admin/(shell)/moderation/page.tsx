'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import {
  collection, onSnapshot, query, orderBy, where, limit,
} from 'firebase/firestore';

/**
 * Admin Moderation activity feed.
 *
 * Unified view of recent moderation events across surfaces:
 *   - Pending user reports.
 *   - Admin actions on content (delete/sponsor) from audit_logs.
 *   - User soft-deletes from audit_logs.
 *   - Verification revocations from audit_logs.
 *
 * For full-screen workflows, link to /admin/reports (per-report
 * triage) and /admin/verification (artisan roster).
 *
 * Two live subscriptions in parallel — Firestore can't OR on `action`
 * within one query without `in` (limited to 10 values) which would
 * work but obscures the structure. Keep them split.
 */

interface Report {
  id: string;
  reporterId: string;
  targetKind: string;
  targetId: string;
  reason: string;
  createdAt?: { seconds: number } | null;
}

interface AuditEvent {
  id: string;
  action: string;
  actor: string;
  target: string;
  meta?: Record<string, unknown>;
  createdAt?: { seconds: number } | null;
}

const MOD_ACTIONS = [
  'admin.content.delete',
  'admin.content.sponsor',
  'admin.user.soft_delete',
  'admin.user.unverify',
  'admin.report.resolved',
];

function fmtRel(seconds?: number): string {
  if (!seconds) return '—';
  const diff = Date.now() - seconds * 1000;
  if (diff < 60_000)     return 'à l\'instant';
  if (diff < 3600_000)   return `il y a ${Math.floor(diff / 60_000)} min`;
  if (diff < 86_400_000) return `il y a ${Math.floor(diff / 3600_000)} h`;
  return new Date(seconds * 1000).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
}

const ACTION_LABEL: Record<string, { emoji: string; text: string; color: string }> = {
  'admin.content.delete':   { emoji: '🗑️', text: 'a supprimé un contenu',      color: 'var(--rd)' },
  'admin.content.sponsor':  { emoji: '⭐', text: 'a sponsorisé un contenu',    color: 'var(--gol)' },
  'admin.user.soft_delete': { emoji: '🚫', text: 'a supprimé un utilisateur', color: 'var(--rd)' },
  'admin.user.unverify':    { emoji: '⚠️', text: 'a révoqué une vérification', color: 'var(--or)' },
  'admin.report.resolved':  { emoji: '✅', text: 'a traité un signalement',    color: 'var(--gn)' },
};

export default function AdminModerationPage() {
  const router = useRouter();
  const [openReports, setOpenReports] = useState<Report[]>([]);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!db) { setLoading(false); return; }
    const unsubReports = onSnapshot(
      query(
        collection(db, 'reports'),
        where('status', '==', 'open'),
        orderBy('createdAt', 'desc'),
        limit(10),
      ),
      snap => {
        setOpenReports(snap.docs.map(d => ({ id: d.id, ...(d.data() as object) } as Report)));
        setLoading(false);
      },
      () => setLoading(false),
    );
    /* Audit log subscription. We pull a wider list and client-filter
       to the five moderation actions; the audit_logs collection
       has many other action types we don't care about here. */
    const unsubAudit = onSnapshot(
      query(
        collection(db, 'audit_logs'),
        orderBy('createdAt', 'desc'),
        limit(50),
      ),
      snap => {
        const all = snap.docs.map(d => ({ id: d.id, ...(d.data() as object) } as AuditEvent));
        setEvents(all.filter(e => MOD_ACTIONS.includes(e.action)).slice(0, 20));
      },
      () => { /* silent */ },
    );
    return () => { unsubReports(); unsubAudit(); };
  }, []);

  return (
    <div className="page on" id="page-moderation">
      <div className="page-header au">
        <div>
          <div className="page-h1">🛡️ Modération</div>
          <div className="page-sub">Vue d&apos;ensemble des signalements et actions récentes</div>
        </div>
      </div>

      {/* Quick-action shortcuts. */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }} className="au1">
        <button className="btn-outline sm" onClick={() => router.push('/admin/reports')}>
          🚩 Tous les signalements
        </button>
        <button className="btn-outline sm" onClick={() => router.push('/admin/content')}>
          📝 Contenu
        </button>
        <button className="btn-outline sm" onClick={() => router.push('/admin/verification')}>
          ✅ Vérification
        </button>
        <button className="btn-outline sm" onClick={() => router.push('/admin/audit')}>
          📜 Audit complet
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 14 }}>
        {/* Open reports */}
        <div className="card au2" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: 12, borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: '.92rem' }}>
              🚩 Signalements ouverts
            </div>
            <span style={{
              fontSize: '.7rem', fontWeight: 700,
              background: openReports.length > 0 ? 'var(--rl)' : 'var(--gl)',
              color: openReports.length > 0 ? 'var(--rd)' : 'var(--gn)',
              padding: '2px 8px', borderRadius: 50,
            }}>
              {openReports.length}
            </span>
          </div>
          {loading ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)' }}>…</div>
          ) : openReports.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text2)', fontSize: '.86rem' }}>
              ✓ Aucun signalement en attente
            </div>
          ) : (
            openReports.map(r => (
              <div
                key={r.id}
                onClick={() => router.push('/admin/reports')}
                style={{
                  padding: 10, borderBottom: '1px solid var(--border)',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontSize: '.82rem', color: 'var(--text)' }}>
                  Signalement sur <strong>{r.targetKind}</strong> · {r.reason}
                </div>
                <div style={{ fontSize: '.7rem', color: 'var(--text3)', marginTop: 2 }}>
                  {fmtRel(r.createdAt?.seconds)} · id: <code>{r.targetId.slice(0, 16)}…</code>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Recent admin actions */}
        <div className="card au3" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: 12, borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: '.92rem' }}>
              📜 Actions récentes
            </div>
          </div>
          {events.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text2)', fontSize: '.86rem' }}>
              Aucune action récente.
            </div>
          ) : (
            events.map(e => {
              const meta = ACTION_LABEL[e.action] ?? { emoji: '•', text: e.action, color: 'var(--text2)' };
              return (
                <div key={e.id} style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '.82rem', color: 'var(--text)' }}>
                    <span style={{ marginRight: 6 }}>{meta.emoji}</span>
                    <strong style={{ color: meta.color }}>{e.actor.slice(0, 8)}…</strong>
                    {' '}{meta.text}
                  </div>
                  <div style={{ fontSize: '.7rem', color: 'var(--text3)', marginTop: 2 }}>
                    {fmtRel(e.createdAt?.seconds)} · cible: <code>{e.target.slice(0, 24)}</code>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
