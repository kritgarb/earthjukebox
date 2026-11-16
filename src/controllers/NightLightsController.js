import {
  intensityToVibration,
  lightsToVibration,
  nightLightsToSound,
} from "../models/SensoryMapper.js";
import {
  COLUMNS,
  blend,
  degreeOfLatitude,
  lonOfColumn,
} from "../models/core/nightlights.js";
import { HapticOutput } from "../views/sensory/HapticOutput.js";
import { ExperienceController } from "./ExperienceController.js";
import { NIGHT_LIGHTS } from "../config/example.js";
import { num } from "../views/shared/format.js";
import { t } from "../i18n/index.js";

const PLAY_SECONDS = 80;
// One pass of the scan line across the map in view, and how often a column is read.
const SWEEP_SECONDS = 14;
const TICK_MS = 120;

export class NightLightsController extends ExperienceController {
  lastT = 0;
  lastYear = null;
  scan = 0;
  sweepInfo = null;

  constructor({ view, lights, audio }) {
    super({
      view,
      timeline: lights,
      audio,
      playSeconds: PLAY_SECONDS,
      stepT: 0,
      startCamera: "world",
      style: "samba",
    });
    this.lights = lights;
    this.haptic = new HapticOutput();
  }

  async load() {
    const m = this.lights;
    await m.load((done, total) =>
      this.view.renderLoading(done, total, "quadros do EIC da NASA"),
    );
    // Arrow keys move one year.
    this.stepT = m.seriesEnd / (NIGHT_LIGHTS.years.length - 1);
    // The busiest column of any frame is what "fully lit" means for the sweep.
    this.columnMax = Math.max(...m.frames.flatMap((f) => f.columns));
    this.changeMax = Math.max(...m.change.more, ...m.change.less);
    this.view.renderWorld(m);
    this.view.renderEvent(NIGHT_LIGHTS.name, "snapshot");
    this.view.renderTicks(
      NIGHT_LIGHTS.years
        .filter((y) => (y - NIGHT_LIGHTS.years[0]) % 2 === 0)
        .map((y) => ({ t: m.tOfYear(y), label: String(y) })),
    );
    this.view.renderLightProfile(m);
    this.moments = [
      {
        t: m.tOfYear(2020) - 0.004,
        text: t("nightlights.moment2020"),
        seconds: 6,
      },
      {
        t: m.tOfYear(2022) - 0.004,
        text: t("nightlights.moment2022"),
        seconds: 6,
      },
      { t: m.seriesEnd, text: t("nightlights.momentChange"), seconds: 7 },
    ];
    this.sweepTimer = setInterval(() => this.tick(), TICK_MS);
  }

  render(state) {
    const sound = nightLightsToSound(state, this.lights.maxStep, this.tune);
    this.sound = sound;
    this.state = state;
    this.view.renderState(state, sound, {
      style: this.style,
      sweep: this.sweepInfo,
      first: this.lights.first,
    });
    this.sing(sound);

    const step = state.t - this.lastT;
    const forward = step > 0 && step < 0.05;
    this.announceBand(sound.noteLevel, forward);
    this.announceMoments(this.lastT, state.t);
    // A short tap for every new year the timeline reaches.
    if (forward && state.shownYear !== this.lastYear && !state.inChange)
      this.haptic.play(intensityToVibration(state.litLevel * 0.8));
    this.lastYear = state.shownYear;
    this.lastT = state.t;
  }

  openingLine(state) {
    return t("nightlights.opening", {
      year: state.shownYear,
      share: num(state.litShare * 100, 2),
    });
  }

  ending() {
    const m = this.lights;
    const style = this.style;
    return {
      title: t("nightlights.endingTitle"),
      text: t("nightlights.endingText", {
        first: num(m.first.litShare * 100, 2),
        last: num(m.last.litShare * 100, 2),
        growth: num((m.last.litShare / m.first.litShare - 1) * 100),
        ratio: num(m.change.moreShare / m.change.lessShare, 1),
        ending: style
          ? t("nightlights.endingBrazilian", { style: t(style.of) })
          : t("nightlights.endingUniversal"),
      }),
      next: { href: "/", label: t("eruption.backToEvents") },
    };
  }

  async createVoice(input) {
    const { NightLightsVoice } = await import(
      "../views/sensory/voices/NightLightsVoice.js"
    );
    const voice = new NightLightsVoice(input, this.style);
    voice.music.onBeat = () => this.view.scene.beat();
    return voice;
  }

  // The scan line crosses the part of the map in view; each tick reads the column under it and
  // rings a bell for lit places (or high and low notes for more and less light).
  tick() {
    const scene = this.view.scene;
    const state = this.state;
    if (!state || document.hidden) return;
    this.scan = (this.scan + TICK_MS / 1000 / SWEEP_SECONDS) % 1;
    scene.scan = this.scan;
    const c = Math.min(COLUMNS - 1, Math.floor(scene.scanX * COLUMNS));
    const lon = lonOfColumn(c);
    const m = this.lights;
    const { a, b, mix } = state.frame;
    const fa = m.frames[a];
    const fb = m.frames[b];
    const lit = blend(fa.columns, fb.columns, mix)[c];
    const lat = (mix < 0.5 ? fa : fb).latitudes[c] || 0;
    const more = m.change.more[c];
    const less = m.change.less[c];

    // What this column holds, for the "data to sound" row.
    const here = state.inChange && Math.max(more, less) > lit * 0.4;
    this.sweepInfo = {
      share: here ? Math.max(more, less) : lit,
      lon,
      note: here
        ? more >= less
          ? t("nightlights.sweepMore")
          : t("nightlights.sweepLess")
        : lit > 0.0004
          ? t("nightlights.sweepLit")
          : t("nightlights.sweepDark"),
    };

    this.view.renderSweep(this.sweepInfo);

    // Which bell, if any: under the change map the colours decide; before it, the lights.
    let kind = null;
    let strength = 0;
    let latitude = lat;
    if (state.inChange && Math.random() < state.changeMix) {
      const w = Math.max(more, less) / this.changeMax;
      if (w > 0.04 && Math.random() < Math.min(1, w * 1.6)) {
        kind = more >= less ? "more" : "less";
        strength = Math.min(1, w);
        latitude = (kind === "more" ? m.change.moreLat : m.change.lessLat)[c];
      }
    } else {
      const w = lit / this.columnMax;
      if (
        w > 0.05 &&
        Math.random() < Math.min(1, w * (this.sound?.brightness ?? 1))
      ) {
        kind = "lit";
        strength = Math.min(1, w);
      }
    }
    if (!kind) return;
    scene.ping(lon, latitude, kind);
    if (!this.soundOn || !this.sound?.chord) return;
    const chord = this.sound.chord;
    const i = degreeOfLatitude(latitude, 6);
    const base = chord[i % chord.length] + 12 * Math.floor(i / chord.length);
    // Brighter places ring two octaves up, lit ones one octave up, darker ones stay low.
    const midi = base + (kind === "more" ? 24 : kind === "lit" ? 12 : 0);
    this.voice.ping(kind, midi, lon / 180, strength);
    if (kind === "less" && Math.random() < 0.15)
      this.haptic.play(lightsToVibration("less"));
  }
}
