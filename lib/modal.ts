/**
 * Modal helpers — replace the prototype's global `openModal()` / `closeModal()`.
 *
 * Modals in source mark visibility via a `.on` class on the `.modal-bg` wrapper.
 * These helpers preserve that behavior so existing CSS (`#x-modal.modal-bg.on`)
 * keeps working without any class changes.
 */
export function openModal(id: string) {
  if (typeof document === 'undefined') return;
  document.getElementById(id)?.classList.add('on');
}

export function closeModal(id: string) {
  if (typeof document === 'undefined') return;
  document.getElementById(id)?.classList.remove('on');
}
