import * as THREE from 'three';

// A bolt plus a glow sprite that fades smoothly.
export class Lightning {
  constructor(scene) {
    this.power = 0;
    this.position = new THREE.Vector3();

    this.glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture(),
        color: 0xd6e4ff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.glow.renderOrder = 4;

    this.boltGeometry = new THREE.BufferGeometry().setFromPoints(Array.from({ length: 8 }, () => new THREE.Vector3()));
    this.bolt = new THREE.Line(
      this.boltGeometry,
      new THREE.LineBasicMaterial({ color: 0xf2f6ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    this.bolt.renderOrder = 4;
    scene.add(this.glow, this.bolt);
  }

  strike(position, up, power) {
    this.position.copy(position);
    this.power = power;
    this.glow.position.copy(position);
    this.glow.scale.setScalar(0.25 + power * 0.35);

    const side = new THREE.Vector3().randomDirection().projectOnPlane(up).normalize();
    const pts = this.boltGeometry.attributes.position;
    for (let i = 0; i < pts.count; i++) {
      const k = i / (pts.count - 1);
      const p = position.clone().addScaledVector(up, 0.14 * (1 - k) - 0.03);
      p.addScaledVector(side, (Math.random() - 0.5) * 0.03 * (i === 0 ? 0 : 1));
      pts.setXYZ(i, p.x, p.y, p.z);
    }
    pts.needsUpdate = true;
  }

  update(dt) {
    // A glow that swells and fades like a held note, rather than a strobe.
    this.power *= Math.exp(-dt * 3.5);
    const glow = this.power > 0.03 ? this.power : 0;
    this.glow.material.opacity = glow * 0.8;
    this.bolt.material.opacity = Math.max(0, glow - 0.3) * 0.9;
    return glow * 0.6;
  }
}

export function glowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(190,210,255,0.55)');
  g.addColorStop(1, 'rgba(120,150,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}
