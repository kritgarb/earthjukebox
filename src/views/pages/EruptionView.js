import { $, setText } from "../shared/dom.js";
import { ashColor } from "../shared/palette.js";
import { EruptionScene } from "../scenes/EruptionScene.js";
import { ExperienceView, musicRows, musicValues } from "./ExperienceView.js";
import * as fmt from "../shared/format.js";
import { t } from "../../i18n/index.js";

const ROWS = [
  // The expansion is the change in the measured diameter between two frames.
  ...musicRows(
    "eruption.plumeDiameterIntensity",
    "eruption.plumeExpansionSpeed",
    { tempo: "calculado" },
  ),
  {
    key: "roar",
    fromKey: "eruption.plumeExpansion",
    toKey: "eruption.lowRoarAndEcho",
    kind: "calculado",
  },
  {
    key: "shimmer",
    fromKey: "eruption.coldCore",
    toKey: "eruption.icyBrightness",
  },
  {
    key: "boom",
    fromKey: "eruption.explosionStart",
    toKey: "eruption.fullChordAndLowDrum",
  },
  {
    key: "light",
    fromKey: "eruption.lightningEstimatedByExpansion",
    toKey: "eruption.bellsInChord",
    kind: "ilustrativo",
  },
];

const MAX_DIAMETER = 750;

export class EruptionView extends ExperienceView {
  constructor({ audio }) {
    super({
      audio,
      rows: ROWS,
      createScene: (stage, opts) =>
        new EruptionScene(stage, {
          ...opts,
          onLightning: (e) => this.handlers.onLightning?.(e),
        }),
    });
    Object.assign(this.el, { panel: $("#event-panel") });
  }

  renderWorld(model, region, vent) {
    this.scene.setWorld(model.maps, model.frames, region, vent);
    this.renderReady(
      model.allLive
        ? "Imagens do GOES-West carregadas da GIBS"
        : "Imagens carregadas (parte da cópia local)",
    );
  }

  renderDiameterProfile(frames, timeOf, onsetT) {
    this.reprofile = () => this.renderDiameterProfile(frames, timeOf, onsetT);
    this.renderProfile(
      frames.map((f) => ({ t: timeOf(f.time), v: f.diameterKm })),
      {
        max: MAX_DIAMETER,
        color: (v) => ashColor(v / MAX_DIAMETER),
        threshold: { v: 500, label: "500 km", right: true },
        marker: { t: onsetT, label: t("eruption.explosionTime") },
      },
    );
  }

  renderHud(state, sound, { elevation, frameLabel, physics, style }) {
    const color = ashColor(state.diameterKm / MAX_DIAMETER);
    this.summary = state.erupted
      ? t("eruption.summaryAfter", {
          minutes: fmt.num(state.minutesSinceOnset),
          diameter: fmt.num(state.diameterKm),
        })
      : t("eruption.summaryBefore", {
          minutes: fmt.num(-state.minutesSinceOnset),
        });
    const { wave } = physics;
    this.renderScience([
      {
        key: "area",
        label: t("eruption.plumeArea"),
        value: fmt.num(physics.areaKm2 / 1000),
        unit: t("common.thousandKm2"),
        note: t("eruption.statesOfSaoPaulo", {
          count: fmt.num(physics.states, 2),
        }),
      },
      {
        key: "edge",
        label: t("eruption.plumeEdge"),
        value: fmt.num(physics.edgeKmH),
        unit: "km/h",
        note:
          physics.edgeKmH > 252
            ? t("eruption.fasterThanCategory5")
            : t("eruption.expansionSpeed"),
      },
      {
        key: "wave",
        label: t("eruption.pressureWaveToSaoPaulo"),
        value: `${fmt.num(wave.progress * 100)}%`,
        note: t("eruption.waveArrival", {
          distance: fmt.num(wave.distanceKm),
          time: fmt.clockUTC(wave.arrival),
          hours: fmt.num(wave.hours, 1),
        }),
        wide: true,
      },
      {
        key: "lap",
        label: t("eruption.tripAroundEarth"),
        value: fmt.num(wave.lapHours, 1),
        unit: "h",
        note: t("eruption.waveSeveralLaps"),
      },
      {
        key: "top",
        label: t("eruption.maximumHeight"),
        value: "57",
        unit: "km",
        note: t("eruption.mesosphereReference"),
      },
    ]);
    this.renderBand(style, sound.noteLevel);
    this.el.panel.style.setProperty("--cat-color", color);
    setText("#r-diameter", fmt.num(state.diameterKm));
    setText("#r-expansion", fmt.num(state.expansionKmMin, 1));
    setText("#r-core", `${fmt.num(state.coreIndex * 100)}%`);
    setText("#r-wave", fmt.num(state.waveKm));
    setText(
      "#r-since",
      state.erupted
        ? t("eruption.minutesAfter", {
            minutes: fmt.num(state.minutesSinceOnset),
          })
        : t("eruption.minutesBefore", {
            minutes: fmt.num(-state.minutesSinceOnset),
          }),
    );
    this.setReticle(
      state.erupted ? `${fmt.num(state.diameterKm)} km` : "Hunga Tonga",
      color,
    );

    this.renderTopBar({
      time: `${fmt.clockUTC(state.date)} UTC · ${fmt.dayShort(state.date)} 2022`,
      elevation,
      night: t("eruption.tongaNight"),
      frame: t("eruption.goesFrame", { time: frameLabel }),
    });

    this.mapping.update({
      ...musicValues(
        sound,
        `${fmt.num(state.diameterKm)} km`,
        `${fmt.num(state.expansionKmMin, 1)} km/min`,
        style,
      ),
      roar: {
        value: `${fmt.num(state.expansionKmMin, 1)} km/min`,
        out: t("eruption.roarOutput", {
          db: fmt.num(sound.roarDb),
          echo: fmt.num(sound.reverbWet * 100),
        }),
        t: sound.energy,
      },
      shimmer: {
        value: `${fmt.num(state.coreIndex * 100)}%`,
        out: `${fmt.num(sound.shimmerDb)} dB`,
        t: Math.min(1, state.coreIndex / 0.4),
      },
      boom: {
        value: "04:14:45 UTC",
        out: state.erupted
          ? t("eruption.alreadyPlayed")
          : t("eruption.waiting"),
        t: state.erupted ? 1 : 0,
      },
      light: {
        value: `${fmt.num(state.expansionKmMin, 1)} km/min`,
        out: t("music.perMinute", { value: fmt.num(sound.lightningPerMinute) }),
        t: sound.lightningPerMinute / 45,
      },
    });
  }

  renderScene(state, sound, { sun }) {
    this.scene.setEruption(state, sound, sun);
  }

  explode() {
    this.scene.explode();
    this.toast(t("eruption.explosionToast"), 5, { urgent: true });
  }

  beat() {
    this.scene.beat();
  }

  setPlaying(on) {
    super.setPlaying(on);
    setText(
      this.el.play.querySelector(".btn__label"),
      t(on ? "common.pause" : "eruption.playEruption"),
    );
  }
}
