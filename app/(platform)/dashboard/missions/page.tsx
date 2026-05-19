'use client';

import { toast } from '@/lib/toast';

export default function DashboardMissionsPage() {
  return (
    <div className="screen on" id="s-amissions">
      <div className="pg-title au" id="t-amiss-title">Missions — Mode Artisan</div>
      <div className="pg-sub au" id="t-amiss-sub">Acceptez ou refusez · Délai : 30 minutes</div>
      <div className="mission-tabs au1">
        <button className="mt on" onClick={() => {}} id="t-new-tab">Nouvelles (3)</button>
        <button className="mt" onClick={() => {}} id="t-prog-tab">En cours (2)</button>
        <button className="mt" onClick={() => {}} id="t-done-tab">Terminées</button>
        <button className="mt" onClick={() => {}} id="t-ref-tab">Refusées</button>
      </div>

      {/* Card 1 — URGENT */}
      <div className="am-card au2" style={{ borderColor: 'var(--rd)' }}>
        <div className="urg-tag">🚨 URGENT</div>
        <div className="mc-head">
          <div className="mc-icon" style={{ background: 'var(--rl)' }}>🔧</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: '.88rem', color: 'var(--text)' }}>Fuite d'eau urgente — cuisine</div>
            <div style={{ fontSize: '.69rem', color: 'var(--text3)' }}>#MW-2026-1295 · Reçue à 15:48</div>
          </div>
        </div>
        <div className="am-timer">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--rd)" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
          <div>
            <div className="amt-v" id="mtimer">24:38</div>
            <div className="amt-l" id="t-time-left">Temps restant pour répondre</div>
          </div>
        </div>
        <div style={{ fontSize: '.82rem', color: 'var(--text2)', lineHeight: 1.6, marginBottom: '10px' }}>
          Fuite importante sous l'évier. Eau coule sur le sol. F3, 3ème étage. Intervention immédiate requise.
        </div>
        <div className="am-details">
          <div className="am-det">📍 Kouba (2.4 km)</div>
          <div className="am-det">📅 Maintenant</div>
          <div className="am-det">💰 5K–12K DZD</div>
          <div className="am-det">🔒 SafePay</div>
        </div>
        <div className="am-actions">
          <button className="btn-green" onClick={() => {}} id="t-accept">✓ Accepter</button>
          <button className="btn-red" onClick={() => toast('Mission refusée')} id="t-refuse">✗ Refuser</button>
          <button className="btn-outline sm" onClick={() => toast('💬')}>Chat</button>
        </div>
      </div>

      {/* Card 2 — chauffe-eau */}
      <div className="am-card au3">
        <div className="mc-head">
          <div className="mc-icon" style={{ background: 'var(--b100)' }}>🚿</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: '.88rem', color: 'var(--text)' }}>Installation chauffe-eau 100L</div>
            <div style={{ fontSize: '.69rem', color: 'var(--text3)' }}>#MW-2026-1290 · Reçue à 14:15</div>
          </div>
        </div>
        <div className="am-timer" style={{ background: 'var(--ol)' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--or)" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
          <div>
            <div className="amt-v" style={{ color: 'var(--or)' }}>18:22</div>
            <div className="amt-l" style={{ color: 'var(--or)' }} id="t-time-left2">Temps restant</div>
          </div>
        </div>
        <div style={{ fontSize: '.82rem', color: 'var(--text2)', lineHeight: 1.6, marginBottom: '10px' }}>
          Remplacement chauffe-eau 100L. Client a l'appareil. F4, 2ème étage.
        </div>
        <div className="am-details">
          <div className="am-det">📍 Ben Aknoun (4.1 km)</div>
          <div className="am-det">📅 Demain 9h</div>
          <div className="am-det">💰 8K–15K DZD</div>
          <div className="am-det">🔒 SafePay</div>
        </div>
        <div className="am-actions">
          <button className="btn-green" onClick={() => {}}>✓ Accepter</button>
          <button className="btn-red" onClick={() => toast('Mission refusée')}>✗ Refuser</button>
          <button className="btn-outline sm" onClick={() => toast('🤝 Négocier')} id="t-negotiate">🤝 Négocier</button>
        </div>
      </div>

      {/* Card 3 — détartrage en cours */}
      <div className="am-card au4" style={{ borderColor: 'var(--b300)' }}>
        <div className="mc-head">
          <div className="mc-icon" style={{ background: 'var(--b100)' }}>💧</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: '.88rem', color: 'var(--text)' }}>Détartrage réseau eau chaude</div>
            <div style={{ fontSize: '.69rem', color: 'var(--text3)' }}>#MW-2026-1280 · Sur place</div>
          </div>
          <span className="mc-status st-blue">🔄 En cours</span>
        </div>
        <div className="status-updater">
          <div className="su-title" id="t-status-update">Mettre à jour votre statut</div>
          <div className="su-steps">
            <div className="su-step on" onClick={() => {}}>
              <div className="su-dot" style={{ background: 'var(--b300)' }}></div>
              <span id="t-on-way">🚗 En route vers le client</span>
            </div>
            <div className="su-step on" onClick={() => {}}>
              <div className="su-dot" style={{ background: 'var(--b500)' }}></div>
              <span id="t-arrived">📍 Arrivé sur place</span>
            </div>
            <div className="su-step" onClick={() => {}}>
              <div className="su-dot" style={{ background: 'var(--border2)' }}></div>
              <span id="t-in-progress">🔧 Travaux en cours</span>
            </div>
            <div className="su-step" onClick={() => {}}>
              <div className="su-dot" style={{ background: 'var(--border2)' }}></div>
              <span id="t-works-done">✅ Travaux terminés</span>
            </div>
          </div>
        </div>
        <div className="am-actions" style={{ marginTop: '10px' }}>
          <button className="btn-primary sm" onClick={() => toast('📸 Photos ajoutées')} id="t-add-photos">📸 Ajouter photos</button>
          <button className="btn-outline sm" onClick={() => toast('💬')}>💬 Chat</button>
          <button className="btn-green sm" onClick={() => {}} id="t-mark-done">✅ Marquer terminé</button>
        </div>
      </div>
    </div>
  );
}
