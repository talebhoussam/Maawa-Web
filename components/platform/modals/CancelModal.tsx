'use client';

const close = () => {
  if (typeof document === 'undefined') return;
  document.getElementById('cancel-modal')?.classList.remove('on');
};

export default function CancelModal() {
  return (
    <div className="modal-bg" id="cancel-modal">
      <div className="modal" style={{ maxWidth: '420px' }}>
        <div className="modal-header">
          <div className="modal-title">❌ Annuler la mission</div>
          <button className="modal-close" onClick={close}>✕</button>
        </div>
        <div className="modal-body">
          <div style={{ fontSize: '.82rem', color: 'var(--text2)', marginBottom: '12px' }}>
            Mission <strong id="cancel-mission-id">#MW-4821</strong>
          </div>
          <div id="cancel-fee-warn" className="cancel-fee-warn">
            ⚠️ <strong>Frais d'annulation :</strong> L'artisan a déjà confirmé. Des frais de <strong>15%</strong> du montant seront retenus conformément à la politique Maawa SafePay.
          </div>
          <div style={{ fontWeight: 600, fontSize: '.83rem', color: 'var(--text)', marginBottom: '9px' }}>Raison de l'annulation :</div>
          <div className="cancel-reason" onClick={() => {}}>
            <span style={{ fontSize: '1.1rem' }}>🗓️</span>
            <div><div style={{ fontWeight: 600, fontSize: '.82rem' }}>Changement de planning</div><div style={{ fontSize: '.72rem', color: 'var(--text3)' }}>Je ne suis plus disponible à cette date</div></div>
          </div>
          <div className="cancel-reason" onClick={() => {}}>
            <span style={{ fontSize: '1.1rem' }}>💸</span>
            <div><div style={{ fontWeight: 600, fontSize: '.82rem' }}>Contrainte budgétaire</div><div style={{ fontSize: '.72rem', color: 'var(--text3)' }}>Le projet dépasse mon budget</div></div>
          </div>
          <div className="cancel-reason" onClick={() => {}}>
            <span style={{ fontSize: '1.1rem' }}>🔄</span>
            <div><div style={{ fontWeight: 600, fontSize: '.82rem' }}>J'ai trouvé un autre artisan</div><div style={{ fontSize: '.72rem', color: 'var(--text3)' }}>Via une autre plateforme ou réseau</div></div>
          </div>
          <div className="cancel-reason" onClick={() => {}}>
            <span style={{ fontSize: '1.1rem' }}>⚠️</span>
            <div><div style={{ fontWeight: 600, fontSize: '.82rem' }}>Problème avec l'artisan</div><div style={{ fontSize: '.72rem', color: 'var(--text3)' }}>Communication, retard, comportement…</div></div>
          </div>
          <div className="cancel-reason" onClick={() => {}}>
            <span style={{ fontSize: '1.1rem' }}>❓</span>
            <div><div style={{ fontWeight: 600, fontSize: '.82rem' }}>Autre raison</div></div>
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '13px' }}>
            <button className="btn-outline" style={{ flex: 1, justifyContent: 'center' }} onClick={close}>← Retour</button>
            <button className="btn-red" style={{ flex: 1, justifyContent: 'center', display: 'inline-flex', alignItems: 'center', gap: '5px' }} onClick={() => {}}>❌ Confirmer l'annulation</button>
          </div>
        </div>
      </div>
    </div>
  );
}
