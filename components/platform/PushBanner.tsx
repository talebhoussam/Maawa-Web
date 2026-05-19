'use client';

import { useState } from 'react';
import { toast } from '@/lib/toast';

export default function PushBanner() {
  const [visible, setVisible] = useState(false);
  if (!visible) return null;
  return (
    <div
      id="push-banner"
      style={{
        position: 'fixed',
        bottom: '72px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 200,
        background: 'var(--b700)',
        color: '#fff',
        borderRadius: 'var(--r)',
        padding: '13px 16px',
        maxWidth: '360px',
        width: '90%',
        boxShadow: 'var(--shadow-lg)',
        animation: 'up .3s ease',
      }}
    >
      <div style={{ fontWeight: 700, fontSize: '.86rem', marginBottom: '4px' }}>🔔 Activer les notifications Maawa</div>
      <div style={{ fontSize: '.75rem', opacity: 0.85, marginBottom: '10px' }} id="t-push-desc">
        Recevez des alertes en temps réel pour vos missions et messages.
      </div>
      <div style={{ display: 'flex', gap: '7px' }}>
        <button
          className="btn-primary sm"
          style={{ flex: 1, justifyContent: 'center' }}
          onClick={() => { setVisible(false); toast('🔔 Notifications activées !'); }}
        >
          Activer
        </button>
        <button
          className="btn-outline sm"
          style={{ flex: 1, justifyContent: 'center', borderColor: 'rgba(255,255,255,.4)', color: '#fff' }}
          onClick={() => setVisible(false)}
        >
          Plus tard
        </button>
      </div>
    </div>
  );
}
