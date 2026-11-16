import {
  hurricaneToSound,
  hurricaneToVisual,
  insideEye,
  lightningToVibration,
} from "../models/SensoryMapper.js";
import { subsolarPoint, sunElevation } from "../models/core/solar.js";
import { HapticOutput } from "../views/sensory/HapticOutput.js";
import { HELENE } from "../config/example.js";
import { SCALE, categorize } from "../models/HurricaneModel.js";
import { activeLayers } from "../models/core/sotaque.js";
import { ExperienceController } from "./ExperienceController.js";
import {
  RAPID_INTENSIFICATION_KT,
  windPhysics,
} from "../models/core/physics.js";
import { num } from "../views/shared/format.js";
import { dayShort } from "../views/shared/format.js";
import { t } from "../i18n/index.js";

const TRACK_SECONDS = 48;
const TEST_SECONDS = 3.5;
const HOUR_STEP = 1 / 96; // the track spans 4 days
const SCALE_MAX_KTS = 160;

export class SintonizeController extends ExperienceController {
  testTimer = null;
  lastT = 0;
  lastLevel = null;
  rapid = false;

  constructor({ view, hurricane, imagery, audio }) {
    super({
      view,
      timeline: hurricane,
      audio,
      playSeconds: TRACK_SECONDS,
      stepT: HOUR_STEP,
      startCamera: "chase",
      style: "baiao",
    });
    this.hurricane = hurricane;
    this.imagery = imagery;
    this.haptic = new HapticOutput();
  }

  handlers() {
    return {
      ...super.handlers(),
      onTest: (kts) => this.test(kts),
      onLightning: (e) => this.lightning(e),
    };
  }

  async load() {
    await Promise.all([
      this.hurricane.load(),
      this.imagery.load((done, total) => this.view.renderLoading(done, total)),
    ]);
    const { event, meta } = this.hurricane;
    this.lonRange = [this.hurricane.bounds.west, this.hurricane.bounds.east];
    this.view.renderWorld(this.imagery, HELENE.region, event);
    // The experience opens with the globe and the first day; the other days arrive while it plays.
    // The status keeps showing the progress until they are all in, and then says what they were.
    const ready = () =>
      this.view.renderReady(
        this.imagery.allLive
          ? "Imagens carregadas da GIBS"
          : "Imagens carregadas (parte da cópia local)",
      );
    if (this.imagery.done) ready();
    else {
      this.view.enableStart();
      this.imagery.complete.then(ready, (err) => {
        console.error(err);
        if (document.body.classList.contains("is-intro")) this.view.renderLoadError(err);
      });
    }
    this.view.renderEvent(HELENE.name, meta.source);
    this.view.renderTicks(
      this.hurricane.dayTicks.map((d) => ({ t: d.t, label: dayShort(d.date) })),
    );
    this.view.renderScale(SCALE, SCALE_MAX_KTS);
    // The peak of the track and the landfall are ten minutes apart: one announcement for both.
    const { peak } = this.hurricane;
    const { landfall } = HELENE;
    this.moments = [
      {
        t: this.hurricane.timeOf(new Date(landfall.date)),
        text: t("storm.peakAndLandfall", {
          wind: num(peak.kts),
          place: landfall.place,
          source: landfall.source,
        }),
        seconds: 6,
      },
    ];
    this.view.renderWindProfile(
      this.hurricane.track.map((p) => ({
        t: this.hurricane.timeOf(p.date),
        kts: p.kts,
      })),
      {
        t: this.hurricane.timeOf(this.hurricane.peak.date),
        kts: this.hurricane.peak.kts,
      },
    );
  }

  render(state) {
    const base = hurricaneToSound(state, this.lonRange, this.tune);
    const sound = this.view.cameraMode === "eye" ? insideEye(base) : base;
    this.view.renderState(state, sound, {
      visual: hurricaneToVisual(state),
      sun: subsolarPoint(state.date),
      elevation: sunElevation(state.date, state.lat, state.lon),
      frame: this.imagery.frameAt(state.date),
      physics: windPhysics(state.kts),
      style: this.style,
    });
    this.sing(sound);
    this.sound = sound;

    // Milestones are announced when the story moves forward across them.
    const step = state.t - this.lastT;
    const forward = step > 0 && step < 0.05 && !state.isOverride;
    const level = state.category.level;
    // In the baião each category brings an instrument: both are said in one announcement.
    const entered = this.bandEntered(sound.noteLevel, forward);
    const joins = entered
      ? t("controller.joinedInstruments", {
          instruments: entered
            .map((l) => t(l.label))
            .join(` ${t("controller.and")} `),
        })
      : "";
    if (forward && this.lastLevel != null && level !== this.lastLevel) {
      const up = level > this.lastLevel;
      this.view.toast(
        t(up ? "storm.categoryRise" : "storm.categoryFall", {
          category: t(state.category.label.toLowerCase()),
          wind: num(state.kts),
          joins,
        }),
        3.5,
        { key: up ? null : "falling" },
      );
    } else if (joins) {
      this.view.toast(
        t("controller.styleJoinToast", { style: t(this.style.name), joins }),
        3,
        { quiet: true },
      );
    }
    // Said once per run: the 24 h change hovers around the criterion before it takes off.
    const rapid =
      state.change24 != null && state.change24 >= RAPID_INTENSIFICATION_KT;
    if (!forward) this.rapid = false;
    if (forward && rapid && !this.rapid) {
      this.rapid = true;
      this.view.toast(
        t("storm.rapidIntensificationToast", { change: num(state.change24) }),
        5,
      );
      this.haptic.play([90, 60, 90, 60, 220]);
    }
    if (!state.isOverride) {
      this.announceMoments(this.lastT, state.t);
      this.lastLevel = level;
      this.lastT = state.t;
    }
  }

  openingLine(state) {
    return t("storm.opening", {
      date: dayShort(state.date),
      category: t(state.category.label),
      wind: num(state.kts),
    });
  }

  ending() {
    const { track, peak } = this.hurricane;
    const top = categorize(peak.kts);
    const days = Math.round(
      (this.hurricane.end - this.hurricane.start) / 86400000,
    );
    const style = this.style;
    let band = t("storm.endingUniversal");
    if (style) {
      const heard = activeLayers(
        style,
        hurricaneToSound(peak, this.lonRange, this.tune).noteLevel,
      );
      const missing = style.layers.slice(heard.length).map((l) => l.label);
      band = t("storm.endingBand", {
        style: style.name.toLowerCase(),
        heard: heard.length,
        total: style.layers.length,
      });
      if (missing.length)
        band += ` ${t(missing.length === 1 ? "storm.endingMissingOne" : "storm.endingMissingMany", { instruments: missing.join(` ${t("controller.and")} `), category: top.level - 1 })}`;
    }
    return {
      title: t("storm.endingTitle"),
      text: t("storm.endingText", {
        start: num(track[0].kts),
        peak: num(peak.kts),
        end: num(track.at(-1).kts),
        days,
        band,
      }),
      next: { href: "/", label: t("eruption.backToEvents") },
    };
  }

  // The voices carry Tone.js: they are loaded when the sound is first turned on, not with the page.
  async createVoice(input) {
    const [{ StormVoice }, { ThunderVoice }] = await Promise.all([
      import("../views/sensory/voices/StormVoice.js"),
      import("../views/sensory/voices/ThunderVoice.js"),
    ]);
    const voice = new StormVoice(input, this.style);
    voice.onBeat = () => this.view.beat();
    this.thunder = new ThunderVoice(input);
    return voice;
  }

  lightning({ power, distance }) {
    // The sky may flash many times a bar; the band answers at most once every two beats or so.
    const now = performance.now();
    if (now - (this.lastAccent ?? 0) < 1600) return;
    this.lastAccent = now;
    const intensity = this.sound?.intensity ?? 0.5;
    if (this.soundOn)
      this.thunder.strike(
        power * (0.4 + intensity * 0.6),
        distance,
        this.sound?.chord,
      );
    this.haptic.play(lightningToVibration(intensity * power));
  }

  async test(kts) {
    this.pause();
    await this.toggleSound(true);
    clearTimeout(this.testTimer);
    this.hurricane.setOverride(kts);
    this.view.setTesting(kts);
    this.testTimer = setTimeout(() => {
      this.hurricane.setOverride(null);
      this.view.setTesting(null);
    }, TEST_SECONDS * 1000);
  }
}
