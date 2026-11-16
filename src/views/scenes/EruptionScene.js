import * as THREE from 'three';
import { R, localFrame, toVec3 } from './storm/geo.js';
import { GlobeScene } from './GlobeScene.js';
import { Lightning, glowTexture } from './storm/Lightning.js';
import { PlumePatch } from './eruption/PlumePatch.js';
import { PressureWave } from './eruption/PressureWave.js';
import { KM } from './eruption/units.js';

const PRESETS = {
  approach: { up: 1.05, back: 1.45, lookUp: 0.05, fov: 45, sway: 0.35 },
  horizon: { up: 0.07, back: 1.05, lookUp: 0.09, spin: 0.012, fov: 46 },
};

// The Hunga Tonga eruption on the real globe: GOES-West frames with the umbrella lifted from the
// infrared, the pressure wave racing outwards, and the glow of the vent.
export class EruptionScene extends GlobeScene {
  constructor(container, { onLightning, ...opts }) {
    super(container, { ...opts, rig: { presets: PRESETS, orbit: { minDistance: 0.4, maxDistance: 40 } } });
    this.onLightning = onLightning;
    this.reticleLift = 0.03;
    this.reticleHiddenIn = [];
    this.blast = 0;
    this.energy = 0;
    this.lightningPerMinute = 0;
    this.plumeRadius = 0;

    this.wave = new PressureWave(this.scene);
    this.lightning = new Lightning(this.scene);
    this.glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture(),
        color: 0xffb070,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.glow.renderOrder = 7;
    this.scene.add(this.glow);
  }

  setWorld(maps, frames, region, vent) {
    this.setMaps(maps);
    this.plume = new PlumePatch(this.scene, region);
    this.plume.setFrames(
      frames.map((f) => f.color),
      frames.map((f) => f.ir),
      this.anisotropy,
      this.renderer,
    );
    const frame = localFrame(vent.lat, vent.lon);
    const center = toVec3(vent.lat, vent.lon, R);
    this.subject = { center, heading: frame.north, ...frame };
    this.plume.setVent(center);
    this.glow.position.copy(center).addScaledVector(frame.up, 0.06);
  }

  setEruption({ frame, waveKm, diameterKm, erupted }, { energy, intensity, lightningPerMinute }, sun) {
    this.setSun(sun);
    this.plume?.setSun(this.sunDir);
    this.plume?.setMix(frame.a, frame.b, frame.mix);
    if (this.subject) this.wave.set(this.subject.up, waveKm);
    this.energy = erupted ? energy : 0;
    this.intensity = intensity;
    this.lightningPerMinute = lightningPerMinute;
    this.plumeRadius = (diameterKm / 2) * KM;
    this.pulseRadius = Math.max(0.12, this.plumeRadius * 1.25);
  }

  explode() {
    this.blast = 1.4;
    this.rig.kick(0.6);
  }

  step(dt) {
    this.blast *= Math.exp(-dt * 1.2);
    if (this.subject) this.#maybeStrike(dt);
    const strike = this.lightning.update(dt);
    return Math.min(1.5, strike + this.blast * 0.8);
  }

  draw(dt, time, { flash }) {
    const pulse = 0.85 + 0.15 * Math.sin(time * 9);
    this.glow.material.opacity = Math.min(1, (this.energy * 0.7 + this.blast) * pulse);
    this.glow.scale.setScalar(0.25 + this.energy * 0.3 + this.blast * 0.9);
    this.plume?.setFlash(this.lightning.position, flash * 2);
  }

  // Strikes inside the umbrella, at a rate that follows its growth (illustrative, see mapper).
  #maybeStrike(dt) {
    const rate = this.lightningPerMinute / 60;
    if (rate <= 0 || this.plumeRadius <= 0 || Math.random() > rate * dt) return;
    const { center, up, east, north } = this.subject;
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * this.plumeRadius * 0.8;
    const pos = center.clone().addScaledVector(east, Math.cos(a) * r).addScaledVector(north, Math.sin(a) * r).addScaledVector(up, 0.07);
    const power = 0.4 + Math.random() * 0.6;
    this.lightning.strike(pos, up, power);
    this.onLightning?.({ power, distance: Math.min(1, this.camera.position.distanceTo(pos) / 4) });
  }
}
