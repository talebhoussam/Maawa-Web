'use client';

import { useRouter } from 'next/navigation';
import { WILAYAS, displayLabel } from '@/lib/wilayas';

const closeBooking = () => {
  if (typeof document === 'undefined') return;
  document.getElementById('booking-modal')?.classList.remove('on');
};

export default function BookingModal() {
  const router = useRouter();
  return (
    <div className="modal-bg" id="booking-modal">
      <div className="modal-box" style={{ maxWidth: '440px' }}>
        <div className="modal-header">
          <div className="modal-title">📅 Réserver un artisan</div>
          <button className="modal-close" onClick={closeBooking}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        {/* Progress bar */}
        <div className="bk-prog">
          <div className="bk-ps done" id="bk-p1"></div>
          <div className="bk-ps" id="bk-p2"></div>
          <div className="bk-ps" id="bk-p3"></div>
        </div>

        {/* Step 1: Service + Date */}
        <div className="bk-step on" id="bk1">
          <div className="bk-artcard">
            <div className="av1 pav" style={{ width: '40px', height: '40px' }}>—</div>
            <div style={{ flex: 1 }}>
              <div id="bk-artname" style={{ fontWeight: 700, fontSize: '.88rem', color: 'var(--text)' }}>Artisan</div>
              <div id="bk-arttrade" style={{ fontSize: '.72rem', color: 'var(--text2)' }}>—</div>
            </div>
            <span id="bk-artbadge" />
          </div>

          <div style={{ fontWeight: 600, fontSize: '.82rem', marginBottom: '8px', color: 'var(--text)' }}>📋 Type de service</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '14px' }}>
            <label
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 11px', border: '1.5px solid var(--border2)', borderRadius: 'var(--rx)', cursor: 'pointer', transition: 'all .18s', fontSize: '.8rem' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLLabelElement).style.borderColor = 'var(--b400)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLLabelElement).style.borderColor = 'var(--border2)'; }}
            >
              <input type="radio" name="bk-svc" value="urgent" style={{ accentColor: 'var(--b500)' }} /> 🚨 Urgent (dans les 2h) <span style={{ marginLeft: 'auto', fontSize: '.71rem', color: 'var(--or)', fontWeight: 700 }}>+20%</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 11px', border: '1.5px solid var(--b400)', borderRadius: 'var(--rx)', cursor: 'pointer', background: 'var(--b50)', fontSize: '.8rem' }}>
              <input type="radio" name="bk-svc" value="scheduled" defaultChecked style={{ accentColor: 'var(--b500)' }} /> 📅 Planifié (choisir horaire) <span style={{ marginLeft: 'auto', fontSize: '.71rem', color: 'var(--b500)', fontWeight: 700 }}>Prix normal</span>
            </label>
            <label
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 11px', border: '1.5px solid var(--border2)', borderRadius: 'var(--rx)', cursor: 'pointer', transition: 'all .18s', fontSize: '.8rem' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLLabelElement).style.borderColor = 'var(--b400)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLLabelElement).style.borderColor = 'var(--border2)'; }}
            >
              <input type="radio" name="bk-svc" value="tender" style={{ accentColor: 'var(--b500)' }} /> 📣 Appel d'offres Tender <span style={{ marginLeft: 'auto', fontSize: '.71rem', color: 'var(--gn)', fontWeight: 700 }}>Comparer</span>
            </label>
          </div>

          <div style={{ fontWeight: 600, fontSize: '.82rem', marginBottom: '8px', color: 'var(--text)' }}>📅 Choisir une date</div>
          <div className="bk-dates" id="bk-dates"></div>

          <div style={{ fontWeight: 600, fontSize: '.82rem', marginBottom: '8px', color: 'var(--text)' }}>⏰ Choisir un créneau</div>
          <div className="bk-slots">
            <div className="bk-t" onClick={() => {}}>08:00</div>
            <div className="bk-t sel" onClick={() => {}}>09:00</div>
            <div className="bk-t" onClick={() => {}}>10:00</div>
            <div className="bk-t" onClick={() => {}}>11:00</div>
            <div className="bk-t" onClick={() => {}}>14:00</div>
            <div className="bk-t" onClick={() => {}}>15:00</div>
            <div className="bk-t" onClick={() => {}}>16:00</div>
            <div className="bk-t" onClick={() => {}}>17:00</div>
          </div>

          <button className="btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => {}}>
            Continuer → Description du problème
          </button>
        </div>

        {/* Step 2: Description */}
        <div className="bk-step" id="bk2">
          <div style={{ fontWeight: 600, fontSize: '.82rem', marginBottom: '8px', color: 'var(--text)' }}>📝 Décrivez le problème</div>
          <textarea className="fi" style={{ width: '100%', minHeight: '90px', padding: '9px', borderRadius: 'var(--rx)', resize: 'vertical', fontSize: '.8rem', lineHeight: 1.6, color: 'var(--text)' }} placeholder="Ex: Fuite sous l'évier cuisine, eau qui coule depuis 2 jours…" />

          <div style={{ fontWeight: 600, fontSize: '.82rem', margin: '12px 0 8px', color: 'var(--text)' }}>📍 Adresse</div>
          <input className="fi" type="text" placeholder="N° Rue, Quartier, Commune" style={{ width: '100%', marginBottom: '9px' }} />
          <select className="fsel" style={{ width: '100%', marginBottom: '13px' }} defaultValue="16 - Alger">
            <option value="">Wilaya *</option>
            {WILAYAS.map(w => (
              <option key={w.code} value={displayLabel(w)}>{displayLabel(w)}</option>
            ))}
          </select>

          <div style={{ background: 'var(--gl)', borderRadius: 'var(--rx)', padding: '9px 11px', fontSize: '.74rem', color: 'var(--text2)', marginBottom: '13px', display: 'flex', alignItems: 'center', gap: '7px' }}>
            🔒 <span>Paiement sécurisé <strong>Maawa SafePay</strong> — Fonds bloqués jusqu'à validation</span>
          </div>

          <div style={{ display: 'flex', gap: '7px' }}>
            <button className="btn-outline" onClick={() => {}} style={{ flex: 1, justifyContent: 'center' }}>← Retour</button>
            <button className="btn-primary" onClick={() => {}} style={{ flex: 2, justifyContent: 'center' }}>Confirmer →</button>
          </div>
        </div>

        {/* Step 3: Confirmation */}
        <div className="bk-step" id="bk3">
          <div style={{ textAlign: 'center', padding: '10px 0 5px' }}>
            <div style={{ fontSize: '2.8rem', marginBottom: '8px' }}>✅</div>
            <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: '1.05rem', color: 'var(--text)', marginBottom: '4px' }}>Demande envoyée !</div>
            <div style={{ fontSize: '.8rem', color: 'var(--text2)', lineHeight: 1.6, marginBottom: '14px' }}>
              <strong id="bk-artname2">L&apos;artisan</strong> a reçu votre demande.<br />
              Il dispose de <strong>30 minutes</strong> pour accepter ou refuser.<br />
              Vous serez notifié immédiatement.
            </div>
            <div style={{ background: 'var(--b50)', border: '1px solid var(--b200)', borderRadius: 'var(--rx)', padding: '10px', textAlign: 'left', marginBottom: '13px' }}>
              <div style={{ fontSize: '.74rem', color: 'var(--text2)', lineHeight: 1.7 }}>
                <div>📅 <strong>Date :</strong> <span id="bk-confirm-date">—</span></div>
                <div>🔒 <strong>SafePay :</strong> Fonds bloqués après confirmation</div>
                <div>📱 <strong>Notification :</strong> SMS + application</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '7px' }}>
              <button className="btn-outline" onClick={() => { router.push('/missions'); closeBooking(); }} style={{ flex: 1, justifyContent: 'center' }}>Mes missions</button>
              <button className="btn-primary" onClick={closeBooking} style={{ flex: 1, justifyContent: 'center' }}>Fermer</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
