'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useMaawa } from '@/lib/store';
import { useT } from '@/lib/useT';
import { auth, storage } from '@/lib/firebase';
import { ref as storageRef, uploadBytes } from 'firebase/storage';
import { publicEnv } from '@/lib/env';

/**
 * "Recharger" modal — Phase 3.
 *
 * Lifecycle of a recharge:
 *   1. User picks amount (slider + numeric, 100..10000, step 50).
 *   2. User picks payment method (CCP / Baridimob / cash). Card is
 *      visible but disabled with "Bientôt disponible".
 *   3. User optionally adds a reference + uploads a proof image
 *      (client-side write to Firebase Storage at
 *      /coin_proofs/{uid}/{timestamp}-{name}; max 5 MB; image only).
 *   4. Submit calls POST /api/wallet/purchase-request.
 *   5. On success the modal swaps to an "instructions" view showing
 *      the operator's CCP/Baridi number or office address with the
 *      reference embedded as MAAWA-{requestId}.
 *
 * Errors at each step surface inline (banner) per the Phase 1
 * convention. The modal is opened by setting `#recharge-modal.on` —
 * the wallet page's Recharger button does that.
 */

type PaymentMethod = 'ccp' | 'baridimob' | 'cash_office';

interface SubmitResponse {
  requestId: string;
  amountDZD: number;
  instructions: {
    ccp?: string;
    baridimob?: string;
    officeAddress?: string;
  };
}

const MIN_MC  = 100;
const MAX_MC  = 10000;
const STEP_MC = 50;

const closeModal = () => {
  if (typeof document === 'undefined') return;
  document.getElementById('recharge-modal')?.classList.remove('on');
};

export default function RechargeModal() {
  const t = useT();
  const { user, lang } = useMaawa();
  const dark = useMaawa(s => s.dark);
  const rate = publicEnv.NEXT_PUBLIC_MC_RATE_DZD;

  /* Form state */
  const [amountMC, setAmountMC] = useState<number>(MIN_MC);
  const [method, setMethod] = useState<PaymentMethod>('ccp');
  const [reference, setReference] = useState<string>('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPath, setProofPath] = useState<string | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);

  /* Submit state */
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string>('');

  /* Success state */
  const [result, setResult] = useState<SubmitResponse | null>(null);

  /* When the modal closes (.on removed by parent), reset state so the
     next open starts clean. We watch for our root element losing the
     class via a MutationObserver — simpler and more reliable than
     synthesising an event. */
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const obs = new MutationObserver(() => {
      if (!el.classList.contains('on')) {
        /* Reset on close */
        setAmountMC(MIN_MC);
        setMethod('ccp');
        setReference('');
        setProofFile(null);
        setProofPath(null);
        setUploading(false);
        setSubmitting(false);
        setSubmitError('');
        setResult(null);
      }
    });
    obs.observe(el, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

  const amountDZD = amountMC * rate;

  const refPlaceholder = useMemo(() => {
    if (method === 'ccp')       return t('rch_ref_ph_ccp');
    if (method === 'baridimob') return t('rch_ref_ph_baridi');
    return t('rch_ref_ph_cash');
  }, [method, t, lang]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Clamp helper for the numeric input */
  const setAmountClamped = (raw: number) => {
    if (Number.isNaN(raw)) return;
    let v = Math.round(raw / STEP_MC) * STEP_MC;
    if (v < MIN_MC) v = MIN_MC;
    if (v > MAX_MC) v = MAX_MC;
    setAmountMC(v);
  };

  /* Client-side proof upload to Firebase Storage. We upload BEFORE
     submission so the server can verify file existence. Failure paths:
       - wrong content-type / size → file picker rejects locally
       - upload fails  → surfaced as banner, server call not made */
  const handleProofPick = async (file: File | null) => {
    setSubmitError('');
    setProofFile(file);
    setProofPath(null);
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setSubmitError(t('rch_err_upload'));
      setProofFile(null);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setSubmitError(t('rch_err_upload'));
      setProofFile(null);
      return;
    }
    if (!auth.currentUser) {
      setSubmitError(t('rch_err_generic'));
      return;
    }
    setUploading(true);
    try {
      /* Filename: timestamp + sanitised original name. Keeps Storage
         tidy and avoids collisions if the user retries. */
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
      const path = `coin_proofs/${auth.currentUser.uid}/${Date.now()}-${safeName}`;
      const r = storageRef(storage, path);
      await uploadBytes(r, file, { contentType: file.type });
      setProofPath(path);
    } catch (err) {
      console.error('proof upload failed:', err);
      setSubmitError(t('rch_err_upload'));
      setProofFile(null);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    setSubmitError('');
    if (!user) {
      setSubmitError(t('rch_err_generic'));
      return;
    }
    if (amountMC < MIN_MC || amountMC > MAX_MC) {
      setSubmitError(t('rch_err_amount'));
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/wallet/purchase-request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          amountMC,
          paymentMethod: method,
          reference: reference.trim() || undefined,
          proofPath:  proofPath ?? undefined,
        }),
      });
      if (!res.ok) {
        setSubmitError(t('rch_err_generic'));
        return;
      }
      const data = (await res.json()) as SubmitResponse;
      setResult(data);
    } catch {
      setSubmitError(t('rch_err_generic'));
    } finally {
      setSubmitting(false);
    }
  };

  /* Build the instruction sentence with the right placeholders filled. */
  const renderInstruction = () => {
    if (!result) return null;
    const reqShort = result.requestId.slice(0, 8);
    if (method === 'ccp' && result.instructions.ccp) {
      return t('rch_inst_ccp', { dzd: result.amountDZD.toLocaleString('fr-FR'), number: result.instructions.ccp, ref: reqShort });
    }
    if (method === 'baridimob' && result.instructions.baridimob) {
      return t('rch_inst_baridi', { dzd: result.amountDZD.toLocaleString('fr-FR'), number: result.instructions.baridimob, ref: reqShort });
    }
    if (method === 'cash_office' && result.instructions.officeAddress) {
      return t('rch_inst_cash', { dzd: result.amountDZD.toLocaleString('fr-FR'), address: result.instructions.officeAddress });
    }
    return t('rch_inst_missing');
  };

  /* The modal contents are intentionally compact to keep mobile (360px)
     happy. We don't render the prototype's `data-i18n` ids — strings
     come from `useT` which is React-state driven. */
  return (
    <div
      ref={rootRef}
      className="modal-bg"
      id="recharge-modal"
      onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
    >
      <div className="modal-box" style={{ maxWidth: 460, padding: 20 }}>
        <div className="modal-header">
          <div className="modal-title">🪙 {t('rch_modal_title')}</div>
          <button className="modal-close" onClick={closeModal} aria-label={t('rch_close')}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {!result ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Amount */}
            <div className="pf-fg">
              <label htmlFor="rch-amt">{t('rch_amount_label')}</label>
              <input
                id="rch-amt"
                type="number"
                className="pf-fi"
                min={MIN_MC}
                max={MAX_MC}
                step={STEP_MC}
                value={amountMC}
                onChange={e => setAmountClamped(Number(e.target.value))}
              />
              <input
                type="range"
                min={MIN_MC}
                max={MAX_MC}
                step={STEP_MC}
                value={amountMC}
                onChange={e => setAmountMC(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--b500)' }}
                aria-label={t('rch_amount_label')}
              />
              <div style={{ fontSize: '.74rem', color: 'var(--text3)', lineHeight: 1.4 }}>
                {t('rch_amount_help', { rate })}
              </div>
              <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, color: 'var(--b500)' }}>
                {t('rch_equiv', { dzd: amountDZD.toLocaleString('fr-FR') })}
              </div>
            </div>

            {/* Method */}
            <div className="pf-fg">
              <label>{t('rch_method_label')}</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(['ccp', 'baridimob', 'cash_office'] as const).map(m => (
                  <label
                    key={m}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '8px 11px',
                      border: `1.5px solid ${method === m ? 'var(--b400)' : 'var(--border2)'}`,
                      background: method === m ? 'var(--b50)' : 'var(--surface)',
                      borderRadius: 'var(--rx)', cursor: 'pointer', fontSize: '.84rem',
                      transition: 'all .18s',
                    }}
                  >
                    <input type="radio" name="rch-method" value={m} checked={method === m} onChange={() => setMethod(m)} style={{ accentColor: 'var(--b500)' }} />
                    <span>{m === 'ccp' ? t('rch_method_ccp') : m === 'baridimob' ? t('rch_method_baridi') : t('rch_method_cash')}</span>
                  </label>
                ))}
                <label
                  aria-disabled
                  title={t('rch_method_card')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 11px',
                    border: '1.5px solid var(--border2)',
                    background: 'var(--surface2)',
                    borderRadius: 'var(--rx)',
                    cursor: 'not-allowed', fontSize: '.84rem',
                    color: 'var(--text3)', opacity: 0.7,
                  }}
                >
                  <input type="radio" disabled style={{ accentColor: 'var(--b500)' }} />
                  <span>{t('rch_method_card')}</span>
                </label>
              </div>
            </div>

            {/* Reference */}
            <div className="pf-fg">
              <label htmlFor="rch-ref">{t('rch_ref_label')}</label>
              <input
                id="rch-ref"
                type="text"
                className="pf-fi"
                placeholder={refPlaceholder}
                value={reference}
                onChange={e => setReference(e.target.value)}
                maxLength={80}
              />
            </div>

            {/* Proof upload */}
            <div className="pf-fg">
              <label htmlFor="rch-proof">{t('rch_proof_label')}</label>
              <input
                id="rch-proof"
                type="file"
                accept="image/*"
                onChange={e => handleProofPick(e.target.files?.[0] ?? null)}
                style={{ fontSize: '.82rem', color: 'var(--text2)' }}
                disabled={uploading || submitting}
              />
              {uploading && <div style={{ fontSize: '.74rem', color: 'var(--text2)' }}>{t('rch_proof_uploading')}</div>}
              {proofPath && !uploading && (
                <div style={{ fontSize: '.74rem', color: 'var(--gn)', fontWeight: 600 }}>
                  {t('rch_proof_uploaded')}
                </div>
              )}
            </div>

            {submitError && (
              <div className="pf-error-banner" role="alert">{submitError}</div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-outline" onClick={closeModal} disabled={submitting} style={{ flex: 1, justifyContent: 'center' }}>
                {t('rch_cancel')}
              </button>
              <button
                className="btn-primary"
                onClick={handleSubmit}
                disabled={submitting || uploading}
                style={{ flex: 2, justifyContent: 'center' }}
              >
                {submitting ? t('rch_submitting') : t('rch_submit')}
              </button>
            </div>
          </div>
        ) : (
          /* Success / instructions view */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <div style={{ fontSize: '2.4rem' }}>✅</div>
              <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: '1.05rem', color: 'var(--text)', marginTop: 4 }}>
                {t('rch_success_title')}
              </div>
            </div>
            <div style={{
              background: dark ? 'var(--surface2)' : 'var(--b50)',
              border: '1px solid var(--b200)',
              borderRadius: 'var(--rx)',
              padding: '12px 14px',
              fontSize: '.85rem',
              color: 'var(--text)',
              lineHeight: 1.55,
              fontWeight: 500,
            }}>
              {renderInstruction()}
            </div>
            <div style={{ fontSize: '.78rem', color: 'var(--text2)', lineHeight: 1.55 }}>
              {t('rch_success_intro')}
            </div>
            <button className="btn-primary" onClick={closeModal} style={{ justifyContent: 'center' }}>
              {t('rch_close')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
