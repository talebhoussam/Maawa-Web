'use client';

/**
 * Minimal stand-in for the prototype's `toast(msg)` function.
 * The prototype animates a `<div class="toast" id="toast">` element.
 * For the port we keep it as a thin shim: write the message into the
 * toast div and add an `.on` class for ~2s. If no toast div exists
 * (SSR or layout missing it), we silently no-op.
 */
export function toast(msg: string): void {
  if (typeof document === 'undefined') return;
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('on');
  window.clearTimeout((toast as unknown as { _t?: number })._t);
  (toast as unknown as { _t?: number })._t = window.setTimeout(() => {
    el.classList.remove('on');
  }, 2000);
}
