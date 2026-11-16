import {
  framesToSound,
  intensityToVibration,
} from "../models/SensoryMapper.js";
import { COLUMNS, blend, degreeOfHeight } from "../models/core/frames.js";
import { EIC_STYLES } from "../models/core/sotaque.js";
import { HapticOutput } from "../views/sensory/HapticOutput.js";
import { ExperienceController } from "./ExperienceController.js";
import { num } from "../views/shared/format.js";
import { et } from "../i18n/eicText.js";
import { t, onLanguageChange } from "../i18n/index.js";

// One pass of the scan line across the part of the frame in view, and how often a column is read.
const SWEEP_SECONDS = 14;
const TICK_MS = 120;

export class FramesController extends ExperienceController {
  lastT = 0;
  lastOpen = 0;
  scan = 0;
  sweepInfo = null;

  constructor({ view, model, audio, exp }) {
    super({
      view,
      timeline: model,
      audio,
      playSeconds: exp.mode === "layers" ? 60 : 80,
      stepT: 0.08,
      startCamera: "world",
      style: EIC_STYLES[exp.id],
    });
    this.model = model;
    this.exp = exp;
    this.haptic = new HapticOutput();
  }

  async load() {
    const { model, exp } = this;
    await model.load((done, total) =>
      this.view.renderLoading(done, total, "quadros do EIC da NASA"),
    );
    // The busiest column of any frame, per kind, is what "fully there" means for the sweep.
    this.columnMax = exp.kinds.map((_, k) =>
      Math.max(1e-6, ...model.frames.flatMap((f) => f.columns[k])),
    );
    this.view.renderWorld(model);
    this.view.model = model;
    this.view.renderEvent(et(exp.id, "name"), "snapshot");
    this.buildTexts();
    this.view.renderProfileFor(model);
    this.sweepTimer = setInterval(() => this.tick(), TICK_MS);
    onLanguageChange(() => {
      if (exp.mode === "layers") model.buildStamps();
      this.buildTexts();
      if (this.ready) this.render(model.state);
    });
  }

  // Everything derived from the language: ticks on the timeline and the spoken moments.
  buildTexts() {
    const { model, exp } = this;
    const id = exp.id;
    const stamps = model.stamps;
    const every = Math.max(1, Math.ceil(stamps.length / 6));
    this.view.renderTicks(
      stamps
        .filter((_, i) => i % every === 0)
        .map(([x, label]) => ({ t: x, label })),
    );
    const peakStamp = [...stamps]
      .reverse()
      .find(([x]) => x <= model.peak[0] + 1e-6);
    this.view.peakLabel = peakStamp?.[1] ?? "";
    this.moments =
      exp.mode === "layers"
        ? exp.kinds
            .filter((k) => k.gate > 0)
            .map((k) => ({
              t: k.gate - 0.004,
              text: et(id, `kind.${k.id}.moment`),
              seconds: 5,
            }))
        : [
            {
              t: Math.max(0, model.peak[0] - 0.004),
              text: et(id, "momentPeak", {
                label: this.view.peakLabel,
                value: num(model.peak[1] * exp.scale, exp.digits),
              }),
              seconds: 6,
            },
          ];
  }

  render(state) {
    const sound = framesToSound(state, this.model.maxStep, this.tune);
    this.sound = sound;
    this.state = state;
    this.view.renderState(state, sound, {
      style: this.style,
      sweep: this.sweepInfo,
    });
    this.sing(sound);

    const step = state.t - this.lastT;
    const forward = step > 0 && step < 0.05;
    this.announceBand(sound.noteLevel, forward);
    this.announceMoments(this.lastT, state.t);
    // A short tap for every new type that comes in.
    const open = state.gates.filter(Boolean).length;
    if (forward && open > this.lastOpen)
      this.haptic.play(intensityToVibration(Math.max(0.3, state.level)));
    this.lastOpen = open;
    this.lastT = state.t;
  }

  openingLine(state) {
    return et(this.exp.id, "opening", {
      label: state.label,
      value: num(state.shown, this.exp.digits),
    });
  }

  ending() {
    const { model, exp } = this;
    const style = this.style;
    const f = (v) => num(v * exp.scale, exp.digits);
    return {
      title: et(exp.id, "endingTitle"),
      text: et(exp.id, "endingText", {
        min: f(model.valueMin),
        max: f(model.valueMax),
        peakLabel: this.view.peakLabel,
        ending: style
          ? et("_", "endingBrazilian", { style: t(style.of) })
          : et("_", "endingUniversal"),
      }),
      next: { href: "/", label: t("eruption.backToEvents") },
    };
  }

  async createVoice(input) {
    const { FramesVoice } =
      await import("../views/sensory/voices/FramesVoice.js");
    const voice = new FramesVoice(input, this.style);
    voice.music.onBeat = () => this.view.scene.beat();
    return voice;
  }

  // The scan line crosses the part of the frame in view; each tick reads the column under it and
  // rings a bell for every kind that is there and already playing.
  tick() {
    const scene = this.view.scene;
    const state = this.state;
    if (!state || document.hidden || !this.tween) return;
    const { model, exp } = this;
    this.scan = (this.scan + TICK_MS / 1000 / SWEEP_SECONDS) % 1;
    scene.scan = this.scan;
    const x = scene.scanX;
    const c = Math.min(COLUMNS - 1, Math.floor(x * COLUMNS));
    const { a, b, mix } = state.frame;
    const fa = model.frames[a];
    const fb = model.frames[b];
    const near = mix < 0.5 ? fa : fb;

    let top = null;
    exp.kinds.forEach((kind, k) => {
      if (!state.gates[k]) return;
      const share = blend(fa.columns[k], fb.columns[k], mix)[c];
      const w = share / this.columnMax[k];
      if (!top || share > top.share) top = { share, kind, k };
      if (
        w <= 0.05 ||
        Math.random() >= Math.min(1, w * (this.sound?.brightness ?? 1))
      ) {
        return;
      }

      const y = near.heights[k][c];

      // The visual light works even when the audio is turned off
      scene.ping(x, y, kind.color);

      // The sound continues to respect the "Turn on sound" button
      if (!this.soundOn || !this.sound?.chord || !this.voice) return;

      const chord = this.sound.chord;
      const i = degreeOfHeight(y, 6);
      const base = chord[i % chord.length] + 12 * Math.floor(i / chord.length);

      this.voice.ping(
        kind.voice,
        base + kind.octave,
        x * 2 - 1,
        Math.min(1, w),
      );
    });

    this.sweepInfo =
      top && top.share > 0.0004
        ? {
            share: top.share,
            note: `${et(exp.id, `kind.${top.kind.id}.from`)}: ${et(exp.id, `kind.${top.kind.id}.to`)}`,
          }
        : { share: 0, note: et("_", "sweepSilent") };
    this.view.renderSweep(this.sweepInfo);
  }
}
