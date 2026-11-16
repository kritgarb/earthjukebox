import { $, setText } from "../shared/dom.js";
import { lightColor } from "../shared/palette.js";
import { NightLightsScene } from "../scenes/NightLightsScene.js";
import { ExperienceView, musicRows, musicValues } from "./ExperienceView.js";
import * as fmt from "../shared/format.js";
import { NIGHT_LIGHTS } from "../../config/example.js";
import { onLanguageChange, t } from "../../i18n/index.js";

const ROWS = [
  // The speed is how much the lit share changed between two yearly frames.
  ...musicRows("nightlights.litShareIntensity", "nightlights.growthSpeed", {
    tempo: "calculado",
  }),
  {
    key: "sweep",
    fromKey: "nightlights.litColumn",
    toKey: "nightlights.bellInChord",
  },
  {
    key: "more",
    fromKey: "nightlights.moreLight",
    toKey: "nightlights.highGlassBell",
  },
  {
    key: "less",
    fromKey: "nightlights.lessLight",
    toKey: "nightlights.lowSoftNote",
  },
];

// The "column under the scan line" row: what is there and how it will sound.
const sweepRow = (sweep) => ({
  value: sweep
    ? `${fmt.num(sweep.share * 100, 1)}% · ${fmt.lon(sweep.lon)}`
    : "—",
  out: sweep?.note ?? "—",
  t: sweep ? Math.min(1, sweep.share * 12) : 0,
});

export class NightLightsView extends ExperienceView {
  constructor({ audio }) {
    super({
      audio,
      rows: ROWS,
      createScene: (stage, opts) => new NightLightsScene(stage, opts),
    });
    Object.assign(this.el, { panel: $("#event-panel") });
    // The marker on the timeline holds a translated word, so it is drawn again with the language.
    onLanguageChange(() => this.model && this.renderLightProfile(this.model));
  }

  renderWorld(model) {
    this.scene.setMaps(
      model.frames.map((f) => ({ img: f.img })),
      { img: model.change.img },
    );
    this.renderReady("nightlights.framesLoaded");
  }

  // The lit share of every yearly frame, stretched over its own range so the climb is visible.
  renderLightProfile(model) {
    this.model = model;
    const lo = model.litMin * 0.85;
    const hi = model.litMax * 1.02;
    const v = (lit) => (lit - lo) / (hi - lo);
    const points = [
      ...model.frames.map((f) => ({
        t: model.tOfYear(f.year),
        v: v(f.litShare),
      })),
      { t: 1, v: v(model.last.litShare) },
    ];
    this.renderProfile(points, {
      max: 1,
      color: lightColor,
      marker: { t: model.seriesEnd, label: t("nightlights.changeMap") },
    });
  }

  renderHud(state, sound, { style, sweep, first }) {
    const color = lightColor(state.litLevel * 0.8 + 0.1);
    this.summary = state.inChange
      ? t("nightlights.summaryChange", {
          more: fmt.num(state.moreShare * 100, 3),
          less: fmt.num(state.lessShare * 100, 3),
        })
      : t("nightlights.summaryYear", {
          year: state.shownYear,
          share: fmt.num(state.litShare * 100, 3),
        });
    const ratio = state.lessShare > 0 ? state.moreShare / state.lessShare : null;
    this.renderScience([
      {
        key: "lit",
        label: t("nightlights.litArea"),
        value: fmt.num(state.litShare * 100, 3),
        unit: "%",
        note: t("nightlights.litAreaNote"),
      },
      {
        key: "growth",
        label: t("nightlights.growthSince", { year: NIGHT_LIGHTS.years[0] }),
        value: fmt.signed(state.litGrowth * 100, 1),
        unit: "%",
        note: t("nightlights.growthNote", {
          first: fmt.num(first.litShare * 100, 3),
        }),
      },
      {
        key: "step",
        label: t("nightlights.lastStep"),
        value: fmt.signed(state.stepPerYear * 100, 2),
        unit: t("nightlights.pointsPerYear"),
        note:
          state.stepPerYear < 0
            ? t("nightlights.stepDown")
            : t("nightlights.stepUp"),
        alert: state.stepPerYear < 0,
      },
      {
        key: "ratio",
        label: t("nightlights.moreVersusLess"),
        value: ratio ? fmt.num(ratio, 1) : "—",
        unit: ratio ? "×" : "",
        note: ratio ? t("nightlights.ratioNote") : t("nightlights.ratioWaiting"),
        wide: true,
      },
    ]);
    this.renderBand(style, sound.noteLevel);
    this.el.panel.style.setProperty("--cat-color", color);
    setText("#r-lit", fmt.num(state.litShare * 100, 3));
    setText("#r-year", String(state.shownYear));
    setText("#r-growth", fmt.signed(state.litGrowth * 100, 1));
    setText(
      "#r-change",
      state.inChange
        ? `${t("nightlights.moreShort")} ${fmt.num(state.moreShare * 100, 3)}% · ${t("nightlights.lessShort")} ${fmt.num(state.lessShare * 100, 3)}%`
        : t("nightlights.notYet"),
    );
    this.setReticle(
      state.inChange
        ? t("nightlights.changeMap")
        : `${state.shownYear} · ${fmt.num(state.litShare * 100, 2)}%`,
      color,
    );
    this.renderTopBar({
      time: state.inChange
        ? `${NIGHT_LIGHTS.years[0]} → ${NIGHT_LIGHTS.years.at(-1)}`
        : String(state.shownYear),
      elevation: -90,
      night: t("nightlights.night"),
      frame: t("nightlights.frameChip"),
    });

    this.mapping.update({
      ...musicValues(
        sound,
        `${fmt.num(state.litShare * 100, 3)}% ${t("nightlights.lit")}`,
        `${fmt.signed(state.stepPerYear * 100, 2)} ${t("nightlights.pointsPerYear")}`,
        style,
      ),
      sweep: sweepRow(sweep),
      more: {
        value: `${fmt.num(state.moreShare * 100, 3)}%`,
        out: t("nightlights.moreOut", { chance: fmt.num(sound.changeMix * 100) }),
        t: state.moreShare / state.change.moreShare,
      },
      less: {
        value: `${fmt.num(state.lessShare * 100, 3)}%`,
        out: t("nightlights.lessOut", { chance: fmt.num(sound.changeMix * 100) }),
        t: state.lessShare / state.change.lessShare,
      },
    });
  }

  // The scan line moves on its own clock, also while the timeline is paused.
  renderSweep(sweep) {
    this.mapping.update({ sweep: sweepRow(sweep) });
  }

  renderScene(state) {
    this.scene.setMix(state.frame, state.changeMix);
  }

  setPlaying(on) {
    super.setPlaying(on);
    setText(
      this.el.play.querySelector(".btn__label"),
      t(on ? "common.pause" : "nightlights.playLights"),
    );
  }
}
