import { $, setText } from "../shared/dom.js";
import { lightColor } from "../shared/palette.js";
import { FramesScene } from "../scenes/FramesScene.js";
import { ExperienceView, musicRows, musicValues } from "./ExperienceView.js";
import * as fmt from "../shared/format.js";
import { et } from "../../i18n/eicText.js";
import { onLanguageChange } from "../../i18n/index.js";

// What the scan line holds in the column under it, for the "data to sound" row.
const sweepRow = (sweep, id) => ({
  value: sweep ? `${fmt.num(sweep.share * 100, 1)}%` : "—",
  out: sweep?.note ?? et("_", "sweepSilent"),
  t: sweep ? Math.min(1, sweep.share * 12) : 0,
});

export class FramesView extends ExperienceView {
  constructor({ audio, exp }) {
    const id = exp.id;
    super({
      audio,
      rows: [
        ...musicRows(`eic.${id}.intensity`, `eic.${id}.speed`, {
          tempo: "calculado",
        }),
        { key: "sweep", fromKey: "eic._.sweepRow", toKey: "eic._.sweepOut" },
      ],
      createScene: (stage, opts) =>
        new FramesScene(stage, opts, { views: exp.views }),
    });
    this.exp = exp;
    Object.assign(this.el, { panel: $("#event-panel") });
    onLanguageChange(() => this.model && this.renderProfileFor(this.model));
  }

  renderWorld(model) {
    this.scene.setFrames(model.frames, model.aspect);
    this.renderReady("eic._.framesLoaded");
  }

  // The measured series behind the scrubber, stretched over its own range.
  renderProfileFor(model) {
    this.model = model;
    const lo = model.valueMin * 0.85;
    const hi = model.valueMax * 1.02;
    const v = (x) => (x - lo) / (hi - lo);
    this.renderProfile(
      model.series.map(([t, x]) => ({ t, v: Math.max(0, v(x)) })),
      { max: 1, color: lightColor },
    );
  }

  renderHud(state, sound, { style, sweep }) {
    const exp = this.exp;
    const id = exp.id;
    const model = this.model;
    const color = lightColor(state.level * 0.8 + 0.1);
    const layers = exp.mode === "layers";
    const peakShown = model.valueMax * exp.scale;
    this.summary = et(id, "summary", {
      label: state.label,
      value: fmt.num(state.shown, exp.digits),
    });
    const open = state.gates.filter(Boolean).length;
    this.renderScience([
      {
        key: "main",
        label: et(id, "valueLabel"),
        value: fmt.num(state.shown, exp.digits),
        unit: exp.unit,
        note: et(id, "valueNote"),
      },
      layers
        ? {
            key: "open",
            label: et("_", "layersOpen"),
            value: `${open}/${exp.kinds.length}`,
            unit: "",
            note: et("_", "layersNote", { total: exp.kinds.length }),
          }
        : {
            key: "vs",
            label: et("_", "vsMean"),
            value: fmt.num(state.vsMean, 2),
            unit: "×",
            note: et("_", "vsMeanNote"),
          },
      {
        key: "peak",
        label: et("_", "peak"),
        value: fmt.num(peakShown, exp.digits),
        unit: exp.unit,
        note: layers ? "" : et("_", "peakNote", { label: this.peakLabel ?? "" }),
        wide: true,
      },
    ]);
    this.renderBand(style, sound.noteLevel);
    this.el.panel.style.setProperty("--cat-color", color);
    setText("#r-main", fmt.num(state.shown, exp.digits));
    setText("#r-label", state.label);
    setText("#r-second", layers ? `${open}/${exp.kinds.length}` : `${fmt.num(state.vsMean, 2)} ×`);
    setText("#r-peak", `${fmt.num(peakShown, exp.digits)} ${exp.unit}`);
    this.setReticle(`${state.label} · ${fmt.num(state.shown, exp.digits)}${exp.unit === "%" ? "%" : ` ${exp.unit}`}`, color);
    this.renderTopBar({
      time: state.label,
      elevation: -90,
      night: et(id, "timeLabel"),
      frame: et("_", "chip", { svs: exp.svs }),
    });

    const values = musicValues(
      sound,
      `${fmt.num(state.shown, exp.digits)} ${exp.unit}`,
      `${fmt.signed(state.stepPerUnit * exp.scale * 0.1, 2)} ${exp.unit}`,
      style,
    );
    this.mapping.update({ ...values, sweep: sweepRow(sweep, id) });
  }

  // The scan line moves on its own clock, also while the timeline is paused.
  renderSweep(sweep) {
    this.mapping.update({ sweep: sweepRow(sweep, this.exp.id) });
  }

  renderScene(state) {
    this.scene.setMix(state.frame);
  }

  setPlaying(on) {
    super.setPlaying(on);
    setText(
      this.el.play.querySelector(".btn__label"),
      on ? et("_", "pause") : et(this.exp.id, "play"),
    );
  }
}
