'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from 'firebase/auth';
import { toast } from '@/lib/toast';
import { friendlyAuthError, type AuthErrorField } from '@/lib/auth-errors';

/**
 * Password-change flow.
 *
 * Two Firebase calls in sequence:
 *   1. reauthenticateWithCredential(currentPassword) — required before
 *      sensitive operations. Surfaces 'auth/wrong-password' /
 *      'auth/invalid-credential' as a 'currentPassword' field error.
 *   2. updatePassword(newPassword) — may itself throw
 *      'auth/weak-password' or 'auth/requires-recent-login'.
 *
 * All errors funnel through {@link friendlyAuthError} so the UX matches
 * the auth pages exactly: red border on the offending field, inline
 * message, banner for non-field errors, clears on edit.
 *
 * Field name `currentPassword` and `newPassword` are local to this page —
 * we don't reuse the auth-errors module's typed 'password' field because
 * we need to distinguish which of the two password inputs is at fault.
 */

type LocalField = 'currentPassword' | 'newPassword' | 'confirmPassword' | null;

export default function ChangePasswordPage() {
  const router = useRouter();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState(false);

  const [errorField, setErrorField] = useState<LocalField>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const clearError = () => {
    if (errorMsg) {
      setErrorField(null);
      setErrorMsg('');
    }
  };

  /* Map a firebase `password` field hint onto our two password inputs.
     Step 1 = currentPassword wrong; step 2 = newPassword weak. The caller
     tells us which call failed via `phase`. */
  const setAuthError = (err: unknown, phase: 'reauth' | 'update') => {
    const { field, message } = friendlyAuthError(err);
    let local: LocalField = null;
    if (field === 'password') {
      local = phase === 'reauth' ? 'currentPassword' : 'newPassword';
    }
    setErrorField(local);
    setErrorMsg(message);
  };

  const submit = async () => {
    if (!auth.currentUser || !auth.currentUser.email) {
      setErrorField(null);
      setErrorMsg('Session expirée. Veuillez vous reconnecter.');
      return;
    }
    if (!currentPassword) {
      setErrorField('currentPassword');
      setErrorMsg('Veuillez saisir votre mot de passe actuel');
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      setErrorField('newPassword');
      setErrorMsg('Mot de passe trop faible (minimum 8 caractères)');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorField('confirmPassword');
      setErrorMsg('Les mots de passe ne correspondent pas');
      return;
    }
    if (newPassword === currentPassword) {
      setErrorField('newPassword');
      setErrorMsg('Le nouveau mot de passe doit être différent de l\'actuel');
      return;
    }

    setErrorField(null);
    setErrorMsg('');
    setPending(true);

    try {
      const cred = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
      try {
        await reauthenticateWithCredential(auth.currentUser, cred);
      } catch (err: unknown) {
        setAuthError(err, 'reauth');
        return;
      }
      try {
        await updatePassword(auth.currentUser, newPassword);
      } catch (err: unknown) {
        setAuthError(err, 'update');
        return;
      }
      setSuccess(true);
      toast('✅ Mot de passe modifié avec succès');
      /* Wait a moment so the toast/success state is visible. */
      setTimeout(() => router.push('/settings'), 1200);
    } finally {
      setPending(false);
    }
  };

  const cls = (f: LocalField) => 'pf-fi' + (errorField === f ? ' has-error' : '');

  if (success) {
    return (
      <div className="screen on" id="s-pw-change">
        <div style={{ maxWidth: 460, margin: '20px auto 0' }}>
          <div className="card" style={{ padding: 24, textAlign: 'center' }}>
            <div style={{ fontSize: '2.6rem', marginBottom: 8 }}>✅</div>
            <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: '1.1rem', color: 'var(--text)', marginBottom: 4 }}>
              Mot de passe modifié
            </div>
            <div style={{ fontSize: '.84rem', color: 'var(--text2)' }}>
              Redirection en cours…
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="screen on" id="s-pw-change">
      <div style={{ maxWidth: 460, margin: '0 auto' }}>
        <div className="pg-title au">🔐 Changer mon mot de passe</div>
        <div className="pg-sub au" style={{ color: 'var(--text2)', fontSize: '.84rem', marginBottom: 16 }}>
          Pour votre sécurité, nous demanderons votre mot de passe actuel avant tout changement.
        </div>

        <div className="card au1" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="pf-fg">
            <label htmlFor="pw-current">Mot de passe actuel</label>
            <div className="pf-fi-wrap">
              <input
                id="pw-current"
                className={cls('currentPassword')}
                type={showCurrent ? 'text' : 'password'}
                placeholder="••••••••"
                value={currentPassword}
                onChange={e => { setCurrentPassword(e.target.value); clearError(); }}
                autoComplete="current-password"
                aria-invalid={errorField === 'currentPassword'}
                aria-describedby={errorField === 'currentPassword' ? 'pw-current-err' : undefined}
              />
              <button type="button" className="pf-eye-btn" aria-label="Afficher ou masquer le mot de passe actuel" onClick={() => setShowCurrent(s => !s)}>
                {showCurrent ? '🙈' : '👁'}
              </button>
            </div>
            {errorField === 'currentPassword' && (
              <div id="pw-current-err" className="pf-field-error" role="alert">{errorMsg}</div>
            )}
          </div>

          <div className="pf-fg">
            <label htmlFor="pw-new">Nouveau mot de passe</label>
            <div className="pf-fi-wrap">
              <input
                id="pw-new"
                className={cls('newPassword')}
                type={showNew ? 'text' : 'password'}
                placeholder="Minimum 8 caractères"
                value={newPassword}
                onChange={e => { setNewPassword(e.target.value); clearError(); }}
                autoComplete="new-password"
                aria-invalid={errorField === 'newPassword'}
                aria-describedby={errorField === 'newPassword' ? 'pw-new-err' : undefined}
              />
              <button type="button" className="pf-eye-btn" aria-label="Afficher ou masquer le nouveau mot de passe" onClick={() => setShowNew(s => !s)}>
                {showNew ? '🙈' : '👁'}
              </button>
            </div>
            {errorField === 'newPassword' && (
              <div id="pw-new-err" className="pf-field-error" role="alert">{errorMsg}</div>
            )}
          </div>

          <div className="pf-fg">
            <label htmlFor="pw-confirm">Confirmer le nouveau mot de passe</label>
            <input
              id="pw-confirm"
              className={cls('confirmPassword')}
              type={showNew ? 'text' : 'password'}
              placeholder="Retaper le nouveau mot de passe"
              value={confirmPassword}
              onChange={e => { setConfirmPassword(e.target.value); clearError(); }}
              onKeyDown={e => e.key === 'Enter' && submit()}
              autoComplete="new-password"
              aria-invalid={errorField === 'confirmPassword'}
              aria-describedby={errorField === 'confirmPassword' ? 'pw-confirm-err' : undefined}
            />
            {errorField === 'confirmPassword' && (
              <div id="pw-confirm-err" className="pf-field-error" role="alert">{errorMsg}</div>
            )}
          </div>

          {errorMsg && !errorField && (
            <div className="pf-error-banner" role="alert">{errorMsg}</div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button
              className="btn-primary"
              onClick={submit}
              disabled={pending}
              style={{ flex: 1, justifyContent: 'center' }}
            >
              {pending ? '...' : '✅ Modifier mon mot de passe'}
            </button>
            <button
              type="button"
              className="btn-outline"
              onClick={() => router.push('/settings')}
              disabled={pending}
            >
              Annuler
            </button>
          </div>
        </div>

        <div style={{ marginTop: 12, fontSize: '.74rem', color: 'var(--text3)', lineHeight: 1.5 }}>
          Conseil : utilisez un mot de passe d&apos;au moins 12 caractères mêlant lettres,
          chiffres et symboles. Évitez les informations personnelles (date de naissance,
          nom, etc.).
        </div>
      </div>
    </div>
  );
}
