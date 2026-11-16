import { prefersReducedMotion } from '../shared/dom.js';

// The EIC frames of one experience (a globe or a flat map), the scan line that is played and a
// ripple where each bell sounds. A 2D canvas: the frames are images already, so no 3D scene.
// Camera views are given as the centre (cx, cy) and the visible height (h) in fractions of the
// frame, so they do not depend on its size in pixels.
export class FramesScene {
  cameraMode = 'world';
  frames = [];
  aspect = 1;
  mix = { a: 0, b: 0, mix: 0 };
  scan = 0; // 0..1 across the visible part of the frame
  ripples = [];
  beatGlow = 0;

  constructor(container, { level, onFrame }, { views }) {
    this.level = level;
    this.onFrame = onFrame;
    this.views = views;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'stage__canvas';
    this.canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
    container.append(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.view = { ...views.world };
    this.target = views.world;
    this.#resize();
    new ResizeObserver(() => this.#resize()).observe(container);
    this.last = performance.now();
    const tick = (now) => {
      this.#frame(now);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // `aspect`: width over height of the frames.
  setFrames(frames, aspect) {
    this.frames = frames;
    this.aspect = aspect;
  }

  setMix(frame) {
    this.mix = { a: frame.a, b: frame.b, mix: frame.mix };
  }

  setCameraMode(mode) {
    if (!this.views[mode]) return;
    this.cameraMode = mode;
    this.target = this.views[mode];
    if (prefersReducedMotion()) this.view = { ...this.target };
  }

  // The part of the frame in view, as 0..1 across it (x) and down it (y).
  get visible() {
    const { cx, cy, h } = this.view;
    // Visible width as a fraction of the frame width.
    const w = (h * (this.canvas.width / this.canvas.height)) / this.aspect;
    return {
      x0: Math.max(0, cx - w / 2),
      x1: Math.min(1, cx + w / 2),
      y0: Math.max(0, cy - h / 2),
      y1: Math.min(1, cy + h / 2),
    };
  }

  // Where the scan line is, as 0..1 across the whole frame.
  get scanX() {
    const { x0, x1 } = this.visible;
    return x0 + (x1 - x0) * this.scan;
  }

  // A ripple at (x, y), as 0..1 across and down the frame, for a bell that just sounded.
  ping(x, y, color) {
    this.ripples.push({ x, y, age: 0, color });
    if (this.ripples.length > 90) this.ripples.shift();
  }

  beat() {
    this.beatGlow = 1;
  }

  #resize() {
    const r = this.canvas.parentElement.getBoundingClientRect();
    // Sharp, but within a pixel budget: a 4K screen or a dense phone would otherwise blend three
    // full pictures a frame over ~8 million pixels.
    const budget = Math.sqrt(3.2e6 / Math.max(1, r.width * r.height));
    const dpr = (this.dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1, budget)));
    this.canvas.width = Math.max(2, Math.round(r.width * dpr));
    this.canvas.height = Math.max(2, Math.round(r.height * dpr));
    this.drawn = null; // setting the size clears the canvas
  }

  #frame(now) {
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    const k = 1 - Math.exp(-dt * 3.2);
    for (const key of ['cx', 'cy', 'h']) this.view[key] += (this.target[key] - this.view[key]) * k;
    this.beatGlow *= Math.exp(-dt * 5);
    this.ripples.forEach((r) => (r.age += dt));
    this.ripples = this.ripples.filter((r) => r.age < 2);
    // Paused with the camera at rest, the picture is the one already on screen: drawing it again
    // sixty times a second only keeps the GPU (and a phone's battery) busy.
    const v = this.view;
    const m = this.mix;
    const moving = this.ripples.length > 0 || this.beatGlow > 0.02;
    const picture = `${this.canvas.width}x${this.canvas.height}|${this.frames.length}|${['cx', 'cy', 'h'].map((key) => v[key].toFixed(5)).join()}|${m.a},${m.b},${(m.mix ?? 0).toFixed(4)},${(m.changeMix ?? 0).toFixed(4)}|${this.scan.toFixed(5)}`;
    if (moving || picture !== this.drawn) {
      this.drawn = moving ? null : picture;
      this.#draw();
    }
    this.onFrame?.({ x: 0, y: 0, visible: false });
  }

  #draw() {
    const { ctx, canvas } = this;
    const { cx, cy, h } = this.view;
    const cw = canvas.width;
    const ch = canvas.height;
    ctx.fillStyle = '#05060f';
    ctx.fillRect(0, 0, cw, ch);
    if (!this.frames.length) return;

    // Frame size in canvas pixels at this zoom: the visible height h fills the canvas height.
    const H = ch / h;
    const W = H * this.aspect;
    ctx.imageSmoothingQuality = 'high';
    ctx.save();
    ctx.translate(cw / 2 - cx * W, ch / 2 - cy * H);
    ctx.scale(W, H);

    const { a, b, mix } = this.mix;
    const draw = (img, alpha) => {
      if (alpha <= 0) return;
      ctx.globalAlpha = alpha;
      ctx.drawImage(img, 0, 0, 1, 1);
    };
    draw(this.frames[a].img, 1);
    if (b !== a) draw(this.frames[b].img, mix);
    ctx.globalAlpha = 1;

    if (this.beatGlow > 0.02) {
      ctx.globalCompositeOperation = 'lighter';
      draw(this.frames[mix > 0.5 ? b : a].img, this.beatGlow * 0.2);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }

    // Lines keep the same width on screen whatever the zoom (the context is scaled by W and H).
    const px = (n) => (n * this.dpr) / W;
    const py = (n) => (n * this.dpr) / H;
    for (const r of this.ripples) {
      const p = r.age / 2;
      ctx.strokeStyle = `rgba(${r.color}, ${(1 - p) * 0.9})`;
      ctx.lineWidth = px(2);
      ctx.beginPath();
      ctx.ellipse(r.x, r.y, px(10 + p * 60), py(10 + p * 60), 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    const sx = this.scanX;
    const trail = ctx.createLinearGradient(sx - px(70), 0, sx, 0);
    trail.addColorStop(0, 'rgba(255, 226, 140, 0)');
    trail.addColorStop(1, 'rgba(255, 226, 140, 0.16)');
    ctx.fillStyle = trail;
    ctx.fillRect(sx - px(70), 0, px(70), 1);
    ctx.fillStyle = 'rgba(255, 240, 190, 0.85)';
    ctx.fillRect(sx - px(0.8), 0, px(1.6), 1);
    ctx.restore();
  }
}
