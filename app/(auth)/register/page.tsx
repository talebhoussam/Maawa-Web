'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@/lib/toast';
import { auth } from '@/lib/firebase';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { friendlyAuthError, type AuthErrorField } from '@/lib/auth-errors';
import { WILAYAS, displayLabel } from '@/lib/wilayas';

/**
 * Three-step registration:
 *   1. Personal info + Firebase Auth user creation
 *   2. SMS OTP (UI only — real Twilio flow lives behind a feature flag,
 *      see lib/env.ts `twilioConfigured`. When disabled, the OTP step
 *      is a placeholder; users can advance with any 6 digits.)
 *   3. NIN upload (artisans) / done (clients) + server-side profile create
 *
 * Note: `role` here is the user's INTENT. The server always creates the
 * Firestore doc with `role: 'client'`. An artisan-intent user is routed
 * to /apply after Step 3 for the actual verification flow.
 *
 * Errors from Firebase Auth are surfaced via {@link friendlyAuthError}:
 * matching field gets a red border + inline message; other errors render
 * as a banner above the submit button. Editing any field clears the
 * error state.
 *
 * Referral code (parrainage) was removed in Phase 1. Do not re-introduce
 * it without a product decision — it had no server-side use.
 */
export default function AuthRegister() {
  const router = useRouter();
  const [role, setRole] = useState<'client' | 'artisan'>('client');
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [pwShown, setPwShown] = useState(false);
  const [pending, setPending] = useState(false);

  // Form fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [wilaya, setWilaya] = useState('');
  const [trade, setTrade] = useState('');
  const [experience, setExperience] = useState('');

  // Error state — shared across steps. `field` is one of our auth-fields
  // ('email', 'password', 'phone') OR a step-1-specific synthetic value
  // ('firstName' | 'wilaya') flagged by local validation.
  type LocalField = AuthErrorField | 'firstName' | 'wilaya' | null;
  const [errorField, setErrorField] = useState<LocalField>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // OTP timer (Step 2)
  const [otpSec, setOtpSec] = useState(59);
  const otpIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (step === 2) {
      setOtpSec(59);
      otpIntervalRef.current = setInterval(() => {
        setOtpSec(s => (s > 0 ? s - 1 : 0));
      }, 1000);
      return () => {
        if (otpIntervalRef.current) clearInterval(otpIntervalRef.current);
      };
    }
  }, [step]);

  const clearError = () => {
    if (errorMsg) {
      setErrorField(null);
      setErrorMsg('');
    }
  };

  const bind = <T,>(setter: (v: T) => void) => (v: T) => { setter(v); clearError(); };

  // OTP boxes auto-advance to next
  const otpNext = (e: React.FormEvent<HTMLInputElement>) => {
    const el = e.currentTarget;
    if (el.value.length === 1) {
      const next = el.nextElementSibling as HTMLInputElement | null;
      if (next && next.classList.contains('otp-i')) next.focus();
    }
  };

  // Step 1 → Step 2: Create Firebase user
  const handleStep1 = async () => {
    // Local validation first: required fields per the original UI
    if (!firstName) {
      setErrorField('firstName');
      setErrorMsg('Veuillez saisir votre prénom');
      return;
    }
    if (!email) {
      setErrorField('email');
      setErrorMsg('Veuillez saisir votre email');
      return;
    }
    if (!password) {
      setErrorField('password');
      setErrorMsg('Veuillez saisir un mot de passe');
      return;
    }
    if (password.length < 8) {
      setErrorField('password');
      setErrorMsg('Mot de passe trop faible (minimum 8 caractères)');
      return;
    }
    if (!wilaya) {
      setErrorField('wilaya');
      setErrorMsg('Veuillez sélectionner votre wilaya');
      return;
    }
    setErrorField(null);
    setErrorMsg('');
    setPending(true);
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, {
          displayName: `${firstName} ${lastName}`.trim(),
        });
      }
      setStep(2);
    } catch (err: unknown) {
      const { field, message } = friendlyAuthError(err);
      setErrorField(field ?? null);
      setErrorMsg(message);
    } finally {
      setPending(false);
    }
  };

  // Step 3: Save profile via the server (which validates + sets role='client'
  // regardless of intent). If the user picked 'artisan', after profile
  // creation we route them to /apply for the verification flow.
  const finishReg = async () => {
    if (!auth.currentUser) {
      toast('Session expirée. Veuillez recommencer.');
      router.push('/register');
      return;
    }
    setPending(true);
    try {
      /* Force a fresh ID token so the server-side session-login (run
         from AuthProvider) has the latest auth_time. */
      await auth.currentUser.getIdToken(true);

      const res = await fetch('/api/me/register-profile', {
        method:  'POST',
        headers: { 'content-type': 'application/json' },
        body:    JSON.stringify({
          firstName,
          lastName,
          phone:  phone || undefined,
          wilaya,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg = typeof data?.message === 'string' ? data.message : 'Erreur création profil';
        setErrorField(null);
        setErrorMsg(msg);
        return;
      }
      toast('🎉 Compte créé avec succès !');
      router.push(role === 'artisan' ? '/apply' : '/feed');
    } catch (err: unknown) {
      const { message } = friendlyAuthError(err);
      setErrorField(null);
      setErrorMsg(message);
    } finally {
      setPending(false);
    }
  };

  const progPct = step === 1 ? '33%' : step === 2 ? '66%' : '100%';
  const cls = (field: LocalField) => errorField === field ? ' has-error' : '';
  const selCls = (field: LocalField) => errorField === field ? 'fsel has-error' : 'fsel';

  return (
    <div id="v-reg" className="auth-card">
      <div className="ac-title" id="t-reg-title">Créer un compte 🚀</div>
      <div className="ac-sub" id="t-reg-sub">Rejoignez la communauté Maawa en Algérie</div>

      <div className="ac-tabs">
        <div className={'ac-tab' + (role === 'client' ? ' on' : '')} id="rt-c" onClick={() => setRole('client')}>
          <span id="t-i-client">👤 Je suis Client</span>
        </div>
        <div className={'ac-tab' + (role === 'artisan' ? ' on' : '')} id="rt-a" onClick={() => setRole('artisan')}>
          <span id="t-i-artisan">🔧 Je suis Artisan</span>
        </div>
      </div>

      <div className="prog-bar">
        <div className="prog-fill" id="prog" style={{ width: progPct }}></div>
      </div>

      {/* Step 1 */}
      <div id="rs1" className={'step' + (step === 1 ? ' on' : '')}>
        <div className="step-lbl" id="t-step1">Étape 1/3 — Informations personnelles</div>
        <div className="fgrp">
          <div className="frow2">
            <div className="fg">
              <label id="t-fn">Prénom *</label>
              <input
                className={'fi' + cls('firstName')}
                type="text"
                placeholder="Ahmed"
                value={firstName}
                onChange={e => bind(setFirstName)(e.target.value)}
                aria-invalid={errorField === 'firstName'}
              />
              {errorField === 'firstName' && (
                <div className="field-error" role="alert">{errorMsg}</div>
              )}
            </div>
            <div className="fg">
              <label id="t-ln">Nom</label>
              <input className="fi" type="text" placeholder="Benali" value={lastName} onChange={e => bind(setLastName)(e.target.value)} />
            </div>
          </div>
          <div className="fg">
            <label id="t-ph">Téléphone</label>
            <input
              className={'fi' + cls('phone')}
              type="tel"
              placeholder="+213 6XX XXX XXX"
              value={phone}
              onChange={e => bind(setPhone)(e.target.value)}
              aria-invalid={errorField === 'phone'}
            />
            {errorField === 'phone' && (
              <div className="field-error" role="alert">{errorMsg}</div>
            )}
          </div>
          <div className="fg">
            <label id="t-em">Email *</label>
            <input
              className={'fi' + cls('email')}
              type="email"
              placeholder="email@exemple.com"
              value={email}
              onChange={e => bind(setEmail)(e.target.value)}
              aria-invalid={errorField === 'email'}
            />
            {errorField === 'email' && (
              <div className="field-error" role="alert">{errorMsg}</div>
            )}
          </div>
          <div className="fg">
            <label id="t-pw2">Mot de passe *</label>
            <div className="fi-wrap">
              <input
                className={'fi' + cls('password')}
                id="pwr"
                type={pwShown ? 'text' : 'password'}
                placeholder="Minimum 8 caractères"
                value={password}
                onChange={e => bind(setPassword)(e.target.value)}
                aria-invalid={errorField === 'password'}
              />
              <button className="eye-btn" onClick={() => setPwShown(p => !p)} type="button" aria-label="Afficher ou masquer le mot de passe">👁</button>
            </div>
            {errorField === 'password' && (
              <div className="field-error" role="alert">{errorMsg}</div>
            )}
          </div>
          <div className="fg">
            <label id="t-wil">Wilaya *</label>
            <select
              className={selCls('wilaya')}
              value={wilaya}
              onChange={e => bind(setWilaya)(e.target.value)}
              aria-invalid={errorField === 'wilaya'}
            >
              <option value="" id="t-sel-wil">Sélectionner votre wilaya…</option>
              {WILAYAS.map(w => (
                <option key={w.code} value={displayLabel(w)} data-i18n={`wil_${w.code}`}>
                  {displayLabel(w)}
                </option>
              ))}
            </select>
            {errorField === 'wilaya' && (
              <div className="field-error" role="alert">{errorMsg}</div>
            )}
          </div>
          <div id="artisan-fields" style={{ display: role === 'artisan' ? 'flex' : 'none', flexDirection: 'column', gap: '11px' }}>
            <div className="fg">
              <label id="t-trade">Métier / Spécialité *</label>
              <select className="fsel" value={trade} onChange={e => setTrade(e.target.value)}>
                <option value="" id="t-sel-trade">Votre métier…</option>
                <option data-i18n="trade_plomb">🔧 Plombier</option>
                <option data-i18n="trade_elec">⚡ Électricien</option>
                <option data-i18n="trade_paint">🎨 Peintre / Décorateur</option>
                <option data-i18n="trade_macon">🧱 Maçon</option>
                <option data-i18n="trade_menu">🪚 Menuisier</option>
                <option data-i18n="trade_carrel">🏠 Carreleur</option>
                <option data-i18n="trade_cvc">❄️ Technicien CVC</option>
                <option data-i18n="trade_jard">🌿 Jardinier</option>
                <option data-i18n="trade_serr">🚪 Serrurier</option>
                <option data-i18n="trade_ferr">🔩 Ferronnier</option>
              </select>
            </div>
            <div className="fg">
              <label id="t-exp">Années d&apos;expérience</label>
              <input className="fi" type="number" placeholder="Ex: 8" min="0" max="60" value={experience} onChange={e => setExperience(e.target.value)} />
            </div>
          </div>
          {/* Referral code field removed in Phase 1 (was never wired to backend). */}
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '7px', cursor: 'pointer', fontSize: '.73rem', color: 'rgba(255,255,255,.7)', lineHeight: 1.55 }}>
            <input type="checkbox" style={{ marginTop: '2px', accentColor: 'var(--b400)' }} />
            <span id="t-cgu">J&apos;accepte les CGU et la Politique de confidentialité de Maawa</span>
          </label>
          {errorMsg && !errorField && (
            <div className="form-error-banner" role="alert">{errorMsg}</div>
          )}
          <button className="btn-auth" onClick={handleStep1} disabled={pending}>
            {pending ? <span className="loader"></span> : <span id="t-continue">Continuer → (Vérification SMS)</span>}
          </button>
        </div>
        <div className="ac-sw">
          <span id="t-already2">Déjà inscrit ?</span>{' '}
          <a onClick={() => router.push('/login')} id="t-signin2">Se connecter</a>
        </div>
      </div>

      {/* Step 2 OTP — UI placeholder; real Twilio flow gated by env. */}
      <div id="rs2" className={'step' + (step === 2 ? ' on' : '')}>
        <div className="step-lbl" id="t-step2">Étape 2/3 — Vérification SMS</div>
        <div style={{ textAlign: 'center', marginBottom: '14px' }}>
          <div style={{ fontSize: '2.3rem', marginBottom: '8px' }}>📱</div>
          <div id="t-otp-sent" style={{ fontSize: '.87rem', color: 'rgba(255,255,255,.88)', lineHeight: 1.6 }}>
            Code OTP envoyé au<br />
            <strong style={{ color: '#fff' }}>{phone || '+213 6XX XXX XXX'}</strong>
          </div>
        </div>
        <div className="otp-row">
          {[0, 1, 2, 3, 4, 5].map(i => (
            <input key={i} className="otp-i" maxLength={1} type="text" inputMode="numeric" onInput={otpNext} />
          ))}
        </div>
        <div style={{ textAlign: 'center', fontSize: '.75rem', color: 'rgba(255,255,255,.5)', marginBottom: '14px' }}>
          <span id="t-resend">Renvoyer dans</span>{' '}
          <span id="otp-timer" style={{ color: 'var(--b300)', fontWeight: 700 }}>{otpSec > 0 ? otpSec + 's' : 'Renvoyer'}</span>
        </div>
        {errorMsg && (
          <div className="form-error-banner" role="alert" style={{ marginBottom: '8px' }}>{errorMsg}</div>
        )}
        <button className="btn-auth" onClick={() => { setErrorField(null); setErrorMsg(''); setStep(3); }}>
          <span id="t-verify">Vérifier →</span>
        </button>
        <div className="ac-back">
          <a onClick={() => { setErrorField(null); setErrorMsg(''); setStep(1); }} id="t-back-s2">← Retour</a>
        </div>
      </div>

      {/* Step 3 NIN / Finish */}
      <div id="rs3" className={'step' + (step === 3 ? ' on' : '')}>
        <div id="nin-block" style={{ display: role === 'artisan' ? 'block' : 'none' }}>
          <div className="step-lbl" id="t-step3">Étape 3/3 — Vérification NIN (Artisans)</div>
          <div style={{ textAlign: 'center', marginBottom: '13px' }}>
            <div style={{ fontSize: '1.8rem', marginBottom: '5px' }}>🪪</div>
            <strong id="t-nin-title" style={{ fontSize: '.87rem', color: 'rgba(255,255,255,.9)' }}>Vérification Identité NIN</strong>
            <p id="t-nin-sub" style={{ fontSize: '.75rem', color: 'rgba(255,255,255,.6)', lineHeight: 1.58, marginTop: '4px' }}>
              Données protégées, utilisées uniquement en cas de litige légal. Vérification sous 24h.
            </p>
          </div>
          <div className="fg" style={{ marginBottom: '9px' }}>
            <label id="t-nin-num">Numéro NIN *</label>
            <input className="fi" type="text" placeholder="XXXXXXXXXXXXXXXXXX" />
          </div>
          <div className="nin-upload" onClick={() => toast('📎 CNI Recto importée ✓')}>
            <div style={{ fontSize: '1.5rem', marginBottom: '4px' }}>📄</div>
            <p id="t-cni-r" style={{ fontSize: '.76rem', color: 'rgba(255,255,255,.68)' }}>CNI RECTO — Cliquez pour importer</p>
          </div>
          <div className="nin-upload" onClick={() => toast('📎 CNI Verso importée ✓')}>
            <div style={{ fontSize: '1.5rem', marginBottom: '4px' }}>📄</div>
            <p id="t-cni-v" style={{ fontSize: '.76rem', color: 'rgba(255,255,255,.68)' }}>CNI VERSO — Cliquez pour importer</p>
          </div>
          <div className="nin-upload" onClick={() => toast('📸 Selfie capturé ✓')}>
            <div style={{ fontSize: '1.5rem', marginBottom: '4px' }}>🤳</div>
            <p id="t-selfie" style={{ fontSize: '.76rem', color: 'rgba(255,255,255,.68)' }}>Selfie de vérification — Tenez votre carte à côté du visage</p>
          </div>
          <div className="nin-notice" id="t-nin-notice">🔒 Documents traités confidentiellement. Protection légale garantie par Maawa.</div>
        </div>
        <div id="client-done" className="client-done" style={{ display: role === 'client' ? 'block' : 'none' }}>
          <div style={{ fontSize: '2.8rem', marginBottom: '9px' }}>🎉</div>
          <div id="t-ready" style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: '1.1rem', color: '#fff', marginBottom: '5px' }}>Votre compte est prêt !</div>
          <div id="t-welcome-comm" style={{ fontSize: '.82rem', color: 'rgba(255,255,255,.66)' }}>Bienvenue dans la communauté Maawa 🇩🇿</div>
        </div>
        {errorMsg && (
          <div className="form-error-banner" role="alert" style={{ marginTop: '8px' }}>{errorMsg}</div>
        )}
        <button className="btn-auth" style={{ marginTop: '12px' }} onClick={finishReg} disabled={pending}>
          {pending ? <span className="loader"></span> : (role === 'artisan' ? <span data-i18n="apply_cta">Soumettre ma candidature</span> : <span id="t-finish">Créer mon compte</span>)}
        </button>
        <div className="ac-back">
          <a onClick={() => { setErrorField(null); setErrorMsg(''); setStep(2); }} id="t-back-s3">← Retour</a>
        </div>
      </div>
    </div>
  );
}
