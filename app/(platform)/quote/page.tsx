'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@/lib/toast';
import { db, auth } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useMaawa } from '@/lib/store';
import { WILAYAS, displayLabel } from '@/lib/wilayas';

const SERVICES = ['🔧 Plomberie', '⚡ Électricité', '🎨 Peinture', '🧱 Maçonnerie', '🪚 Menuiserie', '🏠 Carrelage', '❄️ Climatisation', '🌿 Jardinage', '🚪 Serrurerie'];

const ESTIMATE_RANGES: Record<string, [number, number]> = {
  '🔧 Plomberie': [5000, 25000],
  '⚡ Électricité': [8000, 35000],
  '🎨 Peinture': [12000, 60000],
  '🧱 Maçonnerie': [20000, 100000],
  '🪚 Menuiserie': [10000, 50000],
  '🏠 Carrelage': [15000, 70000],
  '❄️ Climatisation': [25000, 80000],
  '🌿 Jardinage': [3000, 15000],
  '🚪 Serrurerie': [2000, 8000],
};

export default function QuotePage() {
  const router = useRouter();
  const { user } = useMaawa();

  const [service, setService] = useState('');
  const [description, setDescription] = useState('');
  const [surface, setSurface] = useState('');
  const [location, setLocation] = useState(user?.wilaya || '');
  const [urgency, setUrgency] = useState('Non urgent');
  const [budget, setBudget] = useState('Pas de contrainte');
  const [loading, setLoading] = useState(false);
  const [estimate, setEstimate] = useState<{ low: number; high: number; service: string } | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const handleEstimate = async () => {
    if (!service || !description || !location) {
      toast('⚠️ Veuillez remplir les champs obligatoires (*)');
      return;
    }
    setLoading(true);

    // Simulated AI estimation (replace with real API call when ready)
    await new Promise(r => setTimeout(r, 1200));

    const [baseLow, baseHigh] = ESTIMATE_RANGES[service] || [5000, 30000];
    const surfaceMultiplier = surface ? Math.max(1, parseInt(surface) / 25) : 1;
    const urgencyMultiplier = urgency.includes('Urgent') ? 1.3 : urgency.includes('Demi') ? 1.1 : 1;

    const low = Math.round(baseLow * surfaceMultiplier * urgencyMultiplier / 500) * 500;
    const high = Math.round(baseHigh * surfaceMultiplier * urgencyMultiplier / 500) * 500;
    setEstimate({ low, high, service });

    // Save quote request to Firestore if logged in
    if (auth.currentUser) {
      try {
        await addDoc(collection(db, 'quotes'), {
          userId: auth.currentUser.uid,
          service, description, surface, location, urgency, budget,
          estimateLow: low, estimateHigh: high,
          status: 'pending',
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        console.error('Failed to save quote:', err);
      }
    }

    setLoading(false);
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const callMaawa = () => { window.location.href = 'tel:+213233000000'; };

  return (
    <div className="screen on" id="s-quote">
      <div className="pg-title au" id="t-q-title">🤖 Estimation IA — Maawa Smart Quote</div>
      <div className="pg-sub au" id="t-q-sub">Estimation instantanée · Gratuite · Sans engagement</div>
      <div className="quote-layout">
        <div>
          <div className="qform au">
            <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: '.95rem', color: 'var(--text)', marginBottom: '3px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--b500)" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
              <span id="t-q-describe">Décrivez votre projet</span>
            </div>
            <div style={{ fontSize: '.78rem', color: 'var(--text3)', marginBottom: '14px' }}>Plus vous êtes précis, plus l'estimation sera juste</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label className="qf-label">Type de service *</label>
                <select className="qf-select" value={service} onChange={e => setService(e.target.value)}>
                  <option value="">Sélectionner un métier…</option>
                  {SERVICES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="qf-label">Description détaillée *</label>
                <textarea className="qf-textarea" placeholder="Ex: Fuite sous l'évier cuisine, tuyauterie cuivre, F4 Alger-Centre…" value={description} onChange={e => setDescription(e.target.value)} />
              </div>
              <div className="qf-row">
                <div><label className="qf-label">Surface (m²)</label><input className="qf-input" type="number" placeholder="25" value={surface} onChange={e => setSurface(e.target.value)} /></div>
              </div>
              <div>
                <label className="qf-label">Commune / Wilaya *</label>
                <select className="qf-select" value={location} onChange={e => setLocation(e.target.value)}>
                  <option value="">Sélectionner votre wilaya…</option>
                  {WILAYAS.map(w => (
                    <option key={w.code} value={displayLabel(w)}>{displayLabel(w)}</option>
                  ))}
                </select>
              </div>
              <div className="qf-row">
                <div>
                  <label className="qf-label">Urgence</label>
                  <select className="qf-select" value={urgency} onChange={e => setUrgency(e.target.value)}>
                    <option>Non urgent</option>
                    <option>Demi-urgent (2-3j)</option>
                    <option>🚨 Urgent (24h)</option>
                  </select>
                </div>
                <div>
                  <label className="qf-label">Budget</label>
                  <select className="qf-select" value={budget} onChange={e => setBudget(e.target.value)}>
                    <option>Pas de contrainte</option>
                    <option>&lt; 10 000 DZD</option>
                    <option>10K–30K DZD</option>
                    <option>30K–80K DZD</option>
                    <option>&gt; 80K DZD</option>
                  </select>
                </div>
              </div>
              <button className="btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={handleEstimate} disabled={loading}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
                <span>{loading ? '⏳ Calcul en cours...' : 'Estimer maintenant'}</span>
              </button>
            </div>
          </div>

          {estimate && (
            <div className="ai-result" id="ai-result" ref={resultRef} style={{ marginTop: '14px' }}>
              <div className="air-badge">🤖 Maawa Smart Quote</div>
              <div className="air-range">{estimate.low.toLocaleString('fr-FR')} – {estimate.high.toLocaleString('fr-FR')} DZD</div>
              <div style={{ fontSize: '.78rem', color: 'var(--text2)', marginBottom: '11px' }}>{estimate.service} · {location} · {urgency}</div>
              <div className="air-breakdown">
                <div className="air-row"><span className="air-l">Main d'œuvre (~50%)</span><span className="air-v">{(estimate.low * 0.5).toLocaleString('fr-FR')}–{(estimate.high * 0.5).toLocaleString('fr-FR')} DZD</span></div>
                <div className="air-row"><span className="air-l">Matériaux (~35%)</span><span className="air-v">{(estimate.low * 0.35).toLocaleString('fr-FR')}–{(estimate.high * 0.35).toLocaleString('fr-FR')} DZD</span></div>
                <div className="air-row"><span className="air-l">Déplacement (~10%)</span><span className="air-v">{(estimate.low * 0.1).toLocaleString('fr-FR')}–{(estimate.high * 0.1).toLocaleString('fr-FR')} DZD</span></div>
                <div className="air-row"><span className="air-l">Marge Maawa (5%)</span><span className="air-v">{(estimate.low * 0.05).toLocaleString('fr-FR')}–{(estimate.high * 0.05).toLocaleString('fr-FR')} DZD</span></div>
              </div>
              <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap', marginBottom: '11px' }}>
                <button className="btn-primary sm" onClick={() => router.push('/explore')}>Voir artisans disponibles</button>
                <button className="btn-outline sm" onClick={callMaawa}>📞 Appeler Maawa</button>
              </div>
              <div className="air-note">⚠️ Estimation indicative. Prix final selon chantier réel. Utilisez toujours <strong>Maawa SafePay</strong> pour sécuriser votre paiement.</div>
            </div>
          )}
        </div>

        <div className="qa-panels">
          <div className="qpanel" style={{ background: 'linear-gradient(135deg,var(--gl),#bbf7d0)', borderColor: '#86efac' }}>
            <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: '.86rem', color: 'var(--gn)', marginBottom: '8px' }}>Maawa SafePay 🔒</div>
            <div style={{ fontSize: '.78rem', color: 'var(--text2)', lineHeight: 1.58, marginBottom: '10px' }}>Paiement en séquestre sécurisé. Libéré uniquement après votre validation.</div>
            <div style={{ display: 'flex', gap: '5px' }}>
              <div style={{ flex: 1, background: 'rgba(255,255,255,.6)', borderRadius: 'var(--rx)', padding: '7px', textAlign: 'center' }}><div>🔒</div><div style={{ fontSize: '.63rem', fontWeight: 600, color: 'var(--gn)', marginTop: '2px' }}>Séquestre</div></div>
              <div style={{ flex: 1, background: 'rgba(255,255,255,.6)', borderRadius: 'var(--rx)', padding: '7px', textAlign: 'center' }}><div>⚖️</div><div style={{ fontSize: '.63rem', fontWeight: 600, color: 'var(--gn)', marginTop: '2px' }}>Médiation</div></div>
              <div style={{ flex: 1, background: 'rgba(255,255,255,.6)', borderRadius: 'var(--rx)', padding: '7px', textAlign: 'center' }}><div>✅</div><div style={{ fontSize: '.63rem', fontWeight: 600, color: 'var(--gn)', marginTop: '2px' }}>Garantie</div></div>
            </div>
          </div>
          <div className="qpanel" style={{ background: 'linear-gradient(145deg,#071520,var(--b700))', borderColor: 'var(--b600)' }}>
            <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: '.86rem', color: '#fff', marginBottom: '7px' }}>🪙 Votre solde</div>
            <div style={{ background: 'rgba(255,255,255,.1)', borderRadius: 'var(--rx)', padding: '8px 10px', marginBottom: '9px', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '.78rem', color: 'rgba(255,255,255,.8)' }}>Maawa Coins</span>
              <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, color: '#fff' }}>{user?.maawaCoinBalance ?? 0} MC = {((user?.maawaCoinBalance ?? 0) * 50).toLocaleString('fr-FR')} DZD</span>
            </div>
            <button className="wbtn wbtn-w" style={{ width: '100%', justifyContent: 'center' }} onClick={() => router.push('/wallet')}>Gérer mes Coins</button>
          </div>
          <div className="qpanel">
            <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: '.86rem', color: 'var(--text)', marginBottom: '8px' }}>💡 Conseils Maawa</div>
            <div style={{ fontSize: '.77rem', color: 'var(--text2)', lineHeight: 1.85 }}>
              ✅ Exigez le badge NIN Vérifié<br />
              ✅ Payez uniquement via SafePay<br />
              ✅ Vérifiez avis et portfolio<br />
              ✅ Demandez un devis signé<br />
              ⚠️ Ne payez jamais hors plateforme
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
