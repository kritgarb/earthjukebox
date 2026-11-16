// Measures the volcanic umbrella in a GOES infrared frame (GIBS Band 13, enhanced colour).
// In that rendering warm surfaces are grey and cold cloud tops are coloured, so a pixel is "cold"
// when its colour is saturated. The plume is the cold region connected to the vent (flood fill),
// limited to MAX_DEG around it so distant thunderstorms are not counted.
const MAX_DEG = 8;
const SEED_PX = 12;

export function measurePlume({ data, width, height }, region, vent) {
  const { south, west, north, east } = region;
  const degX = (east - west) / width;
  const degY = (north - south) / height;
  const cold = (i) => {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    return Math.max(r, g, b) - Math.min(r, g, b) > 50;
  };

  const vx = Math.floor((vent.lon - west) / degX);
  const vy = Math.floor((north - vent.lat) / degY);
  const seen = new Uint8Array(width * height);
  const queue = [];
  for (let y = vy - SEED_PX; y <= vy + SEED_PX; y++) {
    for (let x = vx - SEED_PX; x <= vx + SEED_PX; x++) {
      const i = y * width + x;
      if (x >= 0 && y >= 0 && x < width && y < height && cold(i)) {
        seen[i] = 1;
        queue.push(i);
      }
    }
  }

  let areaKm2 = 0;
  let pixels = 0;
  let core = 0;
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q];
    const x = i % width;
    const y = (i / width) | 0;
    const lat = north - (y + 0.5) * degY;
    const cos = Math.cos((lat * Math.PI) / 180);
    const dx = (west + (x + 0.5) * degX - vent.lon) * cos;
    const dy = lat - vent.lat;
    if (dx * dx + dy * dy > MAX_DEG * MAX_DEG) continue;

    areaKm2 += degX * 111.32 * cos * degY * 110.57;
    pixels += 1;
    // Red tones are the coldest tops: the overshooting core of the eruption column.
    if (data[i * 4] > 170 && data[i * 4 + 1] < 110) core += 1;

    for (const n of [i - 1, i + 1, i - width, i + width]) {
      if (n < 0 || n >= seen.length || seen[n]) continue;
      if ((n === i - 1 && x === 0) || (n === i + 1 && x === width - 1)) continue;
      if (cold(n)) {
        seen[n] = 1;
        queue.push(n);
      }
    }
  }

  return {
    areaKm2,
    diameterKm: 2 * Math.sqrt(areaKm2 / Math.PI),
    coreIndex: pixels ? core / pixels : 0,
  };
}
