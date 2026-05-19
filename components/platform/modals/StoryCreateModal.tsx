'use client';

import { useEffect, useRef, useState } from 'react';
import { useT } from '@/lib/useT';
import { auth, storage } from '@/lib/firebase';
import { ref as storageRef, uploadBytes } from 'firebase/storage';

/**
 * Story creator. Opens via `document.getElementById('story-create-modal').classList.add('on')`
 * — same pattern as the other platform modals.
 *
 * Two tabs:
 *   - "Photo": file picker (image only, 5 MB max) → uploads to
 *     /stories/{uid}/{ts}-{name} via Firebase Storage client SDK,
 *     then POSTs mediaPath to /api/stories/create.
 *   - "Texte": textarea (max 200 chars, live counter) + gradient
 *     swatch picker (5 presets) → POSTs text+gradient to the same
 *     endpoint.
 *
 * Errors surface inline; success closes the modal.
 */

const GRADIENTS = [
  'linear-gradient(135deg, #ff6b6b, #ffa15c)',           /* warm   */
  'linear-gradient(135deg, #29B6F6, #5C6BC0)',           /* maawa  */
  'linear-gradient(135deg, #2ecc71, #1abc9c)',           /* green  */
  'linear-gradient(135deg, #9b59b6, #34495e)',           /* purple */
  'linear-gradient(135deg, #f1c40f, #e67e22)',           /* gold   */
];

const closeModal = () => {
  if (typeof document === 'undefined') return;
  document.getElementById('story-create-modal')?.classList.remove('on');
};

export default function StoryCreateModal() {
  const t = useT();
  const [tab, setTab] = useState<'photo' | 'text'>('photo');

  /* photo state */
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  /* text state */
  const [text, setText] = useState('');
  const [gradient, setGradient] = useState(0);

  /* submit state */
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  /* reset on modal close (same MutationObserver pattern as the recharge modal) */
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const obs = new MutationObserver(() => {
      if (!el.classList.contains('on')) {
        setTab('photo');
        setPhotoFile(null);
        if (photoPreview) URL.revokeObjectURL(photoPreview);
        setPhotoPreview(null);
        setPhotoPath(null);
        setUploading(false);
        setText('');
        setGradient(0);
        setSubmitting(false);
        setError('');
      }
    });
    obs.observe(el, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, [photoPreview]);

  const onPhotoPick = async (file: File | null) => {
    setError('');
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(null);
    setPhotoPath(null);
    if (!file) { setPhotoFile(null); return; }
    if (!file.type.startsWith('image/')) {
      setError(t('story_err_image_only'));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError(t('story_err_too_big'));
      return;
    }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));

    if (!auth.currentUser) {
      setError(t('story_err_generic'));
      return;
    }
    setUploading(true);
    try {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
      const path = `stories/${auth.currentUser.uid}/${Date.now()}-${safe}`;
      const r = storageRef(storage, path);
      await uploadBytes(r, file, { contentType: file.type });
      setPhotoPath(path);
    } catch (err) {
      console.warn('story photo upload failed', err);
      setError(t('story_err_upload'));
      setPhotoFile(null);
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = async () => {
    setError('');
    if (!auth.currentUser) { setError(t('story_err_generic')); return; }

    let body: Record<string, unknown>;
    if (tab === 'photo') {
      if (!photoPath) { setError(t('story_err_pick_image')); return; }
      body = { kind: 'photo', mediaPath: photoPath };
    } else {
      const trimmed = text.trim();
      if (trimmed.length === 0 || trimmed.length > 200) {
        setError(t('story_err_text_length'));
        return;
      }
      body = { kind: 'text', text: trimmed, gradient };
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/stories/create', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.message || t('story_err_generic'));
        return;
      }
      closeModal();
    } catch {
      setError(t('story_err_generic'));
    } finally {
      setSubmitting(false);
    }
  };

  const textPreview = (
    <div style={{
      width: '100%', aspectRatio: '9/16', maxHeight: 320,
      borderRadius: 12, background: GRADIENTS[gradient],
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontFamily: "'Sora',sans-serif", fontWeight: 700,
      fontSize: '1.05rem', padding: 16, textAlign: 'center',
      lineHeight: 1.4, wordBreak: 'break-word',
    }}>
      {text || t('story_text_placeholder')}
    </div>
  );

  return (
    <div
      ref={rootRef}
      className="modal-bg"
      id="story-create-modal"
      onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
    >
      <div className="modal-box" style={{ maxWidth: 460, padding: 20 }}>
        <div className="modal-header">
          <div className="modal-title">✨ {t('story_create_title')}</div>
          <button className="modal-close" onClick={closeModal} aria-label={t('rch_close')}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 14, padding: 3, background: 'var(--surface2)', borderRadius: 'var(--rx)' }}>
          <button
            onClick={() => setTab('photo')}
            style={{
              flex: 1, padding: '7px 10px', border: 'none', borderRadius: 'var(--rx)',
              cursor: 'pointer', fontWeight: 600, fontSize: '.85rem',
              background: tab === 'photo' ? 'var(--surface)' : 'transparent',
              color: tab === 'photo' ? 'var(--text)' : 'var(--text2)',
              boxShadow: tab === 'photo' ? '0 1px 3px rgba(0,0,0,.06)' : 'none',
            }}
          >📷 {t('story_tab_photo')}</button>
          <button
            onClick={() => setTab('text')}
            style={{
              flex: 1, padding: '7px 10px', border: 'none', borderRadius: 'var(--rx)',
              cursor: 'pointer', fontWeight: 600, fontSize: '.85rem',
              background: tab === 'text' ? 'var(--surface)' : 'transparent',
              color: tab === 'text' ? 'var(--text)' : 'var(--text2)',
              boxShadow: tab === 'text' ? '0 1px 3px rgba(0,0,0,.06)' : 'none',
            }}
          >📝 {t('story_tab_text')}</button>
        </div>

        {tab === 'photo' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {photoPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photoPreview}
                alt="Aperçu"
                style={{ width: '100%', maxHeight: 320, objectFit: 'contain', borderRadius: 12, background: 'var(--surface2)' }}
              />
            ) : (
              <div style={{
                width: '100%', aspectRatio: '9/16', maxHeight: 320,
                borderRadius: 12, border: '2px dashed var(--border2)',
                background: 'var(--surface2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--text3)', fontSize: '.85rem',
              }}>
                {t('story_pick_image')}
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              onChange={e => onPhotoPick(e.target.files?.[0] ?? null)}
              disabled={uploading || submitting}
              style={{ fontSize: '.82rem', color: 'var(--text2)' }}
            />
            {uploading && <div style={{ fontSize: '.74rem', color: 'var(--text2)' }}>{t('rch_proof_uploading')}</div>}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {textPreview}
            <textarea
              value={text}
              onChange={e => setText(e.target.value.slice(0, 200))}
              placeholder={t('story_text_placeholder')}
              rows={3}
              maxLength={200}
              style={{
                width: '100%', padding: 10,
                border: '1.5px solid var(--border2)', borderRadius: 'var(--rx)',
                background: 'var(--surface)', color: 'var(--text)',
                fontSize: '.88rem', fontFamily: 'inherit', resize: 'vertical',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.72rem', color: 'var(--text3)' }}>
              <span>{t('story_gradient_label')}</span>
              <span>{text.length} / 200</span>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {GRADIENTS.map((g, i) => (
                <button
                  key={i}
                  aria-label={`Gradient ${i + 1}`}
                  onClick={() => setGradient(i)}
                  style={{
                    flex: 1, height: 36, borderRadius: 8,
                    background: g, cursor: 'pointer',
                    border: gradient === i ? '3px solid var(--b500)' : '3px solid transparent',
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="pf-error-banner" role="alert" style={{ marginTop: 12 }}>{error}</div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button className="btn-outline" onClick={closeModal} disabled={submitting} style={{ flex: 1, justifyContent: 'center' }}>
            {t('rch_cancel')}
          </button>
          <button
            className="btn-primary"
            onClick={onSubmit}
            disabled={submitting || uploading || (tab === 'photo' ? !photoPath : text.trim().length === 0)}
            style={{ flex: 2, justifyContent: 'center' }}
          >
            {submitting ? t('rch_submitting') : t('story_publish')}
          </button>
        </div>
      </div>
    </div>
  );
}
