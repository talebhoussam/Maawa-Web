'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@/lib/toast';
import { db, auth } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useMaawa } from '@/lib/store';
import { WILAYAS, displayLabel } from '@/lib/wilayas';

const TRADES = ['🔧 Plombier', '⚡ Électricien', '🎨 Peintre / Décorateur', '🧱 Maçon / Gros-œuvre', '🪚 Menuisier', '🏠 Carreleur', '❄️ Technicien CVC / Climatisation', '🌿 Jardinier / Paysagiste', '🚪 Serrurier', '🔩 Ferronnier'];

export default function ApplyPage() {
  const router = useRouter();
  const { user } = useMaawa();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState(user?.phone || '');
  const [trade, setTrade] = useState('');
  const [wilaya, setWilaya] = useState(user?.wilaya || '16 - Alger');
  const [experience, setExperience] = useState('');
  const [nin, setNin] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!firstName || !lastName || !phone || !trade || !nin) {
      toast('⚠️ Veuillez remplir tous les champs obligatoires (*)');
      return;
    }
    if (nin.length < 6) {
      toast('⚠️ Numéro NIN invalide');
      return;
    }

    setLoading(true);
    try {
      await addDoc(collection(db, 'applications'), {
        userId: auth.currentUser?.uid || null,
        email: auth.currentUser?.email || null,
        firstName, lastName, phone, trade, wilaya,
        experience: parseInt(experience) || 0,
        nin,
        status: 'pending',
        createdAt: serverTimestamp(),
      });
      setSubmitted(true);
    } catch (err) {
      console.error('Application error:', err);
      toast('❌ Erreur lors de l\'envoi. Réessayez.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="screen on" id="s-apply">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '70vh', textAlign: 'center', gap: '16px', padding: '20px' }}>
          <div style={{ fontSize: '4rem' }}>🎉</div>
          <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: '1.3rem', color: 'var(--text)' }}>Candidature envoyée !</div>
          <div style={{ fontSize: '.84rem', color: 'var(--text2)', maxWidth: '300px', lineHeight: 1.7 }}>
            Notre équipe examinera votre dossier dans les <strong>24–48h</strong>. Vous recevrez une notification dès validation.
          </div>
          <div style={{ background: 'var(--gl)', border: '1px solid var(--gn)', borderRadius: 'var(--r)', padding: '12px 20px', fontSize: '.82rem', color: 'var(--gn)', fontWeight: 600 }}>
            ✅ Dossier reçu · En cours de vérification
          </div>
          <button className="btn-primary" style={{ marginTop: '10px' }} onClick={() => router.push('/feed')}>
            Retour à l'accueil
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen on" id="s-apply">
      <div className="apply-hero au">
        <div style={{ fontSize: '1.8rem', marginBottom: '6px' }}>🔧</div>
        <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: '1.2rem', marginBottom: '4px' }}>Devenez Artisan Maawa</div>
        <div style={{ fontSize: '.81rem', opacity: 0.88, lineHeight: 1.6, marginBottom: '12px' }}>
          Rejoignez la communauté Maawa d&apos;artisans vérifiés NIN. Recevez des missions, gérez votre agenda et sécurisez vos paiements avec SafePay.
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {/* Static administrative facts only — the "missions/mois" and
              "note moyenne" placeholders were fake and have been removed.
              58 wilayas is a real administrative count of Algeria. */}
          {[['58', 'wilayas couvertes'], ['🔒', 'Paiement SafePay'], ['✓', 'Vérification NIN']].map(([v, l]) => (
            <div key={l} style={{ background: 'rgba(255,255,255,.14)', borderRadius: '8px', padding: '8px 12px', textAlign: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: '.96rem' }}>{v}</div>
              <div style={{ fontSize: '.62rem', opacity: 0.8 }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Requirements */}
      <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: '.88rem', color: 'var(--text)', marginBottom: '10px' }}>✅ Ce dont vous avez besoin</div>
      {['CNI / Carte nationale valide (NIN)', 'Numéro de téléphone algérien actif', "Minimum 1 an d'expérience dans votre métier", 'Validation Maawa sous 24–48h'].map((req, i) => (
        <div key={i} className={`req-item au${i < 2 ? 1 : 2}`}>
          <svg className="req-ok" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
          {req}
        </div>
      ))}

      {/* Form */}
      <div className="apply-form-card au3">
        <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: '.88rem', marginBottom: '12px' }}>📝 Formulaire de candidature</div>
        <div className="frow2" style={{ marginBottom: '11px' }}>
          <div className="fg"><label>Prénom *</label><input className="fi" type="text" placeholder="Ahmed" value={firstName} onChange={e => setFirstName(e.target.value)} /></div>
          <div className="fg"><label>Nom *</label><input className="fi" type="text" placeholder="Benali" value={lastName} onChange={e => setLastName(e.target.value)} /></div>
        </div>
        <div className="fg" style={{ marginBottom: '11px' }}>
          <label>Téléphone *</label>
          <input className="fi" type="tel" placeholder="+213 6XX XXX XXX" style={{ width: '100%' }} value={phone} onChange={e => setPhone(e.target.value)} />
        </div>
        <div className="fg" style={{ marginBottom: '11px' }}>
          <label>Métier / Spécialité *</label>
          <select className="fsel" style={{ width: '100%' }} value={trade} onChange={e => setTrade(e.target.value)}>
            <option value="">Choisissez votre métier…</option>
            {TRADES.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div className="frow2" style={{ marginBottom: '11px' }}>
          <div className="fg">
            <label>Wilaya *</label>
            <select className="fsel" style={{ width: '100%' }} value={wilaya} onChange={e => setWilaya(e.target.value)}>
              {WILAYAS.map(w => (
                <option key={w.code} value={displayLabel(w)} data-i18n={`wil_${w.code}`}>
                  {displayLabel(w)}
                </option>
              ))}
            </select>
          </div>
          <div className="fg">
            <label>Années d'expérience</label>
            <input className="fi" type="number" placeholder="Ex: 8" min="1" max="50" style={{ width: '100%' }} value={experience} onChange={e => setExperience(e.target.value)} />
          </div>
        </div>
        <div className="fg" style={{ marginBottom: '11px' }}>
          <label>Numéro NIN *</label>
          <input className="fi" type="text" placeholder="Votre numéro NIN" style={{ width: '100%' }} value={nin} onChange={e => setNin(e.target.value)} />
        </div>
        <div style={{ background: 'var(--b50)', borderRadius: 'var(--rx)', padding: '10px', fontSize: '.76rem', color: 'var(--text2)', marginBottom: '12px', border: '1px solid var(--b200)' }}>
          🔒 <strong>Vérification sous 24h.</strong> Votre NIN est utilisé uniquement pour la vérification d'identité. Données protégées par Maawa.
        </div>
        <button className="btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={handleSubmit} disabled={loading}>
          {loading ? <span className="loader"></span> : '🚀 Soumettre ma candidature'}
        </button>
      </div>

      {/* Steps */}
      <div className="card au4" style={{ padding: '14px', marginTop: '4px' }}>
        <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: '.86rem', marginBottom: '12px' }}>Comment ça marche ?</div>
        {[
          ['1', 'var(--b500)', 'Soumettez votre candidature', 'Remplissez le formulaire + NIN'],
          ['2', 'var(--b500)', 'Vérification Maawa (24–48h)', 'Notre équipe vérifie votre identité et vos documents'],
          ['✓', 'var(--gn)', 'Profil activé et badge NIN attribué', 'Commencez à recevoir des missions immédiatement'],
        ].map(([num, color, title, sub]) => (
          <div key={num} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '10px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '.78rem', flexShrink: 0 }}>{num}</div>
            <div>
              <div style={{ fontWeight: 600, fontSize: '.8rem', color: num === '✓' ? 'var(--gn)' : 'var(--text)' }}>{title}</div>
              <div style={{ fontSize: '.72rem', color: 'var(--text2)', marginTop: '2px' }}>{sub}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
