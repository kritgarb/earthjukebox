import { Observable } from './core/Observable.js';
import { clamp, norm } from './core/math.js';
import { classifierOf } from '../config/eic.js';
import { measureKinds, smooth } from './core/frames.js';
import { t } from '../i18n/index.js';

const smoothstep = (a, b, x) => {
  const k = clamp((x - a) / (b - a));
  return k * k * (3 - 2 * k);
};

// An experience made of NASA Earth Information Center frames (see config/eic.js). The timeline
// follows a series measured offline over the video (a lit share, a height) or, for a single image,
// brings the kinds in one by one. The frames are measured again here, column by column, to play
// the sweep. Everything shown is counted in the pixels of NASA's own visualization.
export class FramesModel extends Observable {
  frames = [];
  series = [];
  stamps = [];
  t = 0;

  constructor(exp) {
    super();
    this.exp = exp;
  }

  async load(onProgress = () => {}) {
    const { exp } = this;
    const res = await fetch(exp.data);
    if (!res.ok) throw new Error(`Não foi possível carregar ${exp.data}`);
    const data = await res.json();
    let done = 0;
    const images = await Promise.all(
      data.frames.map(async (f) => {
        const img = await loadImage(exp.dir + f.file);
        done += 1;
        onProgress(done, data.frames.length);
        return img;
      }),
    );
    const classify = classifierOf(exp);
    this.frames = data.frames.map((f, i) => {
      const img = images[i];
      const area = exp.disk ? Math.PI * (exp.disk.radius * img.naturalWidth) ** 2 : undefined;
      return { ...f, img, ...measureKinds(pixels(img), classify, exp.kinds.length, area) };
    });
    this.aspect = images[0].naturalWidth / images[0].naturalHeight;

    if (exp.mode === 'layers') {
      // The kinds come in at their gates: the level is how much of the map the open ones cover.
      const shares = this.frames[0].shares;
      const raw = [];
      for (let j = 0; j <= 100; j++) {
        const x = j / 100;
        raw.push([x, exp.kinds.reduce((sum, k, i) => sum + shares[i] * (k.gate === 0 ? 1 : smoothstep(k.gate, k.gate + 0.08, x)), 0)]);
      }
      this.series = raw;
      this.buildStamps();
    } else {
      this.series = smooth(data.series, 8);
      this.stamps = data.stamps ?? [];
    }
    const values = this.series.map((s) => s[1]).filter((v) => v > 0);
    this.valueMin = Math.min(...values);
    this.valueMax = Math.max(...values);
    this.valueMean = values.reduce((a, b) => a + b, 0) / values.length;
    this.peak = this.series.reduce((best, s) => (s[1] > best[1] ? s : best), this.series[0]);
    // Largest change per unit of timeline between two samples 4% of the timeline apart.
    const window = 0.04;
    this.maxStep = 1e-9;
    for (const [x, v] of this.series) {
      const j = this.series.find((s) => s[0] >= x + window);
      if (!j) break;
      this.maxStep = Math.max(this.maxStep, Math.abs(j[1] - v) / window);
    }
    return this;
  }

  // The layers' own labels, drawn again when the language changes.
  buildStamps() {
    this.stamps = this.exp.kinds.map((k) => [k.gate, t(`eic.${this.exp.id}.kind.${k.id}.name`)]);
  }

  get first() {
    return this.frames[0];
  }

  setTime(x) {
    this.t = clamp(x);
    this.emit('change', this.state);
  }

  #valueAt(x) {
    const s = this.series;
    const hi = s.findIndex((p) => p[0] >= x);
    if (hi < 0) return s.at(-1)[1];
    if (hi === 0) return s[0][1];
    const a = s[hi - 1];
    const b = s[hi];
    return a[1] + (b[1] - a[1]) * clamp((x - a[0]) / (b[0] - a[0] || 1));
  }

  get state() {
    const { exp } = this;
    const x = this.t;
    const value = this.#valueAt(x);
    const lo = Math.max(0, x - 0.02);
    const hi = Math.min(1, x + 0.02);
    const stepPerUnit = (this.#valueAt(hi) - this.#valueAt(lo)) / (hi - lo || 1);
    const f = this.frames;
    let b = f.findIndex((fr) => fr.t >= x);
    if (b < 0) b = f.length - 1;
    if (b === 0) b = Math.min(1, f.length - 1);
    const a = Math.max(0, b - 1);
    const k = a === b ? 0 : clamp((x - f[a].t) / (f[b].t - f[a].t || 1));
    let label = '';
    for (const [st, text] of this.stamps) if (st <= x + 1e-6) label = text;
    return {
      t: x,
      label,
      frame: { a, b, mix: smoothstep(0.2, 0.8, k) },
      value,
      shown: value * exp.scale,
      level: exp.levelRange ? norm(value, ...exp.levelRange) : norm(value, this.valueMin, this.valueMax),
      vsMean: value / this.valueMean,
      stepPerUnit,
      gates: exp.kinds.map((kind) => (kind.gate ?? 0) <= x + 1e-6),
    };
  }
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Não foi possível carregar ${url}`));
    img.src = url;
  });
}

function pixels(img) {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}
