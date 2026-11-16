import * as THREE from "three";
import { R, sunDirection } from "./storm/geo.js";
import { Earth } from "./storm/Earth.js";
import { CameraRig } from "./storm/CameraRig.js";
import { PostFX } from "./storm/PostFX.js";
import { SkyDome } from "./storm/SkyDome.js";
import { BeatRings } from "./storm/BeatRings.js";
import { prefersReducedMotion } from "../shared/dom.js";
import { PerfHud } from "../shared/PerfHud.js";

const { smoothstep } = THREE.MathUtils;

// The shared world of every experience: a real globe (Blue/Black Marble lit by the true Sun),
// stars, a sky near the surface, the camera rig and the cinematic post-processing.
// Subclasses add their phenomenon in step() (simulation) and draw() (per-frame uniforms), and
// keep `this.subject` = { center, up, east, north, heading } so the camera and reticle can follow it.
const RATIO_KEY = "earth-jukebox:ratio";
const STEPS = [0.6, 0.7, 0.85, 1.0, 1.1, 1.25, 1.5];
const recallRatio = () => {
  try {
    const v = parseFloat(sessionStorage.getItem(RATIO_KEY));
    return v >= 0.6 && v <= 1.5 ? v : null;
  } catch {
    return null;
  }
};
const rememberRatio = (v) => {
  try {
    sessionStorage.setItem(RATIO_KEY, v.toFixed(2));
  } catch {
    /* private mode: it just starts from the default next time */
  }
};

export class GlobeScene {
  subject = null;
  intensity = 0.5;
  reticleLift = 0.02;
  reticleHiddenIn = ["eye"];
  playing = false;
  sceneTime = 0;

  setPlaying(on) {
    this.playing = on;
  }

  constructor(container, { level, onFrame, rig = {} }) {
    this.level = level;
    this.onFrame = onFrame;
    this.reduced = prefersReducedMotion();
    this.sunDir = new THREE.Vector3(1, 0, 0);

    // The picture goes through the post-processing targets, where the canvas' own antialiasing
    // does nothing but cost memory. The resolution starts moderate and then follows the frame
    // rate (see #adapt): a smooth scene matters more to the music than a sharp one.
    // Depth precision from a near plane of 0.0005 to a far plane of 900 needs more than a plain
    // buffer gives. The default is the logarithmic one, which writes depth in every fragment and so
    // switches off early-z. ?depth=reverse tries a reversed float depth buffer instead (same
    // precision, early-z kept) where the GPU has EXT_clip_control; compare both with ?perf.
    const wantsReverse =
      new URLSearchParams(location.search).get("depth") === "reverse";
    this.reversedDepth =
      wantsReverse &&
      Boolean(
        document
          .createElement("canvas")
          .getContext("webgl2")
          ?.getExtension("EXT_clip_control"),
      );
    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      logarithmicDepthBuffer: !this.reversedDepth,
      reversedDepthBuffer: this.reversedDepth,
      powerPreference: "high-performance",
    });
    // The ratio is capped by a pixel budget as well: a big screen at 100% (a TV, an exhibition
    // monitor) would otherwise start at ~10 million pixels and spend several seconds of choppy
    // frames before the adaptation below brought it down.
    const pixels = Math.max(1, container.clientWidth * container.clientHeight);
    const budget = (megapixels) => Math.sqrt((megapixels * 1e6) / pixels);
    this.maxRatio = Math.min(devicePixelRatio, 1.5, Math.max(0.6, budget(5)));
    // The ratio the last experience settled on (same machine, same screen) is the best first guess.
    this.ratio = Math.min(
      this.maxRatio,
      1.1,
      Math.max(0.6, budget(2.5)),
      recallRatio() ?? Infinity,
    );
    // Resolution moves in a few fixed steps, not continuously: every change reallocates all the
    // render targets of the post-processing, which is itself a hitch.
    this.steps = STEPS.filter((s) => s <= this.maxRatio + 0.01);
    if (!this.steps.length) this.steps = [this.maxRatio];
    this.ratio =
      [...this.steps].reverse().find((s) => s <= this.ratio + 0.01) ??
      this.steps[0];
    this.renderer.setPixelRatio(this.ratio);
    this.renderer.setClearColor(0x0a1128);
    // Filmic tone mapping keeps bright cloud decks from clipping to flat white.
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.8;
    container.appendChild(this.renderer.domElement);
    this.anisotropy = this.renderer.capabilities.getMaxAnisotropy();

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.0005, 900);
    this.camera.position.set(0, 0, R * 4);

    this.sky = new SkyDome(this.scene);
    this.#addStars();
    this.earth = new Earth(this.scene);
    this.rings = new BeatRings(this.scene);
    this.rig = new CameraRig(this.camera, this.renderer.domElement, {
      reducedMotion: this.reduced,
      ...rig,
    });
    this.fx = new PostFX(this.renderer, this.scene, this.camera);

    new ResizeObserver(() => this.#resize(container)).observe(container);
    this.#resize(container);

    this.perf = { last: 0, sum: 0, frames: 0, hold: 0, calm: 0, cooldown: 0 };
    this.lastDraw = 0;
    this.timer = new THREE.Timer();
    this.projected = new THREE.Vector3();
    this.tmpUp = new THREE.Vector3();
    this.tmpToCamera = new THREE.Vector3();
    // ?perf in the address: a readout of frame time, draw calls and resolution (see PerfHud).
    if (new URLSearchParams(location.search).has("perf"))
      this.hud = new PerfHud(this);
    this.renderer.setAnimationLoop((t) => this.#frame(t));
  }

  setMaps({ day, night }) {
    this.earth.setMaps(day, night, this.anisotropy);
  }

  setSun(sun) {
    this.sunDir.copy(sunDirection(sun));
    this.earth.setSun(this.sunDir);
  }

  setCameraMode(mode) {
    this.rig.setMode(mode);
  }

  get cameraMode() {
    return this.rig.mode;
  }

  // Called on every beat of the music: a ring of light leaves the subject. Subclasses say how
  // wide their subject is with pulseRadius.
  pulseRadius = 0.5;

  beat() {
    // From inside the eye a ring on the ground would cross the whole sky.
    if (
      this.subject &&
      !this.reduced &&
      !["intro", "eye"].includes(this.rig.mode)
    )
      this.rings.emit(
        this.subject,
        this.pulseRadius,
        0.5 + this.intensity * 0.5,
      );
  }

  // Hooks for subclasses. step() runs the simulation and returns the light flash (0..1).
  step(/* dt, time */) {
    return 0;
  }

  draw(/* dt, time, { day, low, flash, level } */) {}

  // Keeps the scene near 60 frames a second by trading resolution: checked once a second, lowered
  // quickly when frames run long, raised slowly when there is room. Bloom goes last.
  #adapt(timestamp) {
    const p = this.perf;
    const ms = timestamp - p.last;
    p.last = timestamp;
    // A hidden tab or a long pause is not a slow frame.
    if (ms <= 0 || ms > 250) return;
    p.sum += ms;
    p.frames += 1;
    if (p.sum < 1000) return;
    const avg = p.sum / p.frames;
    p.sum = 0;
    p.frames = 0;
    if (p.hold > 0) {
      p.hold -= 1;
      return;
    }
    let i = this.steps.indexOf(this.ratio);
    if (avg > 24) {
      // Slow: down one step (two when very slow), and no climbing back for a while.
      i = Math.max(0, i - (avg > 34 ? 2 : 1));
      p.calm = 0;
      p.cooldown = 20;
      // The glow costs ~16 framebuffer switches a frame: it goes before the picture turns soft.
      if (this.ratio <= 0.85) this.fx.setBloom(false);
    } else if (avg < 17.5) {
      // Room to spare: three calm seconds in a row, and no recent slowdown, to go up one step.
      p.cooldown = Math.max(0, p.cooldown - 1);
      p.calm += 1;
      if (p.calm >= 3 && p.cooldown === 0) {
        i = Math.min(this.steps.length - 1, i + 1);
        p.calm = 0;
      }
    } else {
      p.calm = 0;
    }
    const ratio = this.steps[i];
    rememberRatio(ratio);
    if (ratio === this.ratio) return;
    this.ratio = ratio;
    this.renderer.setPixelRatio(ratio);
    this.fx.setPixelRatio(ratio);
    // Let the new size settle before judging it.
    p.hold = 1;
  }

  #frame(timestamp) {
    // Behind the intro card nobody is steering: 30 frames a second is plenty, and the slower
    // frames must not be mistaken by #adapt for a struggling GPU.
    if (document.body.classList.contains("is-intro")) {
      if (timestamp - this.lastDraw < 32) return;
      this.perf.last = timestamp;
    } else {
      this.#adapt(timestamp);
    }
    this.lastDraw = timestamp;
    this.hud?.begin();
    this.timer.update(timestamp);
    const frameDelta = Math.min(this.timer.getDelta(), 0.05);
    const dt = this.playing ? frameDelta : 0;

    if (this.playing) {
      this.sceneTime += dt;
    }

    const time = this.sceneTime;
    const level = this.level();

    const flash = this.step(dt, time);
    if (this.subject) this.rig.update(dt, this.subject, time);
    this.rings.update(dt, this.camera, this.rig.mode !== "eye");
    const { day, low } = this.#updateSky(flash);
    this.draw(dt, time, { day, low, flash, level });
    this.fx.update(time, { intensity: this.intensity, level, flash });
    this.fx.render();
    this.#project();
    this.hud?.end(timestamp);
  }

  // Near the surface the black of space gives way to a sky (blue by day, dark at night).
  #updateSky(flash) {
    const altitude = this.camera.position.length() - R;
    const low = 1 - smoothstep(altitude, 0.12, 1.4);
    const up = this.tmpUp.copy(this.camera.position).normalize();
    const day = smoothstep(up.dot(this.sunDir), -0.12, 0.25);
    this.sky.update(this.camera.position, {
      up,
      sunDir: this.sunDir,
      day,
      amount: low,
      flash,
    });
    this.stars.material.opacity = 1 - low * day;
    return { day, low };
  }

  // Screen position of the subject, for the HTML reticle.
  #project() {
    if (!this.subject || !this.onFrame) return;
    const { center, up } = this.subject;
    this.projected
      .copy(center)
      .addScaledVector(up, this.reticleLift)
      .project(this.camera);
    const toCamera = this.tmpToCamera.copy(this.camera.position).sub(center);
    const facing = toCamera.dot(up) > 0;
    const onScreen =
      Math.abs(this.projected.x) < 1.1 &&
      Math.abs(this.projected.y) < 1.1 &&
      this.projected.z < 1;
    this.onFrame({
      x: (this.projected.x + 1) / 2,
      y: (1 - this.projected.y) / 2,
      visible:
        facing && onScreen && !this.reticleHiddenIn.includes(this.rig.mode),
      distance: toCamera.length(),
    });
  }

  #addStars() {
    const count = 5000;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const v = new THREE.Vector3()
        .randomDirection()
        .multiplyScalar(300 + Math.random() * 300);
      positions.set([v.x, v.y, v.z], i * 3);
      c.setHSL(0.58 + Math.random() * 0.1, 0.3, 0.55 + Math.random() * 0.4);
      colors.set([c.r, c.g, c.b], i * 3);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    this.stars = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        size: 1.2,
        vertexColors: true,
        sizeAttenuation: true,
        transparent: true,
      }),
    );
    this.scene.add(this.stars);
  }

  #resize(container) {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    this.fx.setPixelRatio(this.ratio);
    this.fx.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
}
