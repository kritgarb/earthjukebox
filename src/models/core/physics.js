// Physics derived from the measured data, shown live beside it. Pure functions; every constant
// names its source so the numbers on screen can be checked.
import { clamp } from './math.js';

const KT_TO_MS = 0.514444;
const AIR_DENSITY = 1.15; // kg/m³, warm moist air at sea level
const G = 9.80665;
const EARTH_RADIUS_KM = 6371;

export function distanceKm(a, b) {
  const r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r;
  const dLon = (b.lon - a.lon) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

// ---------------------------------------------------------------- Hurricane
// Rapid intensification, as defined by the US National Hurricane Center: sustained wind rising
// at least 30 kt in 24 hours.
export const RAPID_INTENSIFICATION_KT = 30;
// Hurricane threshold of the Saffir-Simpson scale.
const HURRICANE_KT = 64;

export function windPhysics(kts) {
  const v = kts * KT_TO_MS;
  // Dynamic pressure of the wind on a wall facing it: q = ½ ρ v².
  const pressurePa = 0.5 * AIR_DENSITY * v * v;
  return {
    ms: v,
    pressurePa,
    // The same push as a weight resting on each square metre.
    pushKgM2: pressurePa / G,
    // Destructive power grows with the cube of the wind (Emanuel, Nature 2005): compared here
    // with a storm that has just become a hurricane.
    powerRatio: (kts / HURRICANE_KT) ** 3,
  };
}

export const SAO_PAULO_CITY_KM2 = 1521; // IBGE

// ---------------------------------------------------------------- Eruption
export const SAO_PAULO_STATE_KM2 = 248219; // IBGE
export const SAO_PAULO = { name: 'São Paulo', lat: -23.55, lon: -46.63 };
const EARTH_CIRCUMFERENCE_KM = 40075;

export function plumePhysics({ diameterKm, expansionKmMin }) {
  const areaKm2 = Math.PI * (diameterKm / 2) ** 2;
  return {
    areaKm2,
    states: areaKm2 / SAO_PAULO_STATE_KM2,
    // Speed of the umbrella's edge.
    edgeKmH: expansionKmMin * 60,
  };
}

// Where the pressure (Lamb) wave is, and when it reaches a place, for a wave leaving `vent` at
// `onset` with the speed measured around the world.
export function lambWave({ vent, onset, speedMs, place, waveKm }) {
  const km = distanceKm(vent, place);
  const seconds = (km * 1000) / speedMs;
  return {
    distanceKm: km,
    hours: seconds / 3600,
    arrival: new Date(onset.getTime() + seconds * 1000),
    progress: clamp(waveKm / km),
    lapHours: (EARTH_CIRCUMFERENCE_KM * 1000) / speedMs / 3600,
  };
}
