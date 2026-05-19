'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { toast } from '@/lib/toast';
import { friendlyAuthError, type AuthErrorField } from '@/lib/auth-errors';

/**
 * Login screen.
 *
 * Error handling: Firebase errors are surfaced via {@link friendlyAuthError}.
 * If the error maps to a specific field ('email' | 'password'), that input
 * gets a red border + the message is rendered beneath it. Otherwise the
 * message appears in a red banner above the submit button.
 *
 * Editing any field clears the error state so the user isn't left looking
 * at stale red borders while they try again.
 */
export default function AuthLogin() {
  const router = useRouter();
  const [role, setRole] = useState<'client' | 'artisan'>('client');
  const [pwShown, setPwShown] = useState(false);
  const [pending, setPending] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  /* Error state: { field: which input is at fault, message: shown text } */
  const [errorField, setErrorField] = useState<AuthErrorField>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const clearError = () => {
    if (errorMsg) {
      setErrorField(null);
      setErrorMsg('');
    }
  };

  const handleEmail = (v: string) => { setEmail(v); clearError(); };
  const handlePassword = (v: string) => { setPassword(v); clearError(); };

  const doLogin = async () => {
    if (!email || !password) {
      /* Missing-input is a UI-level error, not a Firebase one. Flag whichever
         is empty (email takes precedence — matches Firebase's behaviour). */
      if (!email) {
        setErrorField('email');
        setErrorMsg('Veuillez saisir votre email');
      } else {
        setErrorField('password');
        setErrorMsg('Veuillez saisir votre mot de passe');
      }
      return;
    }
    setErrorField(null);
    setErrorMsg('');
    setPending(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push('/feed');
    } catch (err: unknown) {
      const { field, message } = friendlyAuthError(err);
      setErrorField(field ?? null);
      setErrorMsg(message);
    } finally {
      setPending(false);
    }
  };

  const doGoogleLogin = async () => {
    setErrorField(null);
    setErrorMsg('');
    setPending(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      router.push('/feed');
    } catch (err: unknown) {
      const { message } = friendlyAuthError(err);
      /* Google popup errors are never tied to email/password fields. */
      setErrorField(null);
      setErrorMsg(message);
    } finally {
      setPending(false);
    }
  };

  const emailErrCls = errorField === 'email' ? ' has-error' : '';
  const pwErrCls = errorField === 'password' ? ' has-error' : '';

  return (
    <div id="v-login" className="auth-card">
      <div className="ac-title" id="t-welcome">Bon retour 👋</div>
      <div className="ac-sub" id="t-login-sub">Connectez-vous à votre compte Maawa</div>
      <div className="ac-tabs">
        <div className={'ac-tab' + (role === 'client' ? ' on' : '')} id="tab-c" onClick={() => setRole('client')}>
          <span id="t-tab-client">👤 Client</span>
        </div>
        <div className={'ac-tab' + (role === 'artisan' ? ' on' : '')} id="tab-a" onClick={() => setRole('artisan')}>
          <span id="t-tab-artisan">🔧 Artisan</span>
        </div>
      </div>
      <div className="fgrp">
        <div className="fg">
          <label id="t-phone-lbl">Téléphone ou Email</label>
          <input
            className={'fi' + emailErrCls}
            type="text"
            placeholder="+213 6XX XXX XXX ou email@…"
            id="t-phone-ph"
            value={email}
            onChange={e => handleEmail(e.target.value)}
            aria-invalid={errorField === 'email'}
            aria-describedby={errorField === 'email' ? 'login-email-err' : undefined}
          />
          {errorField === 'email' && (
            <div id="login-email-err" className="field-error" role="alert">{errorMsg}</div>
          )}
        </div>
        <div className="fg">
          <label id="t-pw-lbl">Mot de passe</label>
          <div className="fi-wrap">
            <input
              className={'fi' + pwErrCls}
              id="pwl"
              type={pwShown ? 'text' : 'password'}
              placeholder="••••••••"
              value={password}
              onChange={e => handlePassword(e.target.value)}
              aria-invalid={errorField === 'password'}
              aria-describedby={errorField === 'password' ? 'login-pw-err' : undefined}
              onKeyDown={e => e.key === 'Enter' && doLogin()}
            />
            <button className="eye-btn" onClick={() => setPwShown(p => !p)} type="button" aria-label="Afficher ou masquer le mot de passe">👁</button>
          </div>
          {errorField === 'password' && (
            <div id="login-pw-err" className="field-error" role="alert">{errorMsg}</div>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          <a style={{ fontSize: '.74rem', color: 'rgba(255,255,255,.62)', cursor: 'pointer' }} id="t-forgot" onClick={() => router.push('/forgot-password')}>Mot de passe oublié ?</a>
        </div>
        {errorMsg && !errorField && (
          <div className="form-error-banner" role="alert">{errorMsg}</div>
        )}
        <button className="btn-auth" onClick={doLogin} disabled={pending}>
          {pending ? <span className="loader"></span> : <span id="t-btn-signin">Se connecter</span>}
        </button>
      </div>
      <div className="divider" style={{ margin: '10px 0' }}><span id="t-or2">ou</span></div>
      <div className="soc-row">
        <button className="soc-btn" onClick={doGoogleLogin} disabled={pending}>
          <svg width="14" height="14" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          <span id="t-google">Google</span>
        </button>
        <button className="soc-btn" onClick={() => toast('Facebook non configuré')} disabled={pending}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
          </svg>
          <span id="t-facebook">Facebook</span>
        </button>
      </div>
      <div className="ac-sw">
        <span id="t-no-acct">Pas de compte ?</span>{' '}
        <a id="t-signup-link" onClick={() => router.push('/register')}>S&apos;inscrire</a>
      </div>
      <div className="ac-back">
        <a id="t-back-land" onClick={() => router.push('/')}>← Retour à l&apos;accueil</a>
      </div>
    </div>
  );
}
