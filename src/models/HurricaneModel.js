import { Observable } from './core/Observable.js';
import { clamp, lerp } from './core/math.js';
import { distanceKm } from './core/physics.js';
import { fetchEvent } from './services/eonet.js';
import { HELENE, SNAPSHOTS } from '../config/example.js';

// Saffir-Simpson scale, sustained wind in knots.
export const SCALE = [
  { min: 0, code: 'DT', label: 'Depressão tropical', level: 0 },
  { min: 34, code: 'TT', label: 'Tempestade tropical', level: 1 },
  { min: 64, code: 'C1', label: 'Furacão categoria 1', level: 2 },
  { min: 83, code: 'C2', label: 'Furacão categoria 2', level: 3 },
  { min: 96, code: 'C3', label: 'Furacão categoria 3', level: 4 },
  { min: 113, code: 'C4', label: 'Furacão categoria 4', level: 5 },
  { min: 137, code: 'C5', label: 'Furacão categoria 5', level: 6 },
];

// Direction of motion between two fixes, degrees clockwise from north.
function heading(a, b) {
  const east = (b.lon - a.lon) * Math.cos(((a.lat + b.lat) / 2) * (Math.PI / 180));
  const north = b.lat - a.lat;
  return ((Math.atan2(east, north) * 180) / Math.PI + 360) % 360;
}

export function categorize(kts) {
  return [...SCALE].reverse().find((c) => kts >= c.min) ?? SCALE[0];
}

export class HurricaneModel extends Observable {
  event = null;
  meta = null;
  t = 0;
  override = null;

  async load() {
    const { meta, event } = await fetchEvent(HELENE.eonetId, { fallback: SNAPSHOTS.eonet });
    this.meta = meta;
    this.event = event;
    this.emit('loaded', this);
    return this;
  }

  get track() {
    return this.event.track;
  }

  get start() {
    return this.track[0].date;
  }

  get end() {
    return this.track.at(-1).date;
  }

  get peak() {
    return this.track.reduce((best, p) => (p.kts > best.kts ? p : best));
  }

  get bounds() {
    const lons = this.track.map((p) => p.lon);
    const lats = this.track.map((p) => p.lat);
    return { west: Math.min(...lons), east: Math.max(...lons), south: Math.min(...lats), north: Math.max(...lats) };
  }

  timeOf(date) {
    return clamp((date - this.start) / (this.end - this.start));
  }

  // Midnight UTC boundaries inside the track, as fractions of the full duration.
  get dayTicks() {
    const ticks = [];
    const d = new Date(this.start);
    d.setUTCHours(24, 0, 0, 0);
    while (d < this.end) {
      ticks.push({ t: this.timeOf(d), date: new Date(d) });
      d.setUTCDate(d.getUTCDate() + 1);
    }
    return ticks;
  }

  setTime(t) {
    this.t = clamp(t);
    this.emit('change', this.state);
  }

  setOverride(kts) {
    this.override = kts;
    this.emit('change', this.state);
  }

  // Linear interpolation between the two EONET fixes around time t.
  sample(t) {
    const target = this.start.getTime() + t * (this.end - this.start);
    const track = this.track;
    const found = track.findIndex((p) => p.date.getTime() >= target);
    const i = found === -1 ? track.length - 1 : Math.max(1, found);
    const a = track[i - 1];
    const b = track[i];
    const k = clamp((target - a.date) / (b.date - a.date));
    return {
      date: new Date(target),
      kts: lerp(a.kts, b.kts, k),
      lat: lerp(a.lat, b.lat, k),
      lon: lerp(a.lon, b.lon, k),
      headingDeg: heading(a, b),
      // How fast the whole storm travels between the two fixes.
      forwardKmH: distanceKm(a, b) / Math.max(1e-6, (b.date - a.date) / 3600000),
      index: k < 0.5 ? i - 1 : i,
    };
  }

  // Change in sustained wind over the previous 24 hours (null until the track is that long).
  change24(t) {
    const day = 86400000 / (this.end - this.start);
    return t < day ? null : this.sample(t).kts - this.sample(t - day).kts;
  }

  get state() {
    const s = this.sample(this.t);
    const kts = this.override ?? s.kts;
    return {
      ...s,
      kts,
      measuredKts: s.kts,
      isOverride: this.override != null,
      t: this.t,
      category: categorize(kts),
      change24: this.change24(this.t),
    };
  }
}
