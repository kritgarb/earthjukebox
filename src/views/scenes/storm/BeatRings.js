import * as THREE from 'three';

// The garden palette of the interface (styles/tokens.css), one colour per beat of the bar.
const COLORS = ['#ffd23f', '#1fc46b', '#3dbefb', '#19c3c9'];
const POOL = 6;
const LIFE = 1.6; // seconds

// The music made visible in the scene: on every beat a ring of light leaves the subject and
// spreads over the surface, like a drum skin answering the stroke. The first beat of the bar is
// the brightest. Rings lie on the subject's tangent plane.
export class BeatRings {
  beatIndex = 0;

  constructor(scene) {
    const geometry = new THREE.RingGeometry(0.982, 1, 128);
    this.rings = Array.from({ length: POOL }, () => {
      const mesh = new THREE.Mesh(
        geometry,
        new THREE.MeshBasicMaterial({
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          depthTest: false,
          side: THREE.DoubleSide,
          // Flat rings: without this three.js draws each one twice and looks its shader program up
          // again on both passes, every frame.
          forceSinglePass: true,
        }),
      );
      mesh.visible = false;
      mesh.renderOrder = 8;
      mesh.matrixAutoUpdate = false;
      scene.add(mesh);
      return { mesh, age: LIFE, radius: 1, gain: 0 };
    });
    this.basis = new THREE.Matrix4();
  }

  // subject: { center, up, east, north }; radius in globe units; strength 0..1.
  emit(subject, radius, strength = 1) {
    const ring = this.rings.reduce((oldest, r) => (r.age > oldest.age ? r : oldest));
    const downbeat = this.beatIndex % 4 === 0;
    ring.age = 0;
    ring.radius = radius;
    ring.gain = (downbeat ? 0.45 : 0.2) * strength;
    ring.subject = subject;
    ring.mesh.material.color.set(COLORS[this.beatIndex % COLORS.length]);
    this.beatIndex += 1;
  }

  update(dt, camera, shown = true) {
    for (const ring of this.rings) {
      ring.age += dt;
      const k = ring.age / LIFE;
      if (k >= 1 || !ring.subject) {
        ring.mesh.visible = false;
        continue;
      }
      const { center, up, east, north } = ring.subject;
      // Not drawn through the planet when the subject is on the far side.
      ring.mesh.visible = shown && camera.position.clone().sub(center).dot(up) > 0;
      // Fast at first, then easing out, as a ripple does.
      const size = ring.radius * (0.15 + 0.85 * (1 - (1 - k) ** 3));
      this.basis.makeBasis(east.clone().multiplyScalar(size), north.clone().multiplyScalar(size), up);
      this.basis.setPosition(center.clone().addScaledVector(up, 0.012));
      ring.mesh.matrix.copy(this.basis);
      ring.mesh.matrixWorldNeedsUpdate = true;
      ring.mesh.material.opacity = ring.gain * (1 - k) ** 2;
    }
  }
}
