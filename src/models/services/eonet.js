import { fetchJSON } from './http.js';

const BASE = 'https://eonet.gsfc.nasa.gov/api/v3';

export async function fetchEvent(id, { fallback } = {}) {
  const res = await fetchJSON(`${BASE}/events/${id}`, { fallback });
  const e = res.data;
  const track = e.geometry
    .filter((g) => g.type === 'Point')
    .map((g) => ({
      date: new Date(g.date),
      kts: g.magnitudeValue,
      value: g.magnitudeValue,
      unit: g.magnitudeUnit,
      lon: g.coordinates[0],
      lat: g.coordinates[1],
    }))
    .sort((a, b) => a.date - b.date);

  return {
    meta: res,
    event: {
      id: e.id,
      title: e.title,
      categories: e.categories.map((c) => c.title),
      sources: e.sources,
      track,
    },
  };
}
