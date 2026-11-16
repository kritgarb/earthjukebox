import { fetchLayer, LAYERS, WORLD } from './services/gibs.js';
import { fetchImage, liveAllowed } from './services/http.js';
import { HELENE, SNAPSHOTS } from '../config/example.js';

const FRAME_SIZE = 2048;
const FILL_SIZE = 1024;

// Real GIBS imagery for the storm: global day/night maps and one composed frame per day.
export class StormImageryModel {
  // One slot per day, filled as each day's frame is ready (null until then).
  frames = HELENE.days.map(() => null);
  times = HELENE.days.map((day) => new Date(Date.parse(`${day}T00:00:00Z`) + HELENE.frameHourUTC * 3600000));
  maps = null;
  calls = [];
  done = false;
  // Called as each frame becomes ready after load() has returned: (index, frame). A day can arrive
  // twice: first the local copy the experience opened with, then the live image that replaces it.
  onFrame = null;
  // Called when the live global maps replace the local copies the experience opened with: (maps).
  onMaps = null;
  // Settles when every frame is ready (load() itself returns once the globe and the first day are).
  complete = null;

  // Resolves when the two global maps and the first day's frame are ready: enough to open the
  // experience. The other days keep coming (see `complete`, `onFrame`); until one is there the
  // nearest ready day stands in for it.
  // The live GIBS answers take 4 to 8 s each, so the experience does not wait for them: it opens
  // with the local copies of the two maps and of the first day (the same NASA images, saved), and
  // every live image takes its place as it arrives. Without live requests (?local, data saver)
  // or without the local copies, it loads as before: live first, the copy on failure.
  async load(onProgress = () => {}) {
    const opening = liveAllowed() ? 5 : 0;
    let total = opening + 2 + HELENE.days.length * 3;
    let done = 0;
    const local = (url) =>
      fetchImage(url).then((res) => {
        done += 1;
        onProgress(done, total);
        return res.img;
      });
    let opened = false;
    if (opening) {
      try {
        const day0 = HELENE.days[0];
        const [day, night, ...sources] = await Promise.all([
          local(SNAPSHOTS.dayMap),
          local(SNAPSHOTS.nightMap),
          ...['noaa20', 'aqua', 'terra'].map((name) => local(SNAPSHOTS.frame(name, day0))),
        ]);
        this.maps = { day, night };
        this.frames[0] = { day: day0, time: this.times[0], canvas: await compose(sources), sources: sources.map(() => 'snapshot') };
        opened = true;
      } catch {
        // A copy is missing: wait for the live images, as before.
        done = 0;
        total -= opening;
      }
    }
    const track = (promise) =>
      promise.then((res) => {
        done += 1;
        this.calls.push(res);
        onProgress(done, total);
        return res;
      });

    const layer = (query, fallback) => track(fetchLayer(query, { fallback }));
    const region = HELENE.region;

    const mapsPromise = Promise.all([
      layer({ layer: LAYERS.blueMarble, bbox: WORLD, width: 2048, height: 1024 }, SNAPSHOTS.dayMap),
      layer({ layer: LAYERS.blackMarble, bbox: WORLD, width: 2048, height: 1024 }, SNAPSHOTS.nightMap),
    ]);

    const loadFrame = (day, i) =>
      Promise.all([
        layer({ layer: LAYERS.noaa20, bbox: region, width: FRAME_SIZE, height: FRAME_SIZE, time: day }, SNAPSHOTS.frame('noaa20', day)),
        layer({ layer: LAYERS.aqua, bbox: region, width: FILL_SIZE, height: FILL_SIZE, time: day }, SNAPSHOTS.frame('aqua', day)),
        layer({ layer: LAYERS.trueColor, bbox: region, width: FILL_SIZE, height: FILL_SIZE, time: day }, SNAPSHOTS.frame('terra', day)),
      ]).then(async (sources) => {
        const frame = {
          day,
          time: this.times[i],
          // An ImageBitmap (composed in a worker) or, where workers cannot do it, a canvas.
          canvas: await compose(sources.map((s) => s.img)),
          sources: sources.map((s) => s.source),
        };
        this.frames[i] = frame;
        this.onFrame?.(i, frame);
        return frame;
      });

    // The maps and the first day go first and alone, so they are not slowed by the other days.
    const first = loadFrame(HELENE.days[0], 0);
    const liveMaps = mapsPromise.then(([day, night]) => {
      this.maps = { day: day.img, night: night.img };
      if (opened) this.onMaps?.(this.maps);
    });
    // Already open with the local copies: the live images arrive behind the experience.
    if (!opened) await Promise.all([liveMaps, first]);

    const rest = HELENE.days.slice(1).map((d, i) => loadFrame(d, i + 1));
    this.complete = Promise.all([first, ...rest, liveMaps]).then(() => {
      composer?.terminate();
      composer = null;
      this.done = true;
      return this;
    });
    // Whoever is waiting on `complete` handles a failure; this only keeps it from going unheard.
    this.complete.catch(() => {});
    return this;
  }

  get allLive() {
    return this.calls.every((c) => c.source === 'live');
  }

  // Which two daily frames surround `date`, and how far to blend. The blend happens in a short
  // window between overpasses so the storm is never shown doubled for long.
  frameAt(date) {
    const t = date.getTime();
    const times = this.times;
    const result = (a, b, mix) => {
      const na = this.#near(a);
      const nb = this.#near(b);
      return { a: na, b: nb, mix, frame: this.frames[mix < 0.5 ? na : nb] };
    };
    if (t <= times[0].getTime()) return result(0, 0, 0);
    for (let i = 0; i < times.length - 1; i++) {
      const t0 = times[i].getTime();
      const t1 = times[i + 1].getTime();
      if (t < t1) {
        const k = (t - t0) / (t1 - t0);
        return result(i, i + 1, smoothstep(0.4, 0.6, k));
      }
    }
    const last = times.length - 1;
    return result(last, last, 0);
  }

  // The day closest to `i` whose frame is ready (the first day always is, once load() returns).
  #near(i) {
    const f = this.frames;
    if (f[i]) return i;
    for (let d = 1; d < f.length; d++) {
      if (f[i - d]) return i - d;
      if (f[i + d]) return i + d;
    }
    return 0;
  }
}

let composer = null;
let jobs = 0;
const pending = new Map();

function startComposer() {
  if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined' || typeof createImageBitmap === 'undefined') return null;
  try {
    const worker = new Worker(new URL('../workers/composeFrame.worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data: { id, bitmap } }) => pending.get(id)?.resolve(bitmap);
    worker.onerror = (e) => {
      // Whatever was waiting (and whatever comes next) is composed on the main thread instead.
      pending.forEach(({ reject }) => reject(e));
      pending.clear();
      worker.terminate();
      if (composer === worker) composer = null;
    };
    return worker;
  } catch {
    return null;
  }
}

async function compose(images) {
  composer ??= startComposer();
  if (!composer) return composeFrame(images);
  try {
    const bitmaps = await Promise.all(images.map((img) => createImageBitmap(img)));
    const id = jobs++;
    const done = new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
    composer.postMessage({ id, bitmaps }, bitmaps);
    const bitmap = await done;
    pending.delete(id);
    return bitmap;
  } catch {
    return composeFrame(images);
  }
}

// Primary image first; black (no-data) pixels are filled from the next sources in order.
function composeFrame(images) {
  const canvas = document.createElement('canvas');
  canvas.width = FRAME_SIZE;
  canvas.height = FRAME_SIZE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  const layers = images.map((img) => {
    ctx.clearRect(0, 0, FRAME_SIZE, FRAME_SIZE);
    ctx.drawImage(img, 0, 0, FRAME_SIZE, FRAME_SIZE);
    return ctx.getImageData(0, 0, FRAME_SIZE, FRAME_SIZE).data;
  });

  const out = ctx.createImageData(FRAME_SIZE, FRAME_SIZE);
  const px = out.data;
  for (let i = 0; i < px.length; i += 4) {
    let src = null;
    for (const layer of layers) {
      if (layer[i] + layer[i + 1] + layer[i + 2] > 24) {
        src = layer;
        break;
      }
    }
    if (src) {
      px[i] = src[i];
      px[i + 1] = src[i + 1];
      px[i + 2] = src[i + 2];
      px[i + 3] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);
  return canvas;
}

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
