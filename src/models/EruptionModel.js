import { Observable } from './core/Observable.js';
import { clamp, lerp } from './core/math.js';
import { measurePlume } from './core/plume.js';
import { fetchLayer, LAYERS } from './services/gibs.js';
import { loadGlobeMaps } from './GlobeMapsModel.js';
import { TONGA, SNAPSHOTS } from '../config/example.js';

const IR_PPD = 25; // pixels per degree
const COLOR_PPD = 50;
const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

// The Hunga Tonga eruption as seen by GOES-West: one infrared and one colour frame per time.
// Every number shown (plume diameter, its growth, the cold core) is measured from the infrared
// frames in the browser; only the pressure wave is modelled, from its measured speed.
export class EruptionModel extends Observable {
  frames = [];
  calls = [];
  t = 0;

  async load(onProgress = () => {}) {
    const total = 2 + TONGA.times.length * TONGA.halves.length * 2;
    let done = 0;
    const track = (promise) =>
      promise.then((res) => {
        done += 1;
        this.calls.push(res);
        onProgress(done, total);
        return res;
      });

    const mapsPromise = loadGlobeMaps(track);
    const { region, halves } = TONGA;
    const height = region.north - region.south;

    const frame = async (time) => {
      const iso = `${TONGA.day}T${time}:00Z`;
      const fetchHalves = (key, layer, ppd, format) =>
        Promise.all(
          halves.map((h) =>
            track(
              fetchLayer(
                { layer, bbox: { south: region.south, north: region.north, west: h.west, east: h.east }, width: (h.east - h.west) * ppd, height: height * ppd, time: iso, format },
                { fallback: SNAPSHOTS.tonga(key, time, h.id) },
              ),
            ),
          ),
        );
      const [ir, color] = await Promise.all([
        fetchHalves('ir', LAYERS.goesWestIR, IR_PPD, 'image/png'),
        fetchHalves('geo', LAYERS.goesWestColor, COLOR_PPD, 'image/jpeg'),
      ]);
      const irCanvas = stitch(ir.map((r) => r.img), IR_PPD, height);
      const ctx = irCanvas.getContext('2d', { willReadFrequently: true });
      const metrics = measurePlume(ctx.getImageData(0, 0, irCanvas.width, irCanvas.height), region, TONGA.vent);
      return {
        time: new Date(Date.parse(iso) + TONGA.scanOffsetMin * 60000),
        label: time,
        ir: irCanvas,
        color: stitch(color.map((r) => r.img), COLOR_PPD, height),
        ...metrics,
      };
    };

    const [maps, frames] = await Promise.all([mapsPromise, Promise.all(TONGA.times.map(frame))]);
    this.maps = maps.maps;
    this.frames = frames;
    this.onset = new Date(TONGA.onset);
    this.peak = frames.reduce((best, f) => (f.diameterKm > best.diameterKm ? f : best));
    this.firstSeen = frames.find((f) => f.diameterKm > 0);
    return this;
  }

  get allLive() {
    return this.calls.every((c) => c.source === 'live');
  }

  get start() {
    return this.frames[0].time;
  }

  get end() {
    return this.frames.at(-1).time;
  }

  timeOf(date) {
    return clamp((date - this.start) / (this.end - this.start));
  }

  get onsetT() {
    return this.timeOf(this.onset);
  }

  // Every full hour inside the window.
  get hourTicks() {
    const ticks = [];
    const d = new Date(this.start);
    d.setUTCMinutes(60, 0, 0);
    while (d <= this.end) {
      ticks.push({ t: this.timeOf(d), date: new Date(d) });
      d.setUTCHours(d.getUTCHours() + 1);
    }
    return ticks;
  }

  setTime(t) {
    this.t = clamp(t);
    this.emit('change', this.state);
  }

  // Which two frames surround `date`, and how far to blend (like the hurricane imagery).
  frameAt(date) {
    const t = date.getTime();
    const f = this.frames;
    for (let i = 0; i < f.length - 1; i++) {
      const t1 = f[i + 1].time.getTime();
      if (t < t1) {
        const k = clamp((t - f[i].time.getTime()) / (t1 - f[i].time.getTime()));
        return { a: i, b: i + 1, k, mix: smoothstep(0.3, 0.7, k), frame: k < 0.5 ? f[i] : f[i + 1] };
      }
    }
    const last = f.length - 1;
    return { a: last, b: last, k: 0, mix: 0, frame: f[last] };
  }

  get state() {
    const date = new Date(this.start.getTime() + this.t * (this.end - this.start));
    const { a, b, mix, frame } = this.frameAt(date);
    const fa = this.frames[a];
    const fb = this.frames[b];
    const sinceOnset = (date - this.onset) / 1000;
    // Between frames the plume grows linearly, but never before the explosion itself.
    const from = Math.max(fa.time.getTime(), this.onset.getTime());
    const k = sinceOnset < 0 ? 0 : clamp((date - from) / (fb.time - from || 1));
    const minutes = Math.max(1, (fb.time - from) / 60000);
    return {
      date,
      t: this.t,
      frame: { a, b, mix, time: frame.time, label: frame.label },
      diameterKm: lerp(fa.diameterKm, fb.diameterKm, k),
      // Speed of the umbrella's edge: half the change in diameter per minute.
      expansionKmMin: a === b || sinceOnset < 0 ? 0 : Math.max(0, (fb.diameterKm - fa.diameterKm) / 2 / minutes),
      coreIndex: lerp(fa.coreIndex, fb.coreIndex, k),
      erupted: sinceOnset >= 0,
      minutesSinceOnset: sinceOnset / 60,
      // Modelled: the pressure wave left the vent at the onset and travels at its measured speed.
      waveKm: Math.max(0, (sinceOnset * TONGA.lambWaveMs) / 1000),
      ...TONGA.vent,
    };
  }
}

// GIBS cannot cross the antimeridian in one request: the halves are drawn side by side.
function stitch(images, ppd, heightDeg) {
  const canvas = document.createElement('canvas');
  canvas.width = TONGA.halves.reduce((w, h) => w + (h.east - h.west) * ppd, 0);
  canvas.height = heightDeg * ppd;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  let x = 0;
  TONGA.halves.forEach((h, i) => {
    const w = (h.east - h.west) * ppd;
    ctx.drawImage(images[i], x, 0, w, canvas.height);
    x += w;
  });
  return canvas;
}
