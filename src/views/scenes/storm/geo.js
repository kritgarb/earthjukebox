import * as THREE from 'three';

export const R = 10; // globe radius in world units
const DEG = Math.PI / 180;

// Same parameterization as THREE.SphereGeometry, so equirectangular textures line up.
export function toVec3(lat, lon, r = R, target = new THREE.Vector3()) {
  const phi = (lon + 180) * DEG;
  const theta = (90 - lat) * DEG;
  return target.set(-r * Math.cos(phi) * Math.sin(theta), r * Math.cos(theta), r * Math.sin(phi) * Math.sin(theta));
}

// Local tangent frame at a coordinate: up (out of the ground), east and north.
export function localFrame(lat, lon) {
  const p = toVec3(lat, lon, 1);
  const up = p.clone().normalize();
  const east = toVec3(lat, lon + 0.01, 1).sub(p).normalize();
  const north = toVec3(lat + 0.01, lon, 1).sub(p).normalize();
  return { up, east, north };
}

export function sunDirection({ lat, lon }) {
  return toVec3(lat, lon, 1).normalize();
}

// Sphere patch covering an EPSG:4326 box; UVs run 0..1 across it (north at v = 1).
export function patchGeometry(region, radius, segments) {
  return new THREE.SphereGeometry(
    radius,
    segments,
    segments,
    (region.west + 180) * DEG,
    (region.east - region.west) * DEG,
    (90 - region.north) * DEG,
    (region.north - region.south) * DEG,
  );
}
