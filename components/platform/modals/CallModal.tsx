'use client';

import { useRouter } from 'next/navigation';
import { toast } from '@/lib/toast';

const closeModal = () => {
  if (typeof document === 'undefined') return;
  document.getElementById('call-modal')?.classList.remove('on');
};

export default function CallModal() {
  const router = useRouter();
  return (
    <div className="modal-bg" id="call-modal">
      <div className="modal-box">
        <div className="modal-header">
          <div className="modal-title" id="t-modal-title">📞 Appeler Maawa</div>
          <button className="modal-close" onClick={closeModal}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
        <div style={{ fontSize: '.83rem', color: 'var(--text2)', marginBottom: '14px', lineHeight: 1.65 }} id="t-modal-hours">
          Notre équipe est disponible <strong>Samedi–Jeudi, 8h–20h</strong>.<br />Nous vous mettons en contact avec le meilleur artisan disponible dans votre wilaya.
        </div>
        <div
          style={{ background: 'var(--gl)', borderRadius: '12px', padding: '14px', marginBottom: '13px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', transition: 'all .2s' }}
          onMouseOver={(e) => { (e.currentTarget as HTMLDivElement).style.background = '#bbf7d0'; }}
          onMouseOut={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'var(--gl)'; }}
          onClick={() => { toast('📞 Appel lancé…'); closeModal(); }}
        >
          <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'var(--gn)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 3px 10px rgba(16,185,129,.3)' }}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.62 3.38C1.62 2.18 2.53 1 3.72 1h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
          </div>
          <div>
            <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: '1.1rem', color: 'var(--gn)' }} id="t-modal-number">+213 23 XX XX XX</div>
            <div style={{ fontSize: '.76rem', color: 'var(--text2)' }} id="t-modal-line">Ligne directe Maawa · Appel standard</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn-green" style={{ flex: 1, justifyContent: 'center' }} onClick={() => { toast('📞 Appel lancé !'); closeModal(); }} id="t-call-now">Appeler maintenant</button>
          <button className="btn-outline" onClick={() => { toast('💬 WhatsApp'); closeModal(); }} id="t-whatsapp">WhatsApp</button>
        </div>
        <div style={{ marginTop: '11px', background: 'var(--b50)', borderRadius: 'var(--rx)', padding: '9px 11px', fontSize: '.75rem', color: 'var(--text2)', lineHeight: 1.6 }}>
          <span id="t-or-choose">💡 <strong>Ou choisissez vous-même</strong> →</span> <a style={{ color: 'var(--b500)', fontWeight: 600, cursor: 'pointer' }} onClick={() => { closeModal(); router.push('/explore'); }} id="t-browse">Explorer les artisans</a>
        </div>
      </div>
    </div>
  );
}
