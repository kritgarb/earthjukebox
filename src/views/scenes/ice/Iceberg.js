import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { R, localFrame, toVec3 } from '../storm/geo.js';

export const KM = 10 / 6371; // world units per km (R = 10)
// A tabular iceberg stands ~40 m above the water; at true scale that is invisible next to its
// 70 km width, so the height is exaggerated.
export const HEIGHT_EXAGGERATION = 60;
const FREEBOARD = 0.04 * HEIGHT_EXAGGERATION * KM;
const DRAFT = FREEBOARD * 0.4;
const DAY_MS = 86400000;

// Deterministic random numbers, so fragments look the same every time the timeline is replayed.
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// Outline of a tabular iceberg with an area of 1 km²: a squarish super-ellipse with a ragged edge.
function outline(random, aspect = 1) {
  const n = 96;
  const phases = [random() * 6.28, random() * 6.28, random() * 6.28];
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const r0 = Math.pow(Math.pow(Math.abs(c), 4) + Math.pow(Math.abs(s), 4), -0.25);
    const jag = 1 + 0.035 * Math.sin(a * 7 + phases[0]) + 0.025 * Math.sin(a * 13 + phases[1]) + 0.015 * Math.sin(a * 29 + phases[2]);
    pts.push(new THREE.Vector2(c * r0 * jag * aspect, s * r0 * jag));
  }
  const area = Math.abs(THREE.ShapeUtils.area(pts));
  const k = 1 / Math.sqrt(area);
  return new THREE.Shape(pts.map((p) => p.multiplyScalar(k)));
}

const WATERLINE = new THREE.Color(0.36, 0.6, 0.78);
const SNOW = new THREE.Color(0.95, 0.97, 1.0);

// Flat snow top with a sharp rim, and cliffs whose normals are smoothed around the outline
// (so the light rolls along them instead of breaking into one band per face).
function slab(shape) {
  const pts = shape.getPoints();
  if (pts[0].equals(pts.at(-1))) pts.pop();
  const n = pts.length;
  const bottom = -DRAFT;

  const wall = { position: [], normal: [], color: [] };
  const c = new THREE.Color();
  for (let i = 0; i <= n; i++) {
    const p = pts[i % n];
    const prev = pts[(i - 1 + n) % n];
    const next = pts[(i + 1) % n];
    // Outward normal for a counter-clockwise outline.
    const nx = next.y - prev.y;
    const ny = -(next.x - prev.x);
    const len = Math.hypot(nx, ny) || 1;
    const a = Math.atan2(p.y, p.x);
    const streak = 0.8 + 0.2 * Math.sin(a * 41 + Math.sin(a * 13) * 2);
    for (const [z, h] of [[bottom, 0], [0, 0.08], [FREEBOARD, 1]]) {
      wall.position.push(p.x, p.y, z);
      wall.normal.push(nx / len, ny / len, 0);
      c.copy(WATERLINE).lerp(SNOW, h).multiplyScalar(THREE.MathUtils.lerp(streak, 1, h * h));
      wall.color.push(c.r, c.g, c.b);
    }
  }
  const index = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < 2; j++) {
      const a = i * 3 + j;
      const b = (i + 1) * 3 + j;
      index.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const walls = new THREE.BufferGeometry();
  walls.setAttribute('position', new THREE.Float32BufferAttribute(wall.position, 3));
  walls.setAttribute('normal', new THREE.Float32BufferAttribute(wall.normal, 3));
  walls.setAttribute('color', new THREE.Float32BufferAttribute(wall.color, 3));
  walls.setIndex(index);

  const top = new THREE.ShapeGeometry(new THREE.Shape(pts));
  top.deleteAttribute('uv');
  top.translate(0, 0, FREEBOARD);
  const snow = new Float32Array(top.attributes.position.count * 3);
  for (let i = 0; i < snow.length; i += 3) snow.set([SNOW.r, SNOW.g, SNOW.b], i);
  top.setAttribute('color', new THREE.BufferAttribute(snow, 3));

  return mergeGeometries([walls, top]);
}

// Height is not scaled with the area (the ice keeps its thickness as it breaks up).
function poseMatrix(target, lat, lon, sizeKm, yaw, lift = 0) {
  const { up, east, north } = localFrame(lat, lon);
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const x = east.clone().multiplyScalar(c).addScaledVector(north, s).multiplyScalar(sizeKm * KM);
  const y = north.clone().multiplyScalar(c).addScaledVector(east, -s).multiplyScalar(sizeKm * KM);
  target.makeBasis(x, y, up);
  target.setPosition(toVec3(lat, lon, R + lift));
  return target;
}

export class Iceberg {
  constructor(scene) {
    this.scene = scene;
    const random = rng(23);
    this.material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.8,
      metalness: 0,
      emissive: 0x0b2236,
      emissiveIntensity: 0.4,
    });
    this.mesh = new THREE.Mesh(slab(outline(random, 1.08)), this.material);
    this.mesh.matrixAutoUpdate = false;
    this.mesh.renderOrder = 3;
    scene.add(this.mesh);
    this.sizeKm = 0;
    this.targetKm = 0;
    this.fragments = [];
    this.pose = new THREE.Matrix4();
  }

  // Pieces that broke off, left behind where the report saw them; they drift apart and melt.
  // All the pieces of one calving are a single BatchedMesh (one draw call; they share a material,
  // and so a melting opacity, anyway). One mesh per piece meant a draw call each, ~140 in all.
  setCalvings(calvings) {
    calvings.forEach((c, ci) => {
      const random = rng(100 + ci * 7);
      const n = Math.max(3, Math.min(9, Math.round(c.lostKm2 / 150)));
      const material = this.material.clone();
      material.transparent = true;

      // Same order of random numbers as when each piece was its own mesh, so they look the same.
      const pieces = [];
      for (let i = 0; i < n; i++) {
        const geometry = slab(outline(random, 0.7 + random() * 0.8));
        pieces.push({
          geometry,
          areaKm2: (c.lostKm2 / n) * (0.5 + random()),
          dir: random() * Math.PI * 2,
          start: 0.5 + random() * 0.4,
          speedKmDay: 0.8 + random() * 2.2,
          yaw: random() * Math.PI,
          spin: (random() - 0.5) * 0.02,
        });
      }
      const vertices = pieces.reduce((sum, p) => sum + p.geometry.attributes.position.count, 0);
      const indices = pieces.reduce((sum, p) => sum + p.geometry.index.count, 0);
      const batch = new THREE.BatchedMesh(n, vertices, indices, material);
      batch.renderOrder = 3;
      batch.visible = false;
      this.scene.add(batch);

      const group = { batch, material, calving: c, pieces: [] };
      for (const { geometry, ...piece } of pieces) {
        const id = batch.addInstance(batch.addGeometry(geometry));
        batch.setVisibleAt(id, false);
        group.pieces.push({ id, ...piece });
      }
      this.fragments.push(group);
    });
  }

  setPose(lat, lon) {
    this.lat = lat;
    this.lon = lon;
  }

  setArea(areaKm2) {
    this.targetKm = Math.sqrt(areaKm2);
    if (!this.sizeKm) this.sizeKm = this.targetKm;
  }

  // Matrix of the main iceberg and of every fragment for the moment `date`.
  update(dt, date, time) {
    // The area drops in steps (one per report); the shape eases into its new size.
    this.sizeKm += (this.targetKm - this.sizeKm) * (1 - Math.exp(-dt * 3));
    const bob = Math.sin(time * 0.6) * FREEBOARD * 0.04;
    poseMatrix(this.mesh.matrix, this.lat, this.lon, this.sizeKm, 0.35, bob);
    this.mesh.matrixWorldNeedsUpdate = true;

    for (const group of this.fragments) {
      const { batch, calving } = group;
      const days = (date - calving.date) / DAY_MS;
      const life = 1 - days / 160;
      const alive = days >= 0 && life > 0;
      batch.visible = alive;
      for (const f of group.pieces) batch.setVisibleAt(f.id, alive);
      if (!alive) continue;
      const latKm = 110.57;
      const lonKm = 111.32 * Math.cos((calving.lat * Math.PI) / 180);
      const parentKm = (f) => Math.sqrt(calving.lostKm2 + f.areaKm2);
      for (const f of group.pieces) {
        const size = Math.sqrt(f.areaKm2) * Math.max(0.15, life);
        const distKm = parentKm(f) * f.start + days * f.speedKmDay;
        const lat = calving.lat + (Math.sin(f.dir) * distKm) / latKm;
        const lon = calving.lon + (Math.cos(f.dir) * distKm) / lonKm;
        poseMatrix(this.pose, lat, lon, size, f.yaw + days * f.spin, bob * 0.5);
        batch.setMatrixAt(f.id, this.pose);
      }
      group.material.opacity = Math.min(1, life * 3);
    }
  }

  get sizeUnits() {
    return this.sizeKm * KM;
  }
}
