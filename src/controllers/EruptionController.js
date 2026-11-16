import {
  eruptionToSound,
  explosionToVibration,
  lightningToVibration,
} from "../models/SensoryMapper.js";
import { subsolarPoint, sunElevation } from "../models/core/solar.js";
import { HapticOutput } from "../views/sensory/HapticOutput.js";
import { ExperienceController } from "./ExperienceController.js";
import { clockUTC, num } from "../views/shared/format.js";
import { TONGA } from "../config/example.js";
import { SAO_PAULO, lambWave, plumePhysics } from "../models/core/physics.js";
import { t } from "../i18n/index.js";

const PLAY_SECONDS = 70;

export class EruptionController extends ExperienceController {
  lastT = 0;

  constructor({ view, eruption, audio }) {
    super({
      view,
      timeline: eruption,
      audio,
      playSeconds: PLAY_SECONDS,
      stepT: 0,
      startCamera: "approach",
      style: "maracatu",
    });
    this.eruption = eruption;
    this.haptic = new HapticOutput();
  }

  handlers() {
    return { ...super.handlers(), onLightning: (e) => this.lightning(e) };
  }

  async load() {
    const e = this.eruption;
    await e.load((done, total) =>
      this.view.renderLoading(done, total, "imagens do GOES-West"),
    );
    // Arrow keys move ten minutes, one GOES frame.
    this.stepT = (10 * 60000) / (e.end - e.start);
    this.view.renderWorld(e, TONGA.region, TONGA.vent);
    this.view.renderEvent(TONGA.name, e.allLive ? "live" : "snapshot");
    this.view.renderTicks(
      e.hourTicks.map((h) => ({ t: h.t, label: clockUTC(h.date) })),
    );
    this.view.renderDiameterProfile(e.frames, (d) => e.timeOf(d), e.onsetT);
  }

  render(state) {
    const sound = eruptionToSound(state, this.tune);
    this.sound = sound;
    this.view.renderState(state, sound, {
      sun: subsolarPoint(state.date),
      elevation: sunElevation(state.date, state.lat, state.lon),
      frameLabel: state.frame.label,
      physics: {
        ...plumePhysics(state),
        wave: lambWave({
          vent: TONGA.vent,
          onset: this.eruption.onset,
          speedMs: TONGA.lambWaveMs,
          place: SAO_PAULO,
          waveKm: state.waveKm,
        }),
      },
      style: this.style,
    });
    this.sing(sound);

    // The explosion sounds when the timeline moves forward across its onset.
    const onset = this.eruption.onsetT;
    const step = state.t - this.lastT;
    if (step > 0 && step < 0.05 && this.lastT < onset && state.t >= onset)
      this.explode();
    this.lastT = state.t;
    this.announceBand(sound.noteLevel, step > 0 && step < 0.05);
  }

  openingLine(state) {
    return t("eruption.opening", {
      time: clockUTC(state.date),
      minutes: num(-state.minutesSinceOnset),
    });
  }

  ending() {
    const e = this.eruption;
    const hours = (e.end - e.onset) / 3600000;
    const style = this.style;
    return {
      title: t("eruption.endingTitle"),
      text: t("eruption.endingText", {
        hours: num(hours, 1),
        diameter: num(e.peak.diameterKm),
        ending: style
          ? t("eruption.endingBrazilian", { style: t(style.of) })
          : t("eruption.endingUniversal"),
      }),
      next: { href: "/", label: t("eruption.backToEvents") },
    };
  }

  async createVoice(input) {
    const [{ EruptionVoice }, { ThunderVoice }] = await Promise.all([
      import("../views/sensory/voices/EruptionVoice.js"),
      import("../views/sensory/voices/ThunderVoice.js"),
    ]);
    this.thunder = new ThunderVoice(input);
    const voice = new EruptionVoice(input, this.style);
    voice.music.onBeat = () => this.view.beat();
    return voice;
  }

  explode() {
    this.view.explode();
    if (this.soundOn) this.voice.boom(this.sound?.chord);
    this.haptic.play(explosionToVibration());
  }

  lightning({ power, distance }) {
    const now = performance.now();
    if (now - (this.lastAccent ?? 0) < 1600) return;
    this.lastAccent = now;
    if (this.soundOn)
      this.thunder.strike(power * 0.7, distance, this.sound?.chord);
    this.haptic.play(lightningToVibration((this.sound?.energy ?? 0.5) * power));
  }
}
