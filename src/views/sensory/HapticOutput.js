import gsap from 'gsap';
import { prefersReducedMotion } from '../shared/dom.js';
import { CursorShake } from './CursorShake.js';

// Vibration API on phones. On desktop (no motor) the same pattern shakes the mouse pointer,
// and optionally an element on the page.
export class HapticOutput {
  supported = typeof navigator !== 'undefined' && 'vibrate' in navigator;

  constructor(fallbackEl = null) {
    this.fallbackEl = fallbackEl;
    this.cursor = CursorShake.get();
  }

  play(pattern) {
    if (!pattern.length) return pattern;
    if (this.supported) navigator.vibrate(pattern);
    if (!prefersReducedMotion()) {
      this.cursor.shake(pattern);
      this.#shakeElement(pattern);
    }
    return pattern;
  }

  stop() {
    if (this.supported) navigator.vibrate(0);
  }

  #shakeElement(pattern) {
    const el = this.fallbackEl;
    if (!el) return;
    const tl = gsap.timeline();
    pattern.forEach((ms, i) => {
      const seconds = ms / 1000;
      if (i % 2 === 1) {
        tl.to({}, { duration: seconds });
        return;
      }
      const amp = 1.5 + (ms / 190) * 5;
      const steps = Math.max(2, Math.round(seconds / 0.025));
      tl.to(el, { x: amp, duration: seconds / steps, repeat: steps - 1, yoyo: true, ease: 'none' }).set(el, { x: 0 });
    });
  }
}
