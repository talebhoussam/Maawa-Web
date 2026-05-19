'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';

/**
 * ConnectOrCallModal + useRequireAuth — guest-mode action gate.
 *
 * The model: every interactive action (like, comment, follow, book,
 * message, add-story…) wraps itself in `useRequireAuth()`. The hook
 * checks the current auth state and either runs the action OR opens
 * this modal asking the visitor to register / log in / call Maawa.
 *
 * The modal is mounted once at the platform-layout level and listens
 * for a CustomEvent. Decoupling the trigger from the modal element
 * means any deeply nested handler can fire it without prop drilling.
 *
 * Triggers carry an optional `action` verb so the title can read
 * "Connectez-vous pour {action}" — "aimer", "réserver", etc.
 *
 * Phase 6 — replaces the toast stubs scattered through reels +
 * other guest-touchable surfaces.
 */

const EVENT = 'maawa:require-auth';

interface RequireAuthDetail {
  action?: string; /* e.g. "aimer", "commenter", "réserver" */
}

export function openConnectModal(action?: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<RequireAuthDetail>(EVENT, { detail: { action } }));
}

/**
 * useRequireAuth() — wrap any action that requires an authenticated user.
 *
 * Usage:
 *   const requireAuth = useRequireAuth();
 *   <button onClick={() => requireAuth(() => doLike(), 'aimer')}>♥</button>
 *
 * If the user is signed in, the action runs immediately. Otherwise the
 * ConnectOrCallModal opens with a context-specific title.
 */
export function useRequireAuth() {
  const [uid, setUid] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => onAuthStateChanged(auth, u => {
    setUid(u?.uid ?? null);
    setReady(true);
  }), []);

  return (action: () => void | Promise<void>, label?: string) => {
    /* If auth hasn't initialised yet (cold load), be safe and prompt —
       we'd rather show one extra modal than fire an action under a
       phantom guest. */
    if (!ready || !uid) {
      openConnectModal(label);
      return;
    }
    void action();
  };
}

/**
 * The modal itself. Mount once in the platform layout. Listens for the
 * `maawa:require-auth` event and shows itself with the right title.
 */
export default function ConnectOrCallModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [actionLabel, setActionLabel] = useState<string | undefined>(undefined);

  useEffect(() => {
    const onEvent = (e: Event) => {
      const detail = (e as CustomEvent<RequireAuthDetail>).detail;
      setActionLabel(detail?.action);
      setOpen(true);
    };
    window.addEventListener(EVENT, onEvent);
    return () => window.removeEventListener(EVENT, onEvent);
  }, []);

  if (!open) return null;

  const supportPhone = process.env.NEXT_PUBLIC_SUPPORT_PHONE || '+213233000000';
  const title = actionLabel
    ? `Connectez-vous pour ${actionLabel}`
    : 'Connectez-vous pour continuer';

  const onCall = () => {
    window.location.href = `tel:${supportPhone}`;
  };

  return (
    <div
      className="modal-bg on"
      onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
    >
      <div className="modal-box" style={{ maxWidth: 420, padding: 22 }}>
        <div className="modal-header">
          <div className="modal-title">{title}</div>
          <button className="modal-close" onClick={() => setOpen(false)} aria-label="Fermer">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div style={{ fontSize: '.86rem', color: 'var(--text2)', lineHeight: 1.55, marginBottom: 16 }}>
          Créez un compte gratuit pour interagir avec les artisans, ou appelez Maawa directement — un agent vous aidera.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            className="btn-primary"
            style={{ justifyContent: 'center' }}
            onClick={() => { setOpen(false); router.push('/register'); }}
          >
            ✨ Créer un compte gratuit
          </button>
          <button
            className="btn-outline"
            style={{ justifyContent: 'center' }}
            onClick={() => { setOpen(false); router.push('/login'); }}
          >
            Se connecter
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0' }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            <span style={{ fontSize: '.7rem', color: 'var(--text3)' }}>ou</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>
          <button
            className="btn-outline"
            style={{ justifyContent: 'center', borderColor: 'var(--gn)', color: 'var(--gn)' }}
            onClick={onCall}
          >
            📞 Appeler Maawa
          </button>
        </div>
      </div>
    </div>
  );
}
