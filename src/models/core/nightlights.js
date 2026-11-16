// Measures NASA EIC night-light frames (SVS 5313, "Change in Night Lights between 2012 and 2023")
// pixel by pixel, in the browser. Pure functions over ImageData-like { data, width, height }.
//
// The frames are an equirectangular world map: x runs from 180° W to 180° E and y from 90° N to
// 90° S, so every column and row of a frame is a real longitude and latitude.
import { clamp } from './math.js';

export const COLUMNS = 96; // 3.75° of longitude each

// A pixel counts as a lit place above this luminance (0..255). The dim grey of land and
// Antarctica stays far below it (the 99th percentile of every frame is under 40).
export const LIT_LUMA = 60;

const luma = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

export const lonOfColumn = (c, columns = COLUMNS) => ((c + 0.5) / columns) * 360 - 180;
export const lonOfX = (x) => x * 360 - 180; // x in 0..1 across the map
export const latOfY = (y) => 90 - y * 180; // y in 0..1 down the map

// A yearly frame: how much of the map is lit, and where (per column: share of lit pixels and the
// mean latitude of those pixels).
export function measureLights({ data, width, height }) {
  const lit = new Float64Array(COLUMNS);
  const latSum = new Float64Array(COLUMNS);
  const colWidth = width / COLUMNS;
  let count = 0;
  let glow = 0;
  for (let y = 0; y < height; y++) {
    const lat = latOfY(y / height);
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const l = luma(data[i], data[i + 1], data[i + 2]);
      if (l <= LIT_LUMA) continue;
      const c = Math.min(COLUMNS - 1, Math.floor(x / colWidth));
      lit[c] += 1;
      latSum[c] += lat;
      count += 1;
      glow += l - LIT_LUMA;
    }
  }
  const total = width * height;
  const columnPixels = height * colWidth;
  return {
    litShare: count / total,
    glow: glow / total,
    columns: Array.from(lit, (n) => n / columnPixels),
    latitudes: Array.from(lit, (n, c) => (n ? latSum[c] / n : 0)),
  };
}

// The change map: purple is more light in 2023 than in 2012, orange is less (EIC colour bar).
export const isMore = (r, g, b) => b > g + 25 && b > 60;
export const isLess = (r, g, b) => r > b + 40 && r > 90;

export function measureChange({ data, width, height }) {
  const more = new Float64Array(COLUMNS);
  const less = new Float64Array(COLUMNS);
  const moreLat = new Float64Array(COLUMNS);
  const lessLat = new Float64Array(COLUMNS);
  const colWidth = width / COLUMNS;
  let moreCount = 0;
  let lessCount = 0;
  for (let y = 0; y < height; y++) {
    const lat = latOfY(y / height);
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const c = Math.min(COLUMNS - 1, Math.floor(x / colWidth));
      if (isMore(r, g, b)) {
        more[c] += 1;
        moreLat[c] += lat;
        moreCount += 1;
      } else if (isLess(r, g, b)) {
        less[c] += 1;
        lessLat[c] += lat;
        lessCount += 1;
      }
    }
  }
  const total = width * height;
  const columnPixels = height * colWidth;
  const share = (a) => Array.from(a, (n) => n / columnPixels);
  const mean = (sum, n) => Array.from(n, (v, c) => (v ? sum[c] / v : 0));
  return {
    moreShare: moreCount / total,
    lessShare: lessCount / total,
    more: share(more),
    less: share(less),
    moreLat: mean(moreLat, more),
    lessLat: mean(lessLat, less),
  };
}

// Interpolates two measured column profiles (a, b) by k.
export const blend = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);

// The scale degree (0..steps-1) that a latitude is played at: the further north, the higher.
export const degreeOfLatitude = (lat, steps = 7) => Math.round(clamp((lat + 55) / 125) * (steps - 1));
