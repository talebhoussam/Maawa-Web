'use client';

import { closeModal } from '@/lib/modal';
import { toast } from '@/lib/toast';

const MODAL_ID = 'perf-modal';
const close = () => closeModal(MODAL_ID);

export default function PerfModal() {
  return (
    <div className="modal-bg" id={MODAL_ID}>
      <div className="modal" style={{ maxWidth: '520px' }}>
        <div className="modal-title">
          📊 Performance — <span id="perf-name">Karim Plombier</span>
          <button className="modal-close" onClick={close}>✕</button>
        </div>
        <div className="stat-row">
          <div className="stat-mini"><div className="stat-mini-v" style={{ color: 'var(--gn)' }}>137</div><div className="stat-mini-l">Missions</div></div>
          <div className="stat-mini"><div className="stat-mini-v" style={{ color: 'var(--go)' }}>4.9★</div><div className="stat-mini-l">Note moy.</div></div>
          <div className="stat-mini"><div className="stat-mini-v" style={{ color: 'var(--rd)' }}>3%</div><div className="stat-mini-l">Annulations</div></div>
          <div className="stat-mini"><div className="stat-mini-v" style={{ color: 'var(--b500)' }}>&lt;1h</div><div className="stat-mini-l">Tps réponse</div></div>
        </div>
        <div className="card" style={{ marginTop: '12px' }}>
          <div className="perf-stat">
            <div className="perf-label">Revenus générés pour Maawa</div>
            <div className="perf-val" style={{ color: 'var(--gn)' }}>84 500 DZD</div>
          </div>
          <div className="perf-stat">
            <div className="perf-label">Missions ce mois</div>
            <div className="perf-val">47</div>
          </div>
          <div className="perf-stat">
            <div className="perf-label">Taux d'acceptation</div>
            <div className="perf-val" style={{ color: 'var(--gn)' }}>94%</div>
          </div>
          <div className="perf-stat">
            <div className="perf-label">Dernière connexion</div>
            <div className="perf-val" style={{ fontSize: '.78rem', color: 'var(--text3)' }}>Auj. 14:32</div>
          </div>
          <div className="perf-stat">
            <div className="perf-label">Wilaya principale</div>
            <div className="perf-val">Alger-Centre</div>
          </div>
          <div className="perf-stat">
            <div className="perf-label">Litiges impliqués</div>
            <div className="perf-val" style={{ color: 'var(--gn)' }}>0</div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={close}>Fermer</button>
          <button className="btn btn-primary" onClick={() => toast('📄 Rapport PDF généré')}>Exporter rapport</button>
        </div>
      </div>
    </div>
  );
}
