'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@/lib/toast';
import { auth, storage } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';

/**
 * /artisan/reels/new — publish a reel.
 *
 * Flow:
 *   1. Pick a video file (mp4 / mov / webm, ≤ 50 MB).
 *   2. We grab a poster frame client-side via a hidden <video> + canvas
 *      and upload it as a sibling image. This avoids an extra "pick a
 *      thumbnail" step and gives the feed card something to show while
 *      the video is buffering.
 *   3. Upload video → upload poster → POST /api/reels/create.
 *   4. Route to /reels so the user can confirm their reel plays.
 *
 * Errors surface inline rather than via toast.
 *
 * The page is gated by /artisan/layout.tsx (role:'artisan' only) and
 * by middleware (signed-in only).
 */

const MAX_VIDEO_MB = 50;
const ALLOWED_VIDEO = ['video/mp4', 'video/quicktime', 'video/webm'];

function safeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
}

/**
 * Grab a frame from a video file as a JPEG blob. Returns null if the
 * browser can't render the video (rare). We seek to 1s — the first
 * frame is often black.
 */
async function captureFirstFrame(file: File): Promise<Blob | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.muted = true;
    v.playsInline = true;
    v.preload = 'metadata';
    v.src = url;

    const cleanup = () => {
      URL.revokeObjectURL(url);
      v.remove();
    };

    v.addEventListener('loadedmetadata', () => {
      /* Seek a bit in to avoid black opening frames; clamp to video
         length so super-short clips still work. */
      v.currentTime = Math.min(1.0, Math.max(0, v.duration / 4));
    });
    v.addEventListener('seeked', () => {
      const canvas = document.createElement('canvas');
      canvas.width  = Math.min(720, v.videoWidth || 720);
      canvas.height = Math.round((canvas.width * (v.videoHeight || 1280)) / (v.videoWidth || 720));
      const ctx = canvas.getContext('2d');
      if (!ctx) { cleanup(); resolve(null); return; }
      ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        cleanup();
        resolve(blob);
      }, 'image/jpeg', 0.82);
    });
    v.addEventListener('error', () => {
      cleanup();
      resolve(null);
    });
  });
}

export default function ReelCreatePage() {
  const router = useRouter();
  const [uid, setUid] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [progress, setProgress] = useState<'idle' | 'capturing' | 'uploading_video' | 'uploading_poster' | 'creating'>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => onAuthStateChanged(auth, u => setUid(u?.uid ?? null)), []);
  /* Revoke the object URL when the picked file changes / component
     unmounts so we don't leak. */
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const onPick = (f: File | null) => {
    setError('');
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    if (!f) { setFile(null); return; }
    if (!ALLOWED_VIDEO.includes(f.type)) {
      setError('Format non supporté. Utilisez MP4, MOV ou WebM.');
      return;
    }
    if (f.size > MAX_VIDEO_MB * 1024 * 1024) {
      setError(`Vidéo trop volumineuse (max ${MAX_VIDEO_MB} MB).`);
      return;
    }
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
  };

  const submit = async () => {
    if (!file || !uid) return;
    setError('');

    try {
      /* 1. Capture poster client-side. */
      setProgress('capturing');
      const posterBlob = await captureFirstFrame(file);

      /* 2. Upload video. */
      setProgress('uploading_video');
      const ts = Date.now();
      const videoPath = `reels/${uid}/${ts}-${safeFileName(file.name)}`;
      await uploadBytes(storageRef(storage, videoPath), file, { contentType: file.type });

      /* 3. Upload poster (best effort — failure isn't fatal). */
      let posterPath: string | null = null;
      if (posterBlob) {
        setProgress('uploading_poster');
        posterPath = `reels/${uid}/${ts}-poster.jpg`;
        try {
          await uploadBytes(storageRef(storage, posterPath), posterBlob, { contentType: 'image/jpeg' });
        } catch (err) {
          console.warn('poster upload failed', err);
          posterPath = null; /* server will accept null */
        }
      }

      /* 4. Create the feed_posts doc. */
      setProgress('creating');
      const res = await fetch('/api/reels/create', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          videoPath,
          posterPath,
          title:       title.trim() || undefined,
          description: description.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.message ?? 'Erreur lors de la publication.');
        setProgress('idle');
        return;
      }

      toast('✅ Reel publié !');
      router.push('/reels');
    } catch (err) {
      console.error('reel publish failed', err);
      setError('Échec de l\'envoi. Réessayez.');
      setProgress('idle');
    }
  };

  const busy = progress !== 'idle';
  const progressLabel: Record<typeof progress, string> = {
    idle:             'Publier',
    capturing:        'Préparation de la miniature…',
    uploading_video:  'Téléversement de la vidéo…',
    uploading_poster: 'Téléversement de la miniature…',
    creating:         'Publication…',
  };

  return (
    <div className="screen on" id="s-artisan-reel-new">
      <div className="page-title-row au">
        <div>
          <div className="pt-head">🎬 Nouveau Reel</div>
          <div className="pt-sub">Partagez une vidéo de votre travail (max {MAX_VIDEO_MB} MB)</div>
        </div>
      </div>

      <div className="card au1" style={{ padding: 16 }}>
        {/* Preview area */}
        {previewUrl ? (
          <video
            src={previewUrl}
            controls
            playsInline
            style={{
              width: '100%',
              maxHeight: 460,
              borderRadius: 12,
              background: '#000',
              marginBottom: 14,
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
            style={{
              width: '100%', aspectRatio: '9/16', maxHeight: 460,
              borderRadius: 12,
              border: '2px dashed var(--border2)',
              background: 'var(--surface2)',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: 8, cursor: 'pointer',
              color: 'var(--text2)', fontSize: '.9rem',
              marginBottom: 14,
            }}
          >
            <div style={{ fontSize: '2.4rem' }}>🎥</div>
            <div>Cliquez pour choisir une vidéo</div>
            <div style={{ fontSize: '.74rem', color: 'var(--text3)' }}>
              MP4 · MOV · WebM — max {MAX_VIDEO_MB} MB
            </div>
          </button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept={ALLOWED_VIDEO.join(',')}
          style={{ display: 'none' }}
          onChange={(e) => onPick(e.target.files?.[0] ?? null)}
        />

        {previewUrl && (
          <button
            type="button"
            className="btn-outline sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
            style={{ marginBottom: 14 }}
          >
            Changer de vidéo
          </button>
        )}

        {/* Title */}
        <label style={{ display: 'block', fontSize: '.78rem', fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
          Titre (facultatif)
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value.slice(0, 120))}
          placeholder="Ex. Installation chaudière à Hydra"
          disabled={busy}
          maxLength={120}
          style={{
            width: '100%', padding: 9,
            border: '1.5px solid var(--border2)', borderRadius: 'var(--rx)',
            background: 'var(--surface)', color: 'var(--text)',
            fontSize: '.88rem', marginBottom: 12,
          }}
        />

        {/* Description */}
        <label style={{ display: 'block', fontSize: '.78rem', fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
          Description (facultatif)
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, 2000))}
          placeholder="Décrivez la prestation, le matériel, la durée…"
          rows={4}
          maxLength={2000}
          disabled={busy}
          style={{
            width: '100%', padding: 9,
            border: '1.5px solid var(--border2)', borderRadius: 'var(--rx)',
            background: 'var(--surface)', color: 'var(--text)',
            fontSize: '.88rem', resize: 'vertical', fontFamily: 'inherit',
          }}
        />
        <div style={{ fontSize: '.7rem', color: 'var(--text3)', textAlign: 'right', margin: '4px 0 14px' }}>
          {description.length} / 2000
        </div>

        {error && (
          <div className="pf-error-banner" role="alert" style={{ marginBottom: 12 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn-outline"
            onClick={() => router.push('/reels')}
            disabled={busy}
            style={{ flex: 1, justifyContent: 'center' }}
          >
            Annuler
          </button>
          <button
            className="btn-primary"
            onClick={submit}
            disabled={!file || busy}
            style={{ flex: 2, justifyContent: 'center' }}
          >
            {progressLabel[progress]}
          </button>
        </div>
      </div>
    </div>
  );
}
