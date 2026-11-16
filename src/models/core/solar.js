// Subsolar point (where the Sun is overhead) for a UTC date. Low-precision NOAA/USNO
// approximation, accurate to a fraction of a degree: enough for day/night on the globe.
const rad = Math.PI / 180;

export function subsolarPoint(date) {
  const d = (date.getTime() - Date.UTC(2000, 0, 1, 12)) / 86400000;
  const g = (357.529 + 0.98560028 * d) * rad;
  const q = 280.459 + 0.98564736 * d;
  const L = (q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * rad;
  const e = (23.439 - 0.00000036 * d) * rad;

  const declination = Math.asin(Math.sin(e) * Math.sin(L));
  const rightAscension = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L)) / rad;
  const gmstHours = (18.697374558 + 24.06570982441908 * d) % 24;

  let lon = rightAscension - gmstHours * 15;
  lon = ((((lon + 180) % 360) + 360) % 360) - 180;
  return { lat: declination / rad, lon };
}

// Sun elevation (degrees) seen from a point: > 0 day, < 0 night.
export function sunElevation(date, lat, lon) {
  const s = subsolarPoint(date);
  const p1 = lat * rad;
  const p2 = s.lat * rad;
  const dl = (lon - s.lon) * rad;
  const cosZenith = Math.sin(p1) * Math.sin(p2) + Math.cos(p1) * Math.cos(p2) * Math.cos(dl);
  return 90 - Math.acos(Math.max(-1, Math.min(1, cosZenith))) / rad;
}
