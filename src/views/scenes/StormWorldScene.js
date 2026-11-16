import { R, localFrame, toVec3 } from './storm/geo.js';
import { GlobeScene } from './GlobeScene.js';
import { CloudPatch } from './storm/CloudPatch.js';
import { WindStreaks } from './storm/WindStreaks.js';
import { Lightning } from './storm/Lightning.js';
import { TrackLine } from './storm/TrackLine.js';
import { EyeOcean } from './storm/EyeOcean.js';

// Hurricane Helene on a real globe: GIBS imagery, the Sun at its true position for each moment,
// wind streaks and eyewall lightning driven by the EONET intensity.
export class StormWorldScene extends GlobeScene {
  constructor(container, { level, onLightning, onFrame }) {
    super(container, { level, onFrame });
    this.onLightning = onLightning;
    this.eyeStrength = 0;
    this.lightningPerMinute = 0;
    this.ocean = new EyeOcean(this.scene);
    this.lightning = new Lightning(this.scene);
    this.streaks = new WindStreaks(this.scene);
  }

  // The days that are not ready yet are added as they arrive (imagery.onFrame).
  setImagery(imagery, region) {
    this.setMaps(imagery.maps);
    this.clouds = new CloudPatch(this.scene, region);
    this.clouds.setFrames(imagery.frames.map((f) => f?.canvas), this.anisotropy, this.renderer);
    imagery.onFrame = (i, frame) => this.clouds.setFrame(i, frame.canvas);
    imagery.onMaps = (maps) => this.setMaps(maps);
  }

  setTrack(track) {
    this.track = new TrackLine(this.scene, track);
  }

  setStorm({ lat, lon, headingDeg, intensity, eyeStrength, t, sun, frame, lightningPerMinute }) {
    const frameAxes = localFrame(lat, lon);
    const center = toVec3(lat, lon, R * 1.0015);
    const h = (headingDeg * Math.PI) / 180;
    const heading = frameAxes.east.clone().multiplyScalar(Math.sin(h)).addScaledVector(frameAxes.north, Math.cos(h)).normalize();
    this.subject = { center, heading, ...frameAxes };

    this.intensity = intensity;
    this.eyeStrength = eyeStrength;
    this.lightningPerMinute = lightningPerMinute;
    this.streaks.setIntensity(intensity);
    this.pulseRadius = this.streaks.scale * 1.05;
    this.streaks.setPose(center, frameAxes);

    this.setSun(sun);
    this.clouds?.setSun(this.sunDir);
    this.clouds?.setMix(frame.a, frame.b, frame.mix);
    this.clouds?.setEye(center, this.streaks.eyeRadius, eyeStrength);
    this.ocean.setPose(center, frameAxes, this.streaks.eyeRadius * 1.3);
    this.track?.setProgress(t);
  }

  step(dt) {
    if (this.subject) {
      this.streaks.update(dt, this.reduced ? 0.3 : 1);
      this.#maybeStrike(dt);
    }
    return this.lightning.update(dt);
  }

  draw(dt, time, { day, low, flash }) {
    const inEye = this.rig.mode === 'eye';
    this.clouds?.setFlash(this.lightning.position, flash * 2.5);
    this.clouds?.tick(time, inEye);
    this.streaks.setSubtle(inEye);
    this.ocean.update({
      time,
      intensity: this.intensity,
      day,
      sunDir: this.sunDir,
      skyColor: this.sky.horizonColor,
      flashPos: this.lightning.position,
      flashPower: flash * 2,
      visible: Boolean(this.subject) && low > 0.5 && this.eyeStrength > 0.05,
    });
  }

  // Random eyewall strikes at the rate given by the model (strikes per minute).
  #maybeStrike(dt) {
    const rate = this.lightningPerMinute / 60;
    if (rate <= 0 || Math.random() > rate * dt) return;
    const pos = this.streaks.randomEyewallPoint();
    const power = 0.5 + Math.random() * 0.5;
    this.lightning.strike(pos, this.subject.up, power);
    const distance = Math.min(1, this.camera.position.distanceTo(pos) / 4);
    this.onLightning?.({ power, distance });
  }
}
