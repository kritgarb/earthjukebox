import * as THREE from 'three';
import { R, toVec3 } from './geo.js';
import { windColor } from '../../shared/palette.js';

const STEPS = 24;

// The EONET track on the globe: dim for the whole path, bright up to the current moment.
// `value` picks the quantity that colours the line (wind speed by default) and `color` maps it.
export class TrackLine {
  constructor(scene, track, { value = (p) => p.kts, color = windColor, lift = R * 1.012, marker = 0.013 } = {}) {
    const LIFT = lift;
    const points = [];
    const colors = [];
    const c = new THREE.Color();
    for (let i = 0; i < track.length - 1; i++) {
      const a = track[i];
      const b = track[i + 1];
      for (let s = 0; s < STEPS; s++) {
        const k = s / STEPS;
        points.push(toVec3(a.lat + (b.lat - a.lat) * k, a.lon + (b.lon - a.lon) * k, LIFT));
        c.setStyle(color(value(a) + (value(b) - value(a)) * k));
        colors.push(c.r, c.g, c.b);
      }
    }
    const last = track.at(-1);
    points.push(toVec3(last.lat, last.lon, LIFT));
    c.setStyle(color(value(last)));
    colors.push(c.r, c.g, c.b);
    this.count = points.length;

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const lineMaterial = (opacity) => new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity, depthWrite: false });
    this.ghost = new THREE.Line(geometry, lineMaterial(0.25));
    this.live = new THREE.Line(geometry.clone(), lineMaterial(1));
    this.ghost.renderOrder = this.live.renderOrder = 5;

    this.markers = new THREE.Group();
    const ring = new THREE.RingGeometry(marker * 0.6, marker, 24);
    track.forEach((p) => {
      const m = new THREE.Mesh(
        ring,
        new THREE.MeshBasicMaterial({ color: color(value(p)), transparent: true, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true }),
      );
      m.position.copy(toVec3(p.lat, p.lon, LIFT));
      m.lookAt(m.position.clone().multiplyScalar(2));
      m.renderOrder = 5;
      this.markers.add(m);
    });

    scene.add(this.ghost, this.live, this.markers);
  }

  setProgress(t) {
    this.live.geometry.setDrawRange(0, Math.max(2, Math.round(t * this.count)));
  }
}
