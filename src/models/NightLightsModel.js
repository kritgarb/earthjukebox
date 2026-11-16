import { Observable } from './core/Observable.js';
import { clamp, norm } from './core/math.js';
import { measureChange, measureLights } from './core/nightlights.js';
import { NIGHT_LIGHTS, SNAPSHOTS } from '../config/example.js';

const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

// NASA Earth Information Center night lights (SVS 5313, Black Marble from Suomi NPP VIIRS): one
// frame per year from 2012 to 2023, then the map of what changed. Every number shown (lit share,
// growth, more and less light) is measured pixel by pixel from those frames in the browser.
export class NightLightsModel extends Observable {
  frames = [];
  change = null;
  t = 0;

  async load(onProgress = () => {}) {
    const { years } = NIGHT_LIGHTS;
    const total = years.length + 1;
    let done = 0;
    const read = async (url) => {
      const img = await loadImage(url);
      done += 1;
      onProgress(done, total);
      return img;
    };

    const [images, changeImage] = await Promise.all([
      Promise.all(years.map((y) => read(SNAPSHOTS.nightLights(y)))),
      read(SNAPSHOTS.nightLights('change')),
    ]);

    this.frames = images.map((img, i) => ({ year: years[i], img, ...measureLights(pixels(img)) }));
    this.change = { img: changeImage, ...measureChange(pixels(changeImage)) };

    const lit = this.frames.map((f) => f.litShare);
    this.litMin = Math.min(...lit);
    this.litMax = Math.max(...lit);
    // Largest year-to-year step, the scale of "how fast it is changing".
    this.maxStep = Math.max(...this.frames.slice(1).map((f, i) => Math.abs(f.litShare - this.frames[i].litShare)));
    return this;
  }

  get first() {
    return this.frames[0];
  }

  get last() {
    return this.frames.at(-1);
  }

  setTime(t) {
    this.t = clamp(t);
    this.emit('change', this.state);
  }

  // The first part of the timeline is the yearly series, the rest is the change map.
  get seriesEnd() {
    return NIGHT_LIGHTS.seriesEnd;
  }

  // 0..1 timeline position of each year.
  tOfYear(year) {
    const { years } = NIGHT_LIGHTS;
    return ((year - years[0]) / (years.at(-1) - years[0])) * this.seriesEnd;
  }

  get state() {
    const n = this.frames.length;
    const series = clamp(this.t / this.seriesEnd);
    const pos = series * (n - 1);
    const a = Math.min(n - 2, Math.floor(pos));
    const k = pos - a;
    const fa = this.frames[a];
    const fb = this.frames[a + 1];
    // The frames cross-fade in a short window around each year, so each one is seen for a while.
    const mix = smoothstep(0.25, 0.75, k);
    const litShare = fa.litShare + (fb.litShare - fa.litShare) * k;
    // 0 while the series plays, 1 once the lights have given way to the change map.
    const changeMix = smoothstep(this.seriesEnd, this.seriesEnd + 0.1, this.t);
    const stepPerYear = fb.litShare - fa.litShare;
    return {
      t: this.t,
      year: fa.year + k,
      shownYear: k < 0.5 ? fa.year : fb.year,
      frame: { a, b: a + 1, mix },
      litShare,
      litGrowth: litShare / this.first.litShare - 1,
      litLevel: norm(litShare, this.litMin, this.litMax),
      // How fast the lit area is growing right now (a drop, like 2020, counts as change too).
      stepPerYear,
      change: this.change,
      changeMix,
      inChange: changeMix > 0.02,
      // The share of the map that is brighter or dimmer than in 2012, revealed as the map fades in.
      moreShare: this.change.moreShare * changeMix,
      lessShare: this.change.lessShare * changeMix,
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

// The pixels of an image at its own size (1600 x 900).
function pixels(img) {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}
