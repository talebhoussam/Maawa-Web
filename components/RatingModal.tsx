'use client';

import { useState } from 'react';
import { toast } from '@/lib/toast';

/**
 * RatingModal — 1..5 stars + optional 500-char comment, POSTs to
 * /api/ratings/submit. Used after a mission is `terminee` by both
 * the client (rates artisan) and the artisan (rates client).
 *
 * Render-prop pattern: parent owns open state, supplies missionId
 * and peer label. The modal handles the API call + closes itself on
 * success. Errors stay inline.
 */

interface Props {
  missionId: string;
  peerLabel: string;       /* "Karim Plombier", or "votre client" */
  onClose: () => void;
  onSuccess?: () => void;
}

export default function RatingModal({ missionId, peerLabel, onClose, onSuccess }: Props) {
  const [stars, setStars] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    if (stars < 1 || stars > 5) {
      setError('Veuillez choisir une note de 1 à 5 étoiles.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/ratings/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          missionId, stars,
          comment: comment.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.message ?? 'Erreur lors de l\'envoi.');
        return;
      }
      toast('⭐ Évaluation envoyée');
      onSuccess?.();
      onClose();
    } catch {
      setError('Erreur réseau');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="modal-bg on"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal-box" style={{ maxWidth: 440, padding: 22 }}>
        <div className="modal-header">
          <div className="modal-title">⭐ Évaluer {peerLabel}</div>
          <button className="modal-close" onClick={onClose} aria-label="Fermer">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div style={{ fontSize: '.85rem', color: 'var(--text2)', marginBottom: 14 }}>
          Comment s&apos;est passée la mission ?
        </div>

        {/* Star rating row */}
        <div
          style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 14 }}
          onMouseLeave={() => setHover(0)}
        >
          {[1, 2, 3, 4, 5].map(n => {
            const active = (hover || stars) >= n;
            return (
              <button
                key={n}
                type="button"
                onClick={() => setStars(n)}
                onMouseEnter={() => setHover(n)}
                aria-label={`${n} étoile${n > 1 ? 's' : ''}`}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: '2rem',
                  filter: active ? 'none' : 'grayscale(1) opacity(.4)',
                  transition: 'transform .1s, filter .15s',
                  padding: 2,
                }}
              >
                ⭐
              </button>
            );
          })}
        </div>

        <textarea
          value={comment}
          onChange={e => setComment(e.target.value.slice(0, 500))}
          placeholder="Commentaire (facultatif)"
          rows={3}
          maxLength={500}
          style={{
            width: '100%', padding: 9,
            border: '1.5px solid var(--border2)', borderRadius: 'var(--rx)',
            background: 'var(--surface)', color: 'var(--text)',
            fontSize: '.86rem', fontFamily: 'inherit', resize: 'vertical',
          }}
        />
        <div style={{ fontSize: '.7rem', color: 'var(--text3)', textAlign: 'right', marginTop: 4 }}>
          {comment.length} / 500
        </div>

        {error && (
          <div className="pf-error-banner" role="alert" style={{ marginTop: 8 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button className="btn-outline" onClick={onClose} disabled={submitting} style={{ flex: 1, justifyContent: 'center' }}>
            Plus tard
          </button>
          <button
            className="btn-primary"
            onClick={submit}
            disabled={submitting || stars < 1}
            style={{ flex: 2, justifyContent: 'center' }}
          >
            {submitting ? 'Envoi…' : 'Envoyer'}
          </button>
        </div>
      </div>
    </div>
  );
}
