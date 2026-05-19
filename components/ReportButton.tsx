'use client';

import { useState } from 'react';
import { toast } from '@/lib/toast';
import { useRequireAuth } from '@/components/ConnectOrCallModal';

/**
 * ReportButton — drop-in "Signaler" action.
 *
 * Usage:
 *   <ReportButton targetKind="post" targetId={post.id} />
 *
 * Guests get the ConnectOrCallModal via useRequireAuth.
 * Signed-in users see a small modal with the 6 reason radios and
 * an optional ≤500-char note. Submit POSTs /api/reports/submit.
 *
 * Renders as a text-style button so the caller controls the
 * surrounding menu/dropdown. Pass `className` to style it like the
 * surrounding action items.
 */

const REASONS: Array<{ id: 'spam' | 'harassment' | 'fake' | 'inappropriate' | 'fraud' | 'other'; label: string }> = [
  { id: 'spam',         label: 'Spam ou contenu commercial' },
  { id: 'harassment',   label: 'Harcèlement / insultes' },
  { id: 'fake',         label: 'Faux profil / fausse info' },
  { id: 'inappropriate',label: 'Contenu inapproprié' },
  { id: 'fraud',        label: 'Fraude / arnaque' },
  { id: 'other',        label: 'Autre' },
];

interface Props {
  targetKind: 'user' | 'post' | 'reel' | 'story' | 'ad' | 'comment';
  targetId: string;
  /* Required when targetKind === 'comment' — the parent post id so
     admins can locate the comment for removal without a side-channel
     lookup. */
  parentId?: string;
  className?: string;
  label?: string;
}

export default function ReportButton({ targetKind, targetId, parentId, className, label = 'Signaler' }: Props) {
  const requireAuth = useRequireAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<typeof REASONS[number]['id'] | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!reason) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/reports/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          targetKind, targetId, reason,
          parentId: targetKind === 'comment' ? parentId : undefined,
          note: note.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast('❌ ' + (j.message ?? 'Erreur'));
      } else {
        toast('🚩 Signalement envoyé');
        setOpen(false);
        setReason(null);
        setNote('');
      }
    } catch {
      toast('❌ Erreur réseau');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => requireAuth(() => setOpen(true), 'signaler')}
        className={className}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text2)', fontSize: '.78rem',
          padding: '4px 8px',
        }}
      >
        🚩 {label}
      </button>

      {open && (
        <div
          className="modal-bg on"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div className="modal-box" style={{ maxWidth: 440, padding: 22 }}>
            <div className="modal-header">
              <div className="modal-title">🚩 Signaler ce contenu</div>
              <button className="modal-close" onClick={() => setOpen(false)} aria-label="Fermer">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div style={{ fontSize: '.82rem', color: 'var(--text2)', marginBottom: 12 }}>
              Pourquoi signalez-vous ce contenu ?
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
              {REASONS.map(r => (
                <label
                  key={r.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 10px',
                    background: reason === r.id ? 'var(--b50)' : 'var(--surface)',
                    border: `1px solid ${reason === r.id ? 'var(--b300)' : 'var(--border)'}`,
                    borderRadius: 'var(--rx)',
                    cursor: 'pointer',
                    fontSize: '.84rem',
                    color: 'var(--text)',
                  }}
                >
                  <input
                    type="radio"
                    name="report-reason"
                    checked={reason === r.id}
                    onChange={() => setReason(r.id)}
                    style={{ accentColor: 'var(--b500)' }}
                  />
                  {r.label}
                </label>
              ))}
            </div>

            <textarea
              value={note}
              onChange={e => setNote(e.target.value.slice(0, 500))}
              placeholder="Détails (facultatif)"
              rows={3}
              maxLength={500}
              style={{
                width: '100%', padding: 8,
                border: '1.5px solid var(--border2)', borderRadius: 'var(--rx)',
                background: 'var(--surface)', color: 'var(--text)',
                fontSize: '.85rem', fontFamily: 'inherit', resize: 'vertical',
                marginBottom: 4,
              }}
            />
            <div style={{ fontSize: '.7rem', color: 'var(--text3)', textAlign: 'right', marginBottom: 12 }}>
              {note.length} / 500
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-outline" onClick={() => setOpen(false)} disabled={submitting} style={{ flex: 1, justifyContent: 'center' }}>
                Annuler
              </button>
              <button
                className="btn-primary"
                onClick={submit}
                disabled={!reason || submitting}
                style={{ flex: 2, justifyContent: 'center' }}
              >
                {submitting ? 'Envoi…' : 'Envoyer le signalement'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
