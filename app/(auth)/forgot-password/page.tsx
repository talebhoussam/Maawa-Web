'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { sendPasswordResetEmail } from 'firebase/auth';
import { friendlyAuthError, type AuthErrorField } from '@/lib/auth-errors';

/**
 * "Forgot password" flow — sends a Firebase Auth password-reset email.
 *
 * Error handling follows the same pattern as /login and /register:
 *   - field-targeted errors (auth/invalid-email, auth/user-not-found) put
 *     a red border on the email input + inline message
 *   - other errors (network, throttling) appear in a banner above submit
 *   - any keystroke clears the error
 */
export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  const [errorField, setErrorField] = useState<AuthErrorField>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const handleEmail = (v: string) => {
    setEmail(v);
    if (errorMsg) {
      setErrorField(null);
      setErrorMsg('');
    }
  };

  const handleReset = async () => {
    if (!email) {
      setErrorField('email');
      setErrorMsg('Veuillez saisir votre email');
      return;
    }
    setErrorField(null);
    setErrorMsg('');
    setPending(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setSent(true);
    } catch (err: unknown) {
      const { field, message } = friendlyAuthError(err);
      setErrorField(field ?? null);
      setErrorMsg(message);
    } finally {
      setPending(false);
    }
  };

  const emailErrCls = errorField === 'email' ? ' has-error' : '';

  return (
    <div id="v-forgot" className="auth-card">
      {sent ? (
        <>
          <div style={{ fontSize: '3rem', textAlign: 'center', marginBottom: '10px' }}>📬</div>
          <div className="ac-title">Email envoyé !</div>
          <div className="ac-sub" style={{ textAlign: 'center' }}>
            Un lien de réinitialisation a été envoyé à<br />
            <strong style={{ color: '#fff' }}>{email}</strong>
          </div>
          <button className="btn-auth" style={{ marginTop: '20px' }} onClick={() => router.push('/login')}>
            <span>Retour à la connexion</span>
          </button>
        </>
      ) : (
        <>
          <div className="ac-title">Mot de passe oublié 🔑</div>
          <div className="ac-sub">Entrez votre email et nous vous enverrons un lien de réinitialisation</div>
          <div className="fgrp" style={{ marginTop: '20px' }}>
            <div className="fg">
              <label>Email</label>
              <input
                className={'fi' + emailErrCls}
                type="email"
                placeholder="email@exemple.com"
                value={email}
                onChange={e => handleEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleReset()}
                aria-invalid={errorField === 'email'}
                aria-describedby={errorField === 'email' ? 'fp-email-err' : undefined}
              />
              {errorField === 'email' && (
                <div id="fp-email-err" className="field-error" role="alert">{errorMsg}</div>
              )}
            </div>
            {errorMsg && !errorField && (
              <div className="form-error-banner" role="alert">{errorMsg}</div>
            )}
            <button className="btn-auth" onClick={handleReset} disabled={pending}>
              {pending ? <span className="loader"></span> : <span>Envoyer le lien</span>}
            </button>
          </div>
          <div className="ac-back">
            <a onClick={() => router.push('/login')}>← Retour à la connexion</a>
          </div>
        </>
      )}
    </div>
  );
}
