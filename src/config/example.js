// The real events behind each experience.
export const HELENE = {
  eonetId: 'EONET_11304',
  name: 'Furacão Helene',
  period: 'setembro de 2024',

  // Area of the high-resolution satellite frames (EPSG:4326).
  region: { south: 16, west: -98, north: 40, east: -74 },

  // One real satellite frame per day. NOAA-20 is the primary source; Aqua and Terra fill its gaps.
  days: ['2024-09-24', '2024-09-25', '2024-09-26', '2024-09-27', '2024-09-28'],
  // Approximate afternoon overpass over the Gulf (13:30 local solar time).
  frameHourUTC: 18.5,
  // Landfall near Perry, in Florida's Big Bend, as a category 4 hurricane (US National Hurricane
  // Center). It is not in the EONET track, so the interface names the source when it says it.
  landfall: { date: '2024-09-27T03:10:00Z', place: 'costa da Flórida', source: 'NHC' },
};

// Hunga Tonga–Hunga Haʻapai, 15 Jan 2022: GOES-West full-disk frames around the eruption.
export const TONGA = {
  name: 'Hunga Tonga–Hunga Haʻapai',
  vent: { lat: -20.55, lon: -175.39 },
  // Onset of the main explosion (USGS).
  onset: '2022-01-15T04:14:45Z',
  // Lamb (pressure) wave speed measured worldwide, m/s (Matoza et al., Science 2022).
  lambWaveMs: 315,
  day: '2022-01-15',
  // GOES full-disk frames are named by their start time but scan north to south: Tonga (20° S)
  // is imaged about 6 minutes later, so the 04:10 frame already shows the 04:14 explosion.
  scanOffsetMin: 6,
  times: ['03:50', '04:00', '04:10', '04:20', '04:30', '04:40', '04:50', '05:00', '05:20', '05:40', '06:00', '06:30', '07:00', '07:30', '08:00'],
  // The region crosses the antimeridian, which one WMS request cannot do: it is fetched in two halves.
  region: { south: -30, west: -188, north: -10, east: -164 },
  halves: [
    { id: 'w', west: 172, east: 180 },
    { id: 'e', west: -180, east: -164 },
  ],
};

// Night lights 2012 to 2023: frames of NASA's Earth Information Center (SVS 5313, Black Marble
// from Suomi NPP VIIRS). The SVS frame sets are 7680 x 2160 EXR files of 20 to 35 MB each, too
// heavy for a browser, so one stable frame per year was cut from the EIC video, cropped to one
// world map and saved at 1600 x 900 (public/img/eic/nightlights).
export const NIGHT_LIGHTS = {
  name: 'Luzes da noite',
  source: 'https://svs.gsfc.nasa.gov/5313/',
  years: [2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023],
  // The yearly series fills the first part of the timeline; the change map the rest.
  seriesEnd: 0.72,
};

export const SNAPSHOTS = {
  nightLights: (name) => `/img/eic/nightlights/${name}.jpg`,
  eonet: '/data/eonet-helene.json',
  tonga: (layer, time, half) => `/img/gibs/tonga/${layer}-${time.replace(':', '')}-${half}.${layer === 'ir' ? 'png' : 'jpg'}`,
  dayMap: '/img/gibs/bluemarble-2048.jpg',
  nightMap: '/img/gibs/blackmarble-2048.jpg',
  frame: (layer, day) => `/img/gibs/helene/${layer}-${day}.jpg`,
};
