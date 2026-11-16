import * as THREE from 'three';
import { intensityColor } from '../../shared/palette.js';

const COUNT = 5200;
const ARMS = 4;
const OUTER = 1.0;
const EYE = 0.11; // matches the eyewall radius drawn by the cloud layer
const LUT_SIZE = 64;

// Each streak is a pure function of time, so the whole field is moved by the vertex shader: the
// CPU only advances three clocks (inflow, eyewall spin, rotation) and the GPU does the rest. It
// used to rewrite and re-upload ~250 KB of positions and colours every frame.
const VERTEX = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  attribute vec3 aSeed; // x: where in its cycle (0..1) or, on the eyewall, the radius; y: angle; z: height
  uniform float flow;     // accumulated inflow
  uniform float eyeSpin;  // accumulated eyewall spin
  uniform float rotation; // accumulated rotation of the whole storm
  uniform float streak;
  uniform vec3 lut[${LUT_SIZE}];
  varying vec3 vColor;

  const float EYE_R = ${EYE.toFixed(4)};
  const float OUTER_R = ${OUTER.toFixed(4)};

  void main() {
    // position.x: 0 tail / 1 head; position.y: 1 on the eyewall; position.z: speed.
    float head = position.x;
    float wall = position.y;
    float speed = position.z;

    float inner = EYE_R * 1.25;
    float outer = OUTER_R * 0.94;
    float len = outer - inner;

    float r;
    float a;
    if (wall > 0.5) {
      r = EYE_R * (1.0 + aSeed.x * 0.8);
      a = aSeed.y + eyeSpin * speed + rotation;
    } else {
      // Counterclockwise inflow: the angle grows as the air spirals toward the eye, and a streak
      // that reaches the eye comes back in at the rim.
      r = outer - fract(aSeed.x + flow * speed / len) * len;
      a = aSeed.y - 2.3 * log(r / OUTER_R) + rotation;
    }
    float tail = a - min(0.7, streak * speed / r);
    float angle = mix(tail, a, head);

    float heat = wall > 0.5 ? 1.0 : 1.0 - (r - EYE_R) / (OUTER_R - EYE_R);
    int k = int(clamp(floor(heat * ${LUT_SIZE - 1}.0 + 0.5), 0.0, ${LUT_SIZE - 1}.0));
    // Eyewall streaks are packed in a small ring; dimmed so additive blending keeps the eye readable.
    float gain = wall > 0.5 ? 0.32 : 1.0;
    vColor = lut[k] * gain * mix(0.05, 1.0, head);

    gl_Position = projectionMatrix * modelViewMatrix * vec4(r * cos(angle), aSeed.z, r * sin(angle), 1.0);
    #include <logdepthbuf_vertex>
  }`;

const FRAGMENT = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform float opacity;
  varying vec3 vColor;
  void main() {
    #include <logdepthbuf_fragment>
    gl_FragColor = vec4(vColor, opacity);
  }`;

// Wind made visible: streaks spiral inward counterclockwise (northern hemisphere) around a
// clear eye, with a taller, faster eyewall. Built in the storm's local frame (x east, y up, z north).
export class WindStreaks {
  constructor(scene) {
    this.intensity = 0.5;
    this.rotation = 0;
    this.flow = 0;
    this.eyeSpin = 0;
    this.lut = new Float32Array(LUT_SIZE * 3);
    this.#buildLut();

    // Two vertices per streak (tail, head). Static: nothing here changes after this loop.
    const position = new Float32Array(COUNT * 6);
    const seed = new Float32Array(COUNT * 6);
    for (let i = 0; i < COUNT; i++) {
      const wall = Math.random() < 0.12;
      const speed = 0.6 + Math.random() * 0.8;
      let u;
      let phase;
      let h;
      if (wall) {
        u = Math.random();
        phase = Math.random() * Math.PI * 2;
        h = 0.015 + Math.random() * 0.2;
      } else {
        u = Math.random();
        phase = (Math.floor(Math.random() * ARMS) * Math.PI * 2) / ARMS + (Math.random() + Math.random() - 1) * 0.45;
        h = 0.06 + Math.random() * 0.08;
      }
      for (let end = 0; end < 2; end++) {
        const o = i * 6 + end * 3;
        position.set([end, wall ? 1 : 0, speed], o);
        seed.set([u, phase, h], o);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seed, 3));

    this.uniforms = {
      flow: { value: 0 },
      eyeSpin: { value: 0 },
      rotation: { value: 0 },
      streak: { value: 0.1 },
      opacity: { value: 0.6 },
      lut: { value: this.lut },
    };
    this.lines = new THREE.LineSegments(
      geometry,
      new THREE.ShaderMaterial({
        uniforms: this.uniforms,
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.lines.frustumCulled = false;
    this.lines.renderOrder = 3;

    this.group = new THREE.Group();
    this.group.matrixAutoUpdate = false;
    this.group.add(this.lines);
    scene.add(this.group);

    this.basis = new THREE.Matrix4();
  }

  get scale() {
    return 0.7 + this.intensity * 0.55;
  }

  get eyeRadius() {
    return EYE * this.scale;
  }

  setPose(center, { east, up, north }) {
    const s = this.scale;
    this.basis.makeBasis(east.clone().multiplyScalar(s), up.clone().multiplyScalar(s), north.clone().multiplyScalar(s));
    this.basis.setPosition(center);
    this.group.matrix.copy(this.basis);
    this.group.matrixWorldNeedsUpdate = true;
  }

  // Seen from inside the eye the streaks cross the sky, so they are kept subtle there.
  setSubtle(on) {
    this.uniforms.opacity.value = on ? 0.22 : 0.6;
  }

  setIntensity(i) {
    if (Math.abs(i - this.intensity) < 0.005) return;
    this.intensity = i;
    this.#buildLut();
  }

  // A random point on the eyewall, in world coordinates (for lightning).
  randomEyewallPoint(target = new THREE.Vector3()) {
    const a = Math.random() * Math.PI * 2;
    const r = EYE * (1.15 + Math.random() * 0.7);
    target.set(r * Math.cos(a), 0.04 + Math.random() * 0.12, r * Math.sin(a));
    return target.applyMatrix4(this.group.matrix);
  }

  update(dt, motion = 1) {
    const i = this.intensity;
    this.rotation += dt * (0.3 + i * 1.5) * motion;
    this.flow += dt * (0.1 + i * 0.4) * motion * 0.35;
    this.eyeSpin += dt * (2 + i * 6) * motion;
    const u = this.uniforms;
    u.rotation.value = this.rotation;
    u.flow.value = this.flow;
    u.eyeSpin.value = this.eyeSpin;
    u.streak.value = 0.05 + i * 0.12;
    // Stronger storms show more of the field.
    this.lines.geometry.setDrawRange(0, Math.floor(COUNT * (0.35 + 0.65 * i)) * 2);
  }

  #buildLut() {
    const c = new THREE.Color();
    for (let k = 0; k < LUT_SIZE; k++) {
      const heat = k / (LUT_SIZE - 1);
      c.setStyle(intensityColor(this.intensity * (0.3 + 0.7 * heat)));
      const gain = 0.35 + 0.65 * heat;
      this.lut.set([c.r * gain, c.g * gain, c.b * gain], k * 3);
    }
  }
}
