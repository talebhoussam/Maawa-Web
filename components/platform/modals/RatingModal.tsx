'use client';

const close = () => {
  if (typeof document === 'undefined') return;
  document.getElementById('rating-modal')?.classList.remove('on');
};

export default function RatingModal() {
  return (
    <div className="modal-bg" id="rating-modal">
      <div className="modal" style={{ maxWidth: '400px' }}>
        <div className="modal-header">
          <div className="modal-title">⭐ Évaluer la mission</div>
          <button className="modal-close" onClick={close}>✕</button>
        </div>
        <div className="modal-body">
          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
            <div style={{ fontSize: '.85rem', color: 'var(--text2)' }}>Mission <strong id="rate-mission-id">—</strong></div>
            <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: '1rem', color: 'var(--text)', marginTop: '4px' }}>
              Comment s&apos;est passée votre mission avec <span id="rate-art-name">l&apos;artisan</span> ?
            </div>
          </div>
          <div className="star-rate" style={{ justifyContent: 'center' }}>
            <span className="sr" onMouseEnter={() => {}} onClick={() => {}}>☆</span>
            <span className="sr" onMouseEnter={() => {}} onClick={() => {}}>☆</span>
            <span className="sr" onMouseEnter={() => {}} onClick={() => {}}>☆</span>
            <span className="sr" onMouseEnter={() => {}} onClick={() => {}}>☆</span>
            <span className="sr" onMouseEnter={() => {}} onClick={() => {}}>☆</span>
          </div>
          <div className="fg" style={{ marginBottom: '13px' }}>
            <label className="fg label" style={{ fontSize: '.74rem', fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: '4px' }}>Votre commentaire (optionnel)</label>
            <textarea className="qf-textarea" id="rate-comment" placeholder="Décrivez votre expérience avec cet artisan…" style={{ minHeight: '70px' }} />
          </div>
          <button className="btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => {}}>✅ Valider mon avis</button>
        </div>
      </div>
    </div>
  );
}
