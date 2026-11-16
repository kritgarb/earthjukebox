// Measures NASA EIC visualization frames pixel by pixel, in the browser. Each experience says
// which colours mean what (its `kinds`: a flash, high CO2, a height of forest, a type of aerosol);
// this module counts them per column of the frame. Pure functions over ImageData-like data.

export const COLUMNS = 88;

// Per kind and per column: the share of that column's pixels that belong to the kind, and the
// mean height of those pixels (0 top, 1 bottom). `share` is over `area`, the pixels that count
// as the frame (the globe's disc, or the whole map).
export function measureKinds({ data, width, height }, classify, kindCount, area) {
  const hits = Array.from({ length: kindCount }, () => new Float64Array(COLUMNS));
  const ySum = Array.from({ length: kindCount }, () => new Float64Array(COLUMNS));
  const totals = new Float64Array(kindCount);
  const colWidth = width / COLUMNS;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const k = classify(data[i], data[i + 1], data[i + 2]);
      if (k < 0) continue;
      const c = Math.min(COLUMNS - 1, Math.floor(x / colWidth));
      hits[k][c] += 1;
      ySum[k][c] += y / height;
      totals[k] += 1;
    }
  }
  const columnPixels = height * colWidth;
  const pixelsInArea = area ?? width * height;
  return {
    shares: Array.from(totals, (n) => n / pixelsInArea),
    columns: hits.map((h) => Array.from(h, (n) => n / columnPixels)),
    heights: hits.map((h, k) => Array.from(h, (n, c) => (n ? ySum[k][c] / n : 0.5))),
  };
}

// Interpolates two measured column profiles (a, b) by k.
export const blend = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);

// The scale degree (0..steps-1) that a height in the frame is played at: the higher, the higher.
export const degreeOfHeight = (y, steps = 6) => Math.round(Math.min(1, Math.max(0, 1 - y)) * (steps - 1));

// Moving average of a series of [x, y] pairs, `radius` samples each side.
export function smooth(series, radius = 6) {
  return series.map(([x], i) => {
    let sum = 0;
    let n = 0;
    for (let j = Math.max(0, i - radius); j <= Math.min(series.length - 1, i + radius); j++) {
      sum += series[j][1];
      n += 1;
    }
    return [x, sum / n];
  });
}
