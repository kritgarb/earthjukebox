import { prefersReducedMotion } from '../shared/dom.js';

const W = 1600;
const H = 900;

// Camera views in image pixels: centre and width of the part of the world map in frame.
// Europe and Asia are two of the zooms of the NASA video itself.
const VIEWS = {
  world: { cx: W / 2, cy: H / 2, w: W * 1.04 },
  europa: { cx: 844, cy: 215, w: 330 },
  asia: { cx: 1222, cy: 310, w: 540 },
  americas: { cx: 380, cy: 330, w: 760 },
};

const COLORS = { lit: '255, 226, 140', more: '184, 150, 255', less: '255, 138, 60' };

// The EIC night-light frames on a flat world map, with the scan line that is played and a ripple
// where each note sounds. A 2D canvas: the map is already a flat image and needs no globe.
export class NightLightsScene {
  cameraMode = 'world';
  frames = [];
  change = null;
  mix = { a: 0, b: 0, mix: 0, changeMix: 0 };
  scan = 0; // 0..1 across the visible part of the map
  ripples = [];
  beatGlow = 0;

  constructor(container, { level, onFrame }) {
    this.level = level;
    this.onFrame = onFrame;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'stage__canvas';
    this.canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
    container.append(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.view = { ...VIEWS.world };
    this.target = VIEWS.world;
    this.#resize();
    new ResizeObserver(() => this.#resize()).observe(container);
    this.last = performance.now();
    const tick = (now) => {
      this.#frame(now);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  setMaps(frames, change) {
    this.frames = frames;
    this.change = change;
  }

  setMix(frame, changeMix) {
    this.mix = { a: frame.a, b: frame.b, mix: frame.mix, changeMix };
  }

  setCameraMode(mode) {
    if (!VIEWS[mode]) return;
    this.cameraMode = mode;
    this.target = VIEWS[mode];
    if (prefersReducedMotion()) this.view = { ...this.target };
  }

  // The part of the world in view, as 0..1 across the map (x) and down it (y).
  get visible() {
    const { cx, cy, w } = this.view;
    const h = (w * this.canvas.height) / this.canvas.width;
    const scale = Math.min(this.canvas.width / w, this.canvas.height / h);
    const vw = this.canvas.width / scale;
    const vh = this.canvas.height / scale;
    return { x0: Math.max(0, (cx - vw / 2) / W), x1: Math.min(1, (cx + vw / 2) / W), y0: Math.max(0, (cy - vh / 2) / H), y1: Math.min(1, (cy + vh / 2) / H) };
  }

  // Where the scan line is, as 0..1 across the whole map.
  get scanX() {
    const { x0, x1 } = this.visible;
    return x0 + (x1 - x0) * this.scan;
  }

  // A ripple on the map at (lon, lat) for a note that just sounded.
  ping(lon, lat, kind) {
    this.ripples.push({ x: (lon + 180) / 360, y: (90 - lat) / 180, age: 0, kind });
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
    // The camera eases toward its target; with reduced motion it was already placed there.
    const k = 1 - Math.exp(-dt * 3.2);
    for (const key of ['cx', 'cy', 'w']) this.view[key] += (this.target[key] - this.view[key]) * k;
    this.beatGlow *= Math.exp(-dt * 5);
    this.ripples.forEach((r) => (r.age += dt));
    this.ripples = this.ripples.filter((r) => r.age < 2);
    // Paused with the camera at rest, the picture is the one already on screen: drawing it again
    // sixty times a second only keeps the GPU (and a phone's battery) busy.
    const v = this.view;
    const m = this.mix;
    const moving = this.ripples.length > 0 || this.beatGlow > 0.02;
    const picture = `${this.canvas.width}x${this.canvas.height}|${this.frames.length}|${['cx', 'cy', 'w'].map((key) => v[key].toFixed(5)).join()}|${m.a},${m.b},${(m.mix ?? 0).toFixed(4)},${(m.changeMix ?? 0).toFixed(4)}|${this.scan.toFixed(5)}`;
    if (moving || picture !== this.drawn) {
      this.drawn = moving ? null : picture;
      this.#draw();
    }
    this.onFrame?.({ x: 0, y: 0, visible: false });
  }

  #draw() {
    const { ctx, canvas } = this;
    const { cx, cy, w } = this.view;
    const cw = canvas.width;
    const ch = canvas.height;
    ctx.fillStyle = '#05060f';
    ctx.fillRect(0, 0, cw, ch);
    if (!this.frames.length) return;

    const h = (w * ch) / cw;
    const scale = Math.min(cw / w, ch / h);
    const ox = cw / 2 - cx * scale;
    const oy = ch / 2 - cy * scale;
    ctx.imageSmoothingQuality = 'high';
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(scale, scale);

    const { a, b, mix, changeMix } = this.mix;
    const draw = (img, alpha) => {
      if (alpha <= 0) return;
      ctx.globalAlpha = alpha;
      ctx.drawImage(img, 0, 0, W, H);
    };
    draw(this.frames[a].img, 1);
    draw(this.frames[b].img, mix);
    // The change map replaces the last year: the lights fade into purple (more) and orange (less).
    draw(this.change.img, changeMix);
    ctx.globalAlpha = 1;

    // The glow of the band: the whole map breathes a little on every beat.
    if (this.beatGlow > 0.02) {
      ctx.globalCompositeOperation = 'lighter';
      // The alpha goes through draw(), which sets it: passing 1 here added the whole map at full
      // strength on every beat (a hard flash instead of a soft glow).
      draw(changeMix > 0.5 ? this.change.img : this.frames[mix > 0.5 ? b : a].img, this.beatGlow * 0.18);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }

    // Ripples where notes sounded.
    for (const r of this.ripples) {
      const p = r.age / 2;
      const radius = ((10 + p * 70) * this.dpr) / scale;
      ctx.strokeStyle = `rgba(${COLORS[r.kind]}, ${(1 - p) * 0.9})`;
      ctx.lineWidth = (2 * this.dpr) / scale;
      ctx.beginPath();
      ctx.arc(r.x * W, r.y * H, radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    // The scan line, with a soft trail behind it.
    const sx = this.scanX * W;
    const trail = ctx.createLinearGradient(sx - 90, 0, sx, 0);
    trail.addColorStop(0, 'rgba(255, 226, 140, 0)');
    trail.addColorStop(1, 'rgba(255, 226, 140, 0.16)');
    ctx.fillStyle = trail;
    ctx.fillRect(sx - 90, 0, 90, H);
    ctx.fillStyle = 'rgba(255, 240, 190, 0.85)';
    ctx.fillRect(sx - 0.8 * this.dpr / scale, 0, (1.6 * this.dpr) / scale, H);
    ctx.restore();
  }
}
