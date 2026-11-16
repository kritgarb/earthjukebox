// Browsers cannot move the real mouse pointer, so during a tremor the system cursor is hidden
// and a drawn one (same hotspot, still following the mouse) jitters with the vibration pattern.
const ARROW = `
  <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
    <path d="M2 1.5 L2 19 L6.6 14.8 L9.6 21.6 L12.6 20.3 L9.7 13.6 L16 13.6 Z"
      fill="#fff" stroke="#000" stroke-width="1.4" stroke-linejoin="round"/>
  </svg>`;

let instance = null;

export class CursorShake {
  static get() {
    instance ??= new CursorShake();
    return instance;
  }

  constructor() {
    this.pos = null;
    this.offset = { x: 0, y: 0 };
    this.el = document.createElement('div');
    this.el.className = 'haptic-cursor';
    this.el.hidden = true;
    this.el.innerHTML = ARROW;
    document.body.append(this.el);

    addEventListener(
      'pointermove',
      (e) => {
        if (e.pointerType !== 'mouse') return;
        this.pos = { x: e.clientX, y: e.clientY };
        if (!this.el.hidden) this.#place();
      },
      { passive: true },
    );
  }

  get available() {
    return this.pos != null && matchMedia('(pointer: fine)').matches;
  }

  shake(pattern) {
    if (!this.available || !pattern.length) return;
    clearInterval(this.timer);

    // Pattern [on, off, on, ...] in ms -> list of { start, end, amp } shake windows.
    const windows = [];
    let t = 0;
    pattern.forEach((ms, i) => {
      // Longer pulses (stronger wind) shake wider: 2 px up to 8 px.
      if (i % 2 === 0) windows.push({ start: t, end: t + ms, amp: 2 + Math.min(1, ms / 190) * 6 });
      t += ms;
    });
    const total = t;
    const t0 = performance.now();

    document.documentElement.classList.add('is-cursor-shaking');
    this.el.hidden = false;

    // A plain timer (not animation frames) so the cursor is always restored on time.
    const tick = () => {
      const now = performance.now() - t0;
      if (now >= total) {
        this.#release();
        return;
      }
      const w = windows.find((win) => now >= win.start && now < win.end);
      this.offset.x = w ? (Math.random() * 2 - 1) * w.amp : 0;
      this.offset.y = w ? (Math.random() * 2 - 1) * w.amp : 0;
      this.#place();
    };
    tick();
    this.timer = setInterval(tick, 22);
  }

  #place() {
    if (!this.pos) return;
    this.el.style.transform = `translate(${this.pos.x + this.offset.x}px, ${this.pos.y + this.offset.y}px)`;
  }

  #release() {
    clearInterval(this.timer);
    this.offset.x = 0;
    this.offset.y = 0;
    this.el.hidden = true;
    document.documentElement.classList.remove('is-cursor-shaking');
  }
}
