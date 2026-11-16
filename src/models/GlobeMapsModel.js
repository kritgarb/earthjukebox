import { fetchLayer, LAYERS, WORLD } from './services/gibs.js';
import { SNAPSHOTS } from '../config/example.js';

// The two global maps under every experience: Blue Marble by day, Black Marble city lights by night.
export async function loadGlobeMaps(track = (p) => p) {
  const layer = (name, fallback) => track(fetchLayer({ layer: name, bbox: WORLD, width: 2048, height: 1024 }, { fallback }));
  const [day, night] = await Promise.all([
    layer(LAYERS.blueMarble, SNAPSHOTS.dayMap),
    layer(LAYERS.blackMarble, SNAPSHOTS.nightMap),
  ]);
  return { maps: { day: day.img, night: night.img }, calls: [day, night] };
}
