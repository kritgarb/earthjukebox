import { fetchImage } from './http.js';

const WMS = 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi';

export const LAYERS = {
  noaa20: 'VIIRS_NOAA20_CorrectedReflectance_TrueColor',
  aqua: 'MODIS_Aqua_CorrectedReflectance_TrueColor',
  trueColor: 'MODIS_Terra_CorrectedReflectance_TrueColor',
  blueMarble: 'BlueMarble_ShadedRelief_Bathymetry',
  blackMarble: 'VIIRS_Black_Marble',
  goesWestIR: 'GOES-West_ABI_Band13_Clean_Infrared',
  goesWestColor: 'GOES-West_ABI_GeoColor',
};

export const WORLD = { south: -90, west: -180, north: 90, east: 180 };

export function wmsUrl({ layer, bbox, width, height, time, format = 'image/jpeg' }) {
  const q = new URLSearchParams({
    SERVICE: 'WMS',
    REQUEST: 'GetMap',
    VERSION: '1.3.0',
    LAYERS: layer,
    CRS: 'EPSG:4326',
    BBOX: `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`,
    WIDTH: String(width),
    HEIGHT: String(height),
    FORMAT: format,
  });
  if (time) q.set('TIME', time);
  return `${WMS}?${q}`;
}

export function fetchLayer(query, { fallback } = {}) {
  return fetchImage(wmsUrl(query), { fallback });
}
