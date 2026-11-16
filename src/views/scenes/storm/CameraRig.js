import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const IDLE_BEFORE_AUTOLOOK = 2.5; // seconds

// Framed views that follow the subject. Distances are in globe units (R = 10 = 6371 km):
// up = height above it, back = distance behind it along its heading, spin = slow turn (rad/s),
// sway = how far (rad) the view drifts from side to side, slowly, like a held camera breathing.
const DEFAULT_PRESETS = {
  chase: { up: 1.0, back: 1.7, lookUp: 0.05, lookAhead: 0.35, fov: 50, sway: 0.4 },
};

// Camera behaviours: 'intro' (slow approach from space), 'orbit' (free, mouse-driven),
// 'eye' (inside the eye; drag to look around) and framed presets such as 'chase'.
export class CameraRig {
  mode = 'intro';
  shake = 0;
  yaw = 0;
  pitch = 0.32;
  idle = IDLE_BEFORE_AUTOLOOK;

  constructor(camera, dom, { reducedMotion = false, presets = DEFAULT_PRESETS, orbit = {} } = {}) {
    this.camera = camera;
    this.dom = dom;
    this.reduced = reducedMotion;
    this.presets = presets;
    this.orbitLimits = { minDistance: 0.35, maxDistance: 40, ...orbit };
    this.base = camera.position.clone();
    this.look = new THREE.Vector3();
    this.up = new THREE.Vector3(0, 1, 0);
    // Scratch vectors for update(), which runs every frame.
    this.tmpPos = new THREE.Vector3();
    this.tmpTarget = new THREE.Vector3();
    this.tmpRight = new THREE.Vector3();
    this.tmpDir = new THREE.Vector3();
    this.controls = null;
    this.#bindLook();
  }

  setMode(mode) {
    if (mode === this.mode) return;
    this.mode = mode;
    this.flight = 1;
    this.controls?.dispose();
    this.controls = null;
    this.dom.style.cursor = mode === 'eye' ? 'grab' : '';
    if (mode === 'orbit') {
      // OrbitControls fixes its "up" when created, so it is rebuilt around the storm's local up.
      this.camera.up.copy(this.up);
      // Coming from a close view (inside the eye, at the surface) the orbit would start buried
      // in the clouds: step back to where the whole subject is in frame.
      if (this.camera.position.distanceTo(this.look) < 1.6) {
        const side = this.camera.position.clone().sub(this.look).projectOnPlane(this.up);
        if (side.lengthSq() < 1e-6) side.set(1, 0, 0).projectOnPlane(this.up);
        this.camera.position.copy(this.look).addScaledVector(this.up, 2.2).addScaledVector(side.normalize(), 2.4);
      }
      this.controls = new OrbitControls(this.camera, this.dom);
      Object.assign(this.controls, {
        enableDamping: true,
        dampingFactor: 0.07,
        enablePan: false,
        rotateSpeed: 0.55,
        ...this.orbitLimits,
      });
      this.controls.target.copy(this.look);
    }
  }

  kick(amount) {
    this.shake = Math.min(1, this.shake + amount);
  }

  get altitude() {
    return this.camera.position.length();
  }

  update(dt, storm, time) {
    const { center, up, east, north, heading } = storm;
    const k = 1 - Math.exp(-dt * (this.flight > 0 ? 1.1 : 3.2));
    this.flight = Math.max(0, (this.flight ?? 0) - dt * 0.4);

    if (this.mode === 'orbit') {
      this.controls.target.lerp(center, 1 - Math.exp(-dt * 2));
      this.controls.update();
      this.look.copy(this.controls.target);
      this.base.copy(this.camera.position);
      this.up.copy(up);
      this.#applyShake(time, 0.25);
      this.#lens(50, k);
      return;
    }

    const pos = this.tmpPos.set(0, 0, 0);
    const target = this.tmpTarget.set(0, 0, 0);
    if (this.mode === 'intro') {
      const a = time * 0.04;
      pos.copy(center).addScaledVector(up, 24).addScaledVector(east, Math.cos(a) * 7).addScaledVector(north, -6 + Math.sin(a) * 3);
      target.copy(center).addScaledVector(up, -2);
    } else if (this.presets[this.mode]) {
      const p = this.presets[this.mode];
      // Scaled presets keep the same framing as the subject grows or shrinks. Framings are
      // designed for a landscape screen; on a narrower one (a phone held upright) the camera
      // pulls back so the subject still fits across.
      const fit = Math.pow(Math.max(1, 1.4 / this.camera.aspect), 0.75);
      const s = (p.scaled ? (storm.scale ?? 1) : 1) * fit;
      const a = (p.angle ?? 0) + (this.reduced ? 0 : (p.spin ?? 0) * time + (p.sway ?? 0) * Math.sin(time * 0.17));
      // `towards` names another direction of the subject to frame along (e.g. away from the Sun).
      const base = (p.towards && storm[p.towards]) || heading;
      const right = this.tmpRight.crossVectors(base, up);
      const dir = this.tmpDir.copy(base).multiplyScalar(Math.cos(a)).addScaledVector(right, Math.sin(a));
      pos.copy(center).addScaledVector(up, p.up * s).addScaledVector(dir, -p.back * s);
      target.copy(center).addScaledVector(up, (p.lookUp ?? 0) * s).addScaledVector(dir, (p.lookAhead ?? 0) * s);
    } else if (this.mode === 'eye') {
      // After a moment without input the view slowly pans around the eyewall on its own.
      this.idle += dt;
      if (!this.dragging && this.idle > IDLE_BEFORE_AUTOLOOK && !this.reduced) this.yaw += dt * 0.12;
      const dir = this.tmpDir.copy(east).multiplyScalar(Math.cos(this.yaw)).addScaledVector(north, Math.sin(this.yaw));
      pos.copy(center).addScaledVector(up, 0.022);
      target.copy(pos).addScaledVector(dir, Math.cos(this.pitch)).addScaledVector(up, Math.sin(this.pitch));
    }

    this.base.lerp(pos, k);
    this.look.lerp(target, this.mode === 'eye' && this.flight === 0 ? 1 - Math.exp(-dt * 12) : k);
    this.up.lerp(up, k).normalize();
    this.camera.up.copy(this.up);
    this.camera.position.copy(this.base);
    this.#applyShake(time, this.mode === 'eye' ? 0.15 : 1);
    this.camera.lookAt(this.look);
    this.#lens(this.mode === 'eye' ? 80 : (this.presets[this.mode]?.fov ?? 50), k);
  }

  // Drag to look around inside the eye (mouse or touch).
  #bindLook() {
    let last = null;
    this.dom.addEventListener('pointerdown', (e) => {
      if (this.mode !== 'eye') return;
      this.dragging = true;
      last = { x: e.clientX, y: e.clientY };
      this.dom.setPointerCapture(e.pointerId);
      this.dom.style.cursor = 'grabbing';
    });
    this.dom.addEventListener('pointermove', (e) => {
      if (!this.dragging) return;
      this.yaw -= (e.clientX - last.x) * 0.004;
      this.pitch = THREE.MathUtils.clamp(this.pitch + (e.clientY - last.y) * 0.003, -0.15, 1.35);
      last = { x: e.clientX, y: e.clientY };
      this.idle = 0;
    });
    const end = () => {
      if (!this.dragging) return;
      this.dragging = false;
      this.idle = 0;
      this.dom.style.cursor = this.mode === 'eye' ? 'grab' : '';
    };
    this.dom.addEventListener('pointerup', end);
    this.dom.addEventListener('pointercancel', end);
  }

  #lens(fov, k) {
    if (Math.abs(this.camera.fov - fov) < 0.05) return;
    this.camera.fov += (fov - this.camera.fov) * k;
    this.camera.updateProjectionMatrix();
  }

  #applyShake(time, scale) {
    this.shake *= 0.9;
    if (this.reduced || this.shake < 0.002) return;
    // A slow, small tremor: the ground moving, not the picture rattling.
    const s = this.shake * scale * 0.004 * (this.shakeScale ?? 1);
    this.camera.position.x += Math.sin(time * 19) * s;
    this.camera.position.y += Math.sin(time * 23 + 1.3) * s;
    this.camera.position.z += Math.sin(time * 29 + 2.1) * s;
  }
}
