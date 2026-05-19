'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMaawa } from '@/lib/store';
import { toast } from '@/lib/toast';
import { auth } from '@/lib/firebase';
import { signOut, updateProfile, sendEmailVerification } from 'firebase/auth';
import { WILAYAS, displayLabel } from '@/lib/wilayas';

const callMaawa = () => { window.location.href = 'tel:+213233000000'; };

export default function SettingsPage() {
  const router = useRouter();
  const { lang, dark, setLang, toggleDark, user, setUser } = useMaawa();

  const [editMode, setEditMode] = useState(false);
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [wilaya, setWilaya] = useState(user?.wilaya || '');
  const [saving, setSaving] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);

  /* Artisan craft profile editor — only mounts when role==='artisan'.
     We mirror user-doc values into local state so changes can be
     batched and the save button gives one round-trip per save. */
  const artisanProfile = user as unknown as {
    trade?: string; experience?: number; hourlyRate?: number;
    serviceAreas?: string[]; bio?: string;
  } | null;
  const [trade, setTrade]           = useState(artisanProfile?.trade ?? '');
  const [experience, setExperience] = useState<number>(artisanProfile?.experience ?? 0);
  const [hourlyRate, setHourlyRate] = useState<number>(artisanProfile?.hourlyRate ?? 0);
  const [serviceAreas, setServiceAreas] = useState<string[]>(artisanProfile?.serviceAreas ?? []);
  const [bio, setBio]               = useState(artisanProfile?.bio ?? '');
  const [savingArtisan, setSavingArtisan] = useState(false);

  /* Keep artisan fields synced when the user-doc loads after first
     render. */
  useEffect(() => {
    if (!artisanProfile) return;
    setTrade(artisanProfile.trade ?? '');
    setExperience(artisanProfile.experience ?? 0);
    setHourlyRate(artisanProfile.hourlyRate ?? 0);
    setServiceAreas(artisanProfile.serviceAreas ?? []);
    setBio(artisanProfile.bio ?? '');
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [user?.uid]);

  const toggleServiceArea = (label: string) => {
    setServiceAreas(prev => prev.includes(label)
      ? prev.filter(x => x !== label)
      : [...prev, label]);
  };

  const handleSaveArtisanProfile = async () => {
    setSavingArtisan(true);
    try {
      const res = await fetch('/api/me/artisan-profile', {
        method:  'POST',
        headers: { 'content-type': 'application/json' },
        body:    JSON.stringify({
          trade:        trade.trim() || undefined,
          experience,
          hourlyRate,
          serviceAreas,
          bio:          bio.trim(),
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast('❌ ' + (j.message ?? 'Erreur'));
        return;
      }
      toast('✅ Profil artisan mis à jour');
      /* Sync the store so other pages reflect the change immediately. */
      if (user) {
        setUser({
          ...user,
          ...({ trade, experience, hourlyRate, serviceAreas, bio } as object),
        } as typeof user);
      }
    } catch {
      toast('❌ Erreur réseau');
    } finally {
      setSavingArtisan(false);
    }
  };

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || '');
      setPhone(user.phone || '');
      setWilaya(user.wilaya || '');
    }
  }, [user]);

  const handleLogout = async () => {
    await signOut(auth);
    router.replace('/login');
  };

  const handleSaveProfile = async () => {
    if (!auth.currentUser || !user) return;
    setSaving(true);
    try {
      /* Update auth displayName client-side (allowed by Firebase) */
      await updateProfile(auth.currentUser, { displayName });

      /* All other profile fields go through the server, which enforces
         the whitelist defined in /api/me/profile + firestore.rules. */
      const res = await fetch('/api/me/profile', {
        method:  'PUT',
        headers: { 'content-type': 'application/json' },
        body:    JSON.stringify({ displayName, wilaya }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast(data?.message ?? 'Erreur mise à jour');
        return;
      }
      setUser({ ...user, displayName, phone, wilaya });
      toast('✅ Profil mis à jour !');
      setEditMode(false);
    } catch (err) {
      toast('Erreur lors de la mise à jour.');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleSendVerification = async () => {
    if (!auth.currentUser) return;
    try {
      await sendEmailVerification(auth.currentUser);
      setVerificationSent(true);
      toast('📬 Email de vérification envoyé !');
    } catch {
      toast('Erreur. Réessayez dans quelques minutes.');
    }
  };

  const initials = user?.displayName
    ? user.displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() || 'MA';

  const isEmailVerified = auth.currentUser?.emailVerified;

  return (
    <div className="screen on" id="s-settings">
      <div className="page-title-row">
        <div className="pt-head" id="t-settings-title">⚙️ Paramètres</div>
      </div>

      {/* Profile Card */}
      <div className="card set-profile-card">
        <div className="set-av av1">{initials}</div>
        <div style={{ flex: 1 }}>
          {editMode ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <input className="fi" style={{ fontSize: '.82rem', padding: '6px 10px' }} value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Nom complet" />
              <input className="fi" style={{ fontSize: '.82rem', padding: '6px 10px' }} value={phone} onChange={e => setPhone(e.target.value)} placeholder="Téléphone" />
              <select className="fsel" style={{ fontSize: '.82rem', padding: '6px 10px', height: 'auto' }} value={wilaya} onChange={e => setWilaya(e.target.value)}>
                <option value="">Sélectionner votre wilaya…</option>
                {WILAYAS.map(w => (
                  <option key={w.code} value={displayLabel(w)}>{displayLabel(w)}</option>
                ))}
              </select>
              <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                <button className="btn-primary sm" onClick={handleSaveProfile} disabled={saving}>
                  {saving ? '...' : '✅ Sauvegarder'}
                </button>
                <button className="btn-outline sm" onClick={() => setEditMode(false)}>Annuler</button>
              </div>
            </div>
          ) : (
            <>
              <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: '.96rem', color: 'var(--text)' }}>
                {user?.displayName || 'Utilisateur Maawa'}
              </div>
              <div style={{ fontSize: '.73rem', color: 'var(--text2)' }}>
                📍 {user?.wilaya || 'Algérie'} · {user?.role === 'artisan' ? 'Artisan' : 'Client'}
              </div>
              <div style={{ fontSize: '.71rem', color: 'var(--b500)', fontWeight: 600, marginTop: '2px' }}>
                🪙 {user?.maawaCoinBalance ?? 0} Maawa Coins
              </div>
              {!isEmailVerified && (
                <div style={{ marginTop: '6px' }}>
                  <button
                    className="btn-outline sm"
                    style={{ fontSize: '.68rem', color: 'var(--or)', borderColor: 'var(--or)' }}
                    onClick={handleSendVerification}
                    disabled={verificationSent}
                  >
                    {verificationSent ? '📬 Email envoyé' : '⚠️ Vérifier mon email'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
        {!editMode && (
          <button className="btn-outline sm" style={{ marginLeft: 'auto', alignSelf: 'flex-start' }} onClick={() => setEditMode(true)}>Modifier</button>
        )}
      </div>

      {/* Artisan craft profile — artisan role only. */}
      {user?.role === 'artisan' && (
        <div className="set-group">
          <div className="set-group-title">🔧 Profil artisan</div>
          <div className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: '.76rem', fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
                Métier principal
              </label>
              <input
                type="text"
                value={trade}
                onChange={e => setTrade(e.target.value.slice(0, 80))}
                placeholder="Ex. Plomberie, Électricité, Menuiserie"
                disabled={savingArtisan}
                style={{
                  width: '100%', padding: 9,
                  border: '1.5px solid var(--border2)', borderRadius: 'var(--rx)',
                  background: 'var(--surface)', color: 'var(--text)',
                  fontSize: '.88rem',
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
              <div>
                <label style={{ display: 'block', fontSize: '.76rem', fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
                  Années d&apos;expérience
                </label>
                <input
                  type="number"
                  min={0}
                  max={60}
                  value={experience}
                  onChange={e => setExperience(Math.max(0, Math.min(60, Number(e.target.value) || 0)))}
                  disabled={savingArtisan}
                  style={{
                    width: '100%', padding: 9,
                    border: '1.5px solid var(--border2)', borderRadius: 'var(--rx)',
                    background: 'var(--surface)', color: 'var(--text)',
                    fontSize: '.88rem',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '.76rem', fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
                  Tarif horaire (DZD)
                </label>
                <input
                  type="number"
                  min={0}
                  max={100000}
                  step={50}
                  value={hourlyRate}
                  onChange={e => setHourlyRate(Math.max(0, Math.min(100000, Number(e.target.value) || 0)))}
                  disabled={savingArtisan}
                  style={{
                    width: '100%', padding: 9,
                    border: '1.5px solid var(--border2)', borderRadius: 'var(--rx)',
                    background: 'var(--surface)', color: 'var(--text)',
                    fontSize: '.88rem',
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '.76rem', fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
                Présentation (bio)
              </label>
              <textarea
                value={bio}
                onChange={e => setBio(e.target.value.slice(0, 1000))}
                placeholder="Spécialités, expérience, photos de référence…"
                rows={3}
                maxLength={1000}
                disabled={savingArtisan}
                style={{
                  width: '100%', padding: 9,
                  border: '1.5px solid var(--border2)', borderRadius: 'var(--rx)',
                  background: 'var(--surface)', color: 'var(--text)',
                  fontSize: '.88rem', fontFamily: 'inherit', resize: 'vertical',
                }}
              />
              <div style={{ fontSize: '.7rem', color: 'var(--text3)', textAlign: 'right', marginTop: 2 }}>
                {bio.length} / 1000
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '.76rem', fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
                Zones d&apos;intervention
                <span style={{ fontWeight: 400, color: 'var(--text3)', fontSize: '.7rem', marginLeft: 6 }}>
                  ({serviceAreas.length || 'tout l\'Algérie par défaut'})
                </span>
              </label>
              <div
                style={{
                  display: 'flex', flexWrap: 'wrap', gap: 6,
                  maxHeight: 200, overflowY: 'auto',
                  padding: 8,
                  border: '1px solid var(--border)', borderRadius: 'var(--rx)',
                  background: 'var(--surface2)',
                }}
              >
                {WILAYAS.map(w => {
                  const label = displayLabel(w);
                  const on = serviceAreas.includes(label);
                  return (
                    <button
                      key={w.code}
                      type="button"
                      onClick={() => toggleServiceArea(label)}
                      disabled={savingArtisan}
                      style={{
                        background: on ? 'var(--b500)' : 'var(--surface)',
                        color:      on ? '#fff'        : 'var(--text)',
                        border:    `1px solid ${on ? 'var(--b500)' : 'var(--border)'}`,
                        borderRadius: 50,
                        padding: '4px 10px',
                        fontSize: '.74rem',
                        cursor: 'pointer',
                        transition: 'all .15s',
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              className="btn-primary"
              onClick={handleSaveArtisanProfile}
              disabled={savingArtisan}
              style={{ alignSelf: 'flex-start' }}
            >
              {savingArtisan ? 'Enregistrement…' : '✅ Enregistrer'}
            </button>
          </div>
        </div>
      )}

      {/* Compte */}
      <div className="set-group">
        <div className="set-group-title" id="t-sg-account">Compte</div>
        <div className="set-item" onClick={() => setEditMode(true)}>
          <div className="set-icon" style={{ background: 'var(--b50)' }}>👤</div>
          <div className="set-label" data-i18n="set_personal">Informations personnelles</div>
          <svg className="set-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
        </div>
        <div className="set-item" onClick={() => router.push('/settings/password')}>
          <div className="set-icon" style={{ background: 'var(--gl)' }}>🔐</div>
          <div className="set-label" data-i18n="set_security">Changer mon mot de passe</div>
          <svg className="set-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
        </div>
        <div className="set-item" onClick={handleSendVerification}>
          <div className="set-icon" style={{ background: 'var(--gol)' }}>📧</div>
          <div className="set-label">Vérification email</div>
          <div style={{ marginLeft: 'auto', marginRight: '6px', fontSize: '.65rem', fontWeight: 700, color: isEmailVerified ? 'var(--gn)' : 'var(--or)' }}>
            {isEmailVerified ? '✓ Vérifié' : '⚠️ Non vérifié'}
          </div>
          <svg className="set-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
        </div>
      </div>

      {/* Notifications */}
      <div className="set-group">
        <div className="set-group-title" id="t-sg-notifs">Notifications</div>
        <PushOptInRow />
        <div className="set-item">
          <div className="set-icon" style={{ background: 'var(--b50)' }}>🔔</div>
          <div className="set-label" data-i18n="set_new_missions">Nouvelles missions</div>
          <label className="toggle-sw">
            <input type="checkbox" defaultChecked onChange={(e) => toast(e.currentTarget.checked ? '🔔 Activé' : '🔕 Désactivé')} />
            <span className="ts-track"></span>
          </label>
        </div>
        <div className="set-item">
          <div className="set-icon" style={{ background: 'var(--gl)' }}>💬</div>
          <div className="set-label" data-i18n="set_messages">Messages</div>
          <label className="toggle-sw">
            <input type="checkbox" defaultChecked onChange={(e) => toast(e.currentTarget.checked ? '🔔' : '🔕')} />
            <span className="ts-track"></span>
          </label>
        </div>
        <div className="set-item">
          <div className="set-icon" style={{ background: 'var(--gol)' }}>💰</div>
          <div className="set-label" data-i18n="set_safepay">SafePay & Paiements</div>
          <label className="toggle-sw">
            <input type="checkbox" defaultChecked onChange={(e) => toast(e.currentTarget.checked ? '🔔' : '🔕')} />
            <span className="ts-track"></span>
          </label>
        </div>
      </div>

      {/* Apparence & Langue */}
      <div className="set-group">
        <div className="set-group-title" id="t-sg-appear">Apparence & Langue</div>
        <div className="set-item">
          <div className="set-icon" style={{ background: 'var(--b50)' }}>🌙</div>
          <div className="set-label" id="t-sg-dark">Mode sombre</div>
          <label className="toggle-sw">
            <input type="checkbox" checked={dark} onChange={toggleDark} />
            <span className="ts-track"></span>
          </label>
        </div>
        <div className="set-item">
          <div className="set-icon" style={{ background: 'var(--gl)' }}>🌐</div>
          <div className="set-label" data-i18n="set_lang">Langue / Language / اللغة</div>
          <div style={{ display: 'flex', gap: '4px', marginLeft: 'auto' }}>
            <button className={lang === 'fr' ? 'btn-outline sm on' : 'btn-outline sm'} onClick={() => setLang('fr')}>🇫🇷</button>
            <button className={lang === 'en' ? 'btn-outline sm on' : 'btn-outline sm'} onClick={() => setLang('en')}>🇬🇧</button>
            <button className={lang === 'ar' ? 'btn-outline sm on' : 'btn-outline sm'} onClick={() => setLang('ar')}>🇩🇿</button>
          </div>
        </div>
      </div>

      {/* Paiement & Coins */}
      <div className="set-group">
        <div className="set-group-title" id="t-sg-pay">Paiement & Coins</div>
        <div className="set-item" onClick={() => router.push('/wallet')}>
          <div className="set-icon" style={{ background: 'linear-gradient(135deg,var(--b500),var(--b700))' }}>🪙</div>
          <div className="set-label" data-i18n="set_manage_coins">Gérer mes Maawa Coins</div>
          <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: '.8rem', color: 'var(--b500)', marginLeft: 'auto', marginRight: '6px' }}>
            {user?.maawaCoinBalance ?? 0} MC
          </div>
          <svg className="set-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
        </div>
        <div className="set-item" onClick={() => toast('💳 Méthodes de paiement — Bientôt disponible')}>
          <div className="set-icon" style={{ background: 'var(--gol)' }}>💳</div>
          <div className="set-label" data-i18n="set_pay_methods">Méthodes de paiement</div>
          <svg className="set-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
        </div>
      </div>

      {/* Support & Légal */}
      <div className="set-group">
        <div className="set-group-title" id="t-sg-support">Support & Légal</div>
        <div className="set-item" onClick={callMaawa}>
          <div className="set-icon" style={{ background: 'var(--gl)' }}>📞</div>
          <div className="set-label" data-i18n="set_contact">Contacter Maawa 24/7</div>
          <svg className="set-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
        </div>
        <div className="set-item" onClick={() => toast('📄 CGU — Disponible bientôt')}>
          <div className="set-icon" style={{ background: 'var(--surface2)' }}>📄</div>
          <div className="set-label" data-i18n="set_terms">CGU & Confidentialité</div>
          <svg className="set-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
        </div>
        <div className="set-item" onClick={() => toast('🔥 Maawa v1.0 — Production Build')}>
          <div className="set-icon" style={{ background: 'var(--surface2)' }}>ℹ️</div>
          <div className="set-label" data-i18n="set_version">Version de l'application</div>
          <div style={{ fontSize: '.72rem', color: 'var(--text3)', marginLeft: 'auto', marginRight: '6px' }}>v1.0.0</div>
        </div>
      </div>

      {/* Logout */}
      <div className="card" style={{ marginTop: '4px', padding: 0, overflow: 'hidden' }}>
        <div className="set-item" onClick={handleLogout} style={{ color: 'var(--rd)' }}>
          <div className="set-icon" style={{ background: 'var(--rl)' }}>🚪</div>
          <div className="set-label" style={{ color: 'var(--rd)', fontWeight: 600 }} data-i18n="set_logout">Se déconnecter</div>
        </div>
      </div>

      <div style={{ textAlign: 'center', fontSize: '.62rem', color: 'var(--text3)', marginTop: '14px', lineHeight: 2 }}>
        © 2026 <strong style={{ color: 'var(--b500)' }}>Maawa</strong> · ustal.dev 🇩🇿<br />
        Confidentialité · CGU · SafePay · Aide
      </div>
    </div>
  );
}

/**
 * Push opt-in toggle. Hidden when the browser doesn't support push
 * or when the operator hasn't set the VAPID key yet. Click triggers
 * the full enablePush flow (permission prompt + SW + token register).
 */
function PushOptInRow() {
  const [status, setStatus] = useState<'unsupported' | 'unconfigured' | 'default' | 'granted' | 'denied' | 'loading'>('loading');

  useEffect(() => {
    /* Lazy-load the push module so SSR doesn't see browser globals. */
    import('@/lib/push').then(m => setStatus(m.getPushStatus()));
  }, []);

  const opt = async () => {
    setStatus('loading');
    const m = await import('@/lib/push');
    const token = await m.enablePush();
    if (token) {
      setStatus('granted');
      toast('🔔 Notifications activées');
    } else {
      const s = m.getPushStatus();
      setStatus(s);
      if (s === 'denied')        toast('⚠️ Notifications bloquées par le navigateur');
      else if (s === 'default')  toast('Permission refusée');
    }
  };

  /* Hide the row entirely if push isn't usable on this device or the
     server hasn't configured push yet — better than showing a
     broken-looking toggle. */
  if (status === 'unsupported' || status === 'unconfigured') return null;

  return (
    <div className="set-item">
      <div className="set-icon" style={{ background: 'var(--b50)' }}>📱</div>
      <div className="set-label">Notifications push</div>
      <div style={{ marginLeft: 'auto', fontSize: '.72rem', fontWeight: 700 }}>
        {status === 'granted' ? (
          <span style={{ color: 'var(--gn)' }}>✓ Activé</span>
        ) : status === 'denied' ? (
          <span style={{ color: 'var(--rd)' }}>⚠ Bloqué</span>
        ) : status === 'loading' ? (
          <span style={{ color: 'var(--text3)' }}>…</span>
        ) : (
          <button
            type="button"
            onClick={opt}
            style={{
              background: 'var(--b500)', color: '#fff',
              border: 'none', borderRadius: 50,
              padding: '4px 12px', cursor: 'pointer',
              fontSize: '.72rem', fontWeight: 700,
            }}
          >
            Activer
          </button>
        )}
      </div>
    </div>
  );
}
