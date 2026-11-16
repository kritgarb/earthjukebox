// The experiences made of NASA Earth Information Center frames (SVS visualizations). Each one is
// a video or image from the challenge's list of resources, sampled offline into thirteen or
// fewer frames plus a measured series (public/data/eic-*.json, public/img/eic/*). Frames are
// measured again in the browser: `classify(r, g, b)` says which kind a pixel belongs to (-1 none).
//
// level: how the series becomes the 0..1 intensity that picks the note. unit/scale: how the
// series value is shown. Texts live in the i18n catalogues under `eic.<id>.*`.

const GEDI_PALETTE = [
  [81, 79, 54, 4.9],
  [82, 96, 60, 9.8],
  [97, 119, 70, 14.7],
  [113, 133, 74, 19.6],
  [130, 146, 73, 24.5],
  [150, 163, 81, 29.4],
  [171, 178, 101, 34.3],
  [201, 200, 136, 39.2],
  [227, 221, 185, 44.1],
  [250, 237, 228, 49],
];

// Height (m) of a GEDI pixel read off the colour bar, or -1 when the colour is not on it (ocean,
// space, the shaded edge of the globe).
export function gediHeight(r, g, b) {
  // Ocean, space and dark pixels are far from every colour of the bar: skip them cheaply.
  if (b > r + 25 || r + g + b < 120) return -1;
  let best = 784; // 28 squared
  let height = -1;
  for (const [pr, pg, pb, m] of GEDI_PALETTE) {
    const d = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2;
    if (d < best) {
      best = d;
      height = m;
    }
  }
  return height;
}

const DISK = { radius: 0.455 };

export const EIC = {
  lightning: {
    id: 'lightning',
    svs: 5011,
    data: '/data/eic-lightning.json',
    dir: '/img/eic/lightning/',
    theme: 'theme-city',
    mode: 'series',
    // Share of the globe's disc covered by flashes.
    unit: '%',
    scale: 100,
    digits: 2,
    disk: DISK,
    views: {
      world: { cx: 0.5, cy: 0.5, h: 1.04 },
      zoom: { cx: 0.5, cy: 0.5, h: 0.56 },
    },
    kinds: [
      { id: 'bolt', color: '255, 226, 90', voice: 'lit', octave: 12, classify: (r, g, b) => (r > 170 && g > 140 && b < 120 && r - b > 90 ? 0 : -1) },
    ],
  },
  co2: {
    id: 'co2',
    svs: 5196,
    data: '/data/eic-co2.json',
    dir: '/img/eic/co2/',
    theme: 'theme-fire',
    mode: 'series',
    // Share of the globe's disc painted orange (high CO2 in the visualization).
    unit: '%',
    scale: 100,
    digits: 2,
    disk: DISK,
    views: {
      world: { cx: 0.5, cy: 0.5, h: 1.04 },
      zoom: { cx: 0.5, cy: 0.5, h: 0.56 },
    },
    kinds: [
      { id: 'plume', color: '255, 138, 60', voice: 'more', octave: 12, classify: (r, g, b) => (r > 150 && r - g > 55 && g - b > 10 ? 0 : -1) },
    ],
  },
  gedi: {
    id: 'gedi',
    svs: 4950,
    data: '/data/eic-gedi.json',
    dir: '/img/eic/gedi/',
    theme: '',
    mode: 'series',
    // Mean height of the forest in view, read off the colour bar, in metres.
    unit: 'm',
    scale: 1,
    digits: 1,
    levelRange: [10, 21],
    views: {
      world: { cx: 0.5, cy: 0.5, h: 1.04 },
      zoom: { cx: 0.5, cy: 0.5, h: 0.56 },
    },
    // One lookup per pixel (the height), then the band it falls in.
    classify: (r, g, b) => {
      const h = gediHeight(r, g, b);
      return h < 0 ? -1 : h < 15 ? 0 : h < 30 ? 1 : 2;
    },
    kinds: [
      { id: 'low', color: '190, 160, 110', voice: 'less', octave: 0 },
      { id: 'mid', color: '160, 200, 90', voice: 'lit', octave: 12 },
      { id: 'tall', color: '245, 240, 215', voice: 'more', octave: 24 },
    ],
  },
  aerosols: {
    id: 'aerosols',
    svs: 5669,
    data: '/data/eic-aerosols.json',
    dir: '/img/eic/aerosols/',
    theme: 'theme-ice',
    // One image: the timeline brings the four types in one at a time, so each is heard alone first.
    mode: 'layers',
    unit: '%',
    scale: 100,
    digits: 2,
    views: {
      world: { cx: 0.5, cy: 0.5, h: 1.04 },
      americas: { cx: 0.27, cy: 0.5, h: 0.62 },
      africa: { cx: 0.53, cy: 0.5, h: 0.62 },
      asia: { cx: 0.76, cy: 0.42, h: 0.62 },
    },
    kinds: [
      { id: 'sulfate', color: '110, 240, 70', voice: 'lit', octave: 12, gate: 0, classify: (r, g, b) => (g > 150 && g - r > 50 && g - b > 40 ? 0 : -1) },
      { id: 'seasalt', color: '170, 205, 210', voice: 'air', octave: 24, gate: 0.25, classify: (r, g, b) => (r > 110 && g > 140 && b > 140 && b >= r && Math.abs(g - b) < 30 ? 1 : -1) },
      { id: 'dust', color: '200, 160, 225', voice: 'less', octave: 0, gate: 0.5, classify: (r, g, b) => (r > 130 && b > 150 && g < r - 15 ? 2 : -1) },
      { id: 'smoke', color: '230, 110, 70', voice: 'more', octave: 12, gate: 0.75, classify: (r, g, b) => (r > 150 && r - g > 50 && g >= b ? 3 : -1) },
    ],
  },
  sst: {
    id: 'sst',
    svs: 3912,
    data: '/data/eic-sst.json',
    dir: '/img/eic/sst/',
    theme: 'theme-ice',
    mode: 'series',
    // Share of the map painted in warm colours (orange, red, yellow).
    unit: '%',
    scale: 100,
    digits: 2,
    views: {
      world: { cx: 0.5, cy: 0.5, h: 1.04 },
      americas: { cx: 0.27, cy: 0.5, h: 0.62 },
      africa: { cx: 0.53, cy: 0.5, h: 0.62 },
      asia: { cx: 0.8, cy: 0.5, h: 0.62 },
    },
    kinds: [
      { id: 'cold', color: '110, 170, 255', voice: 'less', octave: 0, classify: (r, g, b) => (b > r + 35 && b >= g - 10 && b > 70 ? 0 : -1) },
      { id: 'mild', color: '110, 240, 90', voice: 'lit', octave: 12, classify: (r, g, b) => (g > r + 25 && g >= b + 15 ? 1 : -1) },
      { id: 'warm', color: '255, 130, 60', voice: 'more', octave: 24, classify: (r, g, b) => (r > 150 && r - b > 60 && r >= g - 10 ? 2 : -1) },
    ],
  },
  airquality: {
    id: 'airquality',
    svs: 5533,
    data: '/data/eic-airquality.json',
    dir: '/img/eic/airquality/',
    theme: 'theme-fire',
    // One frame: the timeline brings the pollutants in one at a time.
    mode: 'layers',
    unit: '%',
    scale: 100,
    digits: 2,
    views: {
      world: { cx: 0.5, cy: 0.5, h: 1.04 },
      zoom: { cx: 0.5, cy: 0.5, h: 0.56 },
    },
    kinds: [
      { id: 'pm25', color: '255, 200, 60', voice: 'less', octave: 0, gate: 0, classify: (r, g, b) => (r > 200 && g > 150 && b < 190 && r - b > 50 ? 0 : -1) },
      { id: 'nox', color: '90, 255, 90', voice: 'lit', octave: 12, gate: 0.34, classify: (r, g, b) => (g > 140 && g > r + 50 && g > b + 50 ? 1 : -1) },
      { id: 'ozone', color: '200, 120, 255', voice: 'air', octave: 24, gate: 0.67, classify: (r, g, b) => (b > 130 && b > g + 35 && r > 70 && b > r + 10 ? 2 : -1) },
    ],
  },
  ocean: {
    id: 'ocean',
    svs: 5425,
    data: '/data/eic-ocean.json',
    dir: '/img/eic/ocean/',
    theme: 'theme-ice',
    // One frame: deep flows first, then the white flows of the upper 600 m.
    mode: 'layers',
    unit: '%',
    scale: 100,
    digits: 2,
    views: {
      world: { cx: 0.5, cy: 0.5, h: 1.04 },
      zoom: { cx: 0.5, cy: 0.5, h: 0.56 },
    },
    kinds: [
      { id: 'deep', color: '80, 150, 255', voice: 'less', octave: 0, gate: 0, classify: (r, g, b) => (r < 140 && b > 170 && b > r + 70 ? 0 : -1) },
      { id: 'surface', color: '255, 255, 255', voice: 'lit', octave: 24, gate: 0.5, classify: (r, g, b) => (r > 190 && g > 200 && b > 225 && b - r >= 12 ? 1 : -1) },
    ],
  },
  river: {
    id: 'river',
    svs: 4960,
    data: '/data/eic-river.json',
    dir: '/img/eic/river/',
    theme: 'theme-ice',
    mode: 'series',
    // Share of the frame in the blue shading of water vapour transport.
    unit: '%',
    scale: 100,
    digits: 1,
    views: {
      world: { cx: 0.5, cy: 0.5, h: 1.04 },
      zoom: { cx: 0.5, cy: 0.5, h: 0.56 },
    },
    kinds: [
      { id: 'vapor', color: '90, 220, 255', voice: 'more', octave: 12, classify: (r, g, b) => (b > 150 && b > r + 60 && g > 90 ? 0 : -1) },
      { id: 'wind', color: '255, 255, 255', voice: 'air', octave: 24, classify: (r, g, b) => (r > 200 && g > 200 && b > 200 && Math.abs(r - b) < 30 ? 1 : -1) },
    ],
  },
};

// Kinds are classified in one pass: the first kind whose test fits wins.
export const classifierOf = (exp) => exp.classify ?? ((r, g, b) => {
  for (const k of exp.kinds) {
    const i = k.classify(r, g, b);
    if (i >= 0) return i;
  }
  return -1;
});
