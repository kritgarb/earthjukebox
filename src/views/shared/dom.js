export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

export function setText(target, text) {
  const el = typeof target === 'string' ? $(target) : target;
  if (el && el.textContent !== text) el.textContent = text;
}

export function setPressed(button, on) {
  button.setAttribute('aria-pressed', String(Boolean(on)));
}

export function esc(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

export const prefersReducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
