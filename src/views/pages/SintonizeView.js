import { $, $$, setText } from "../shared/dom.js";
import {
  CATEGORY_COLORS,
  categoryColor,
  windColor,
} from "../shared/palette.js";
import { StormWorldScene } from "../scenes/StormWorldScene.js";
import { ExperienceView, musicRows, musicValues } from "./ExperienceView.js";
import * as fmt from "../shared/format.js";
import { t } from "../../i18n/index.js";

const ROWS = [
  ...musicRows("storm.sustainedWindIntensity", "storm.sustainedWindSpeed"),
  {
    key: "bright",
    fromKey: "storm.windIntensity",
    toKey: "music.soundBrightness",
  },
  {
    key: "storm",
    fromKey: "storm.lightningEstimatedByWind",
    toKey: "storm.bellAndDrum",
    kind: "ilustrativo",
  },
  {
    key: "pan",
    fromKey: "music.longitudeOnTrack",
    toKey: "music.stereoPosition",
  },
];

const LAYER_NAMES = { noaa20: "NOAA-20", aqua: "Aqua", terra: "Terra" };

export class SintonizeView extends ExperienceView {
  constructor({ audio }) {
    super({
      audio,
      rows: ROWS,
      createScene: (stage, opts) =>
        new StormWorldScene(stage, {
          ...opts,
          onLightning: (e) => this.handlers.onLightning?.(e),
        }),
    });
    Object.assign(this.el, {
      panel: $("#event-panel"),
      category: $("#event-category"),
      scale: $("#scale"),
      tests: [$("#test-low"), $("#test-high")],
      eyeCaption: $("#eye-caption"),
    });
  }

  bind(handlers) {
    super.bind(handlers);
    this.el.tests.forEach((btn) =>
      btn.addEventListener("click", () =>
        handlers.onTest(Number(btn.dataset.kts)),
      ),
    );
  }

  renderWorld(imagery, region, event) {
    this.scene.setImagery(imagery, region);
    this.scene.setTrack(event.track);
  }

  // Saffir-Simpson strip: one segment per category, sized by its wind range.
  renderScale(scale, maxKts) {
    this.scaleMax = maxKts;
    this.el.scale.innerHTML =
      scale
        .map((c, i) => {
          const width = ((scale[i + 1]?.min ?? maxKts) - c.min) / maxKts;
          return `<span class="scale__seg" data-level="${c.level}" style="flex-grow:${width.toFixed(4)};--seg-color:${CATEGORY_COLORS[c.level]}">${c.code}</span>`;
        })
        .join("") + '<span class="scale__marker"></span>';
    this.scaleSegs = $$(".scale__seg", this.el.scale);
  }

  renderWindProfile(points, peak) {
    this.reprofile = () => this.renderWindProfile(points, peak);
    this.renderProfile(
      points.map((p) => ({ t: p.t, v: p.kts })),
      {
        max: this.scaleMax ?? 160,
        color: windColor,
        threshold: {
          v: 64,
          label: "64 kt",
          long: ` · ${t("storm.hurricane")}`,
        },
        peak: {
          t: peak.t,
          v: peak.kts,
          label: t("storm.peakWind", { wind: fmt.num(peak.kts) }),
        },
      },
    );
  }

  renderHud(state, sound, { visual, elevation, frame, physics, style }) {
    const cat = state.category;
    this.summary = t("storm.summary", {
      date: fmt.dateTimeUTC(state.date),
      category: t(cat.label),
      wind: fmt.num(state.kts),
    });
    const rapid = state.change24 != null && state.change24 >= 30;
    this.renderScience([
      {
        key: "push",
        label: t("storm.windForce"),
        value: fmt.num(physics.pushKgM2),
        unit: "kg/m²",
        note: t("storm.dynamicPressure", {
          pressure: fmt.num(physics.pressurePa),
        }),
      },
      {
        key: "power",
        label: t("storm.destructivePotential"),
        value: `${fmt.num(physics.powerRatio, 1)}×`,
        note: t("storm.cubicWindPower"),
      },
      {
        key: "ri",
        label: t("storm.change24h"),
        value: state.change24 == null ? "—" : fmt.signed(state.change24, 0),
        unit: "kt",
        note:
          state.change24 == null
            ? t("storm.needs24h")
            : rapid
              ? t("storm.rapidIntensificationThreshold")
              : t("storm.rapidIntensificationFrom"),
        alert: rapid,
      },
      {
        key: "forward",
        label: t("storm.movement"),
        value: fmt.num(state.forwardKmH),
        unit: "km/h",
        note: t("storm.systemSpeed"),
      },
    ]);
    this.renderBand(style, sound.noteLevel);
    this.el.panel.style.setProperty("--cat-color", categoryColor(cat));
    this.scaleSegs?.forEach((seg) =>
      seg.classList.toggle(
        "is-active",
        Number(seg.dataset.level) === cat.level,
      ),
    );
    this.el.scale.style.setProperty(
      "--marker",
      `${Math.min(100, (state.kts / (this.scaleMax ?? 160)) * 100)}%`,
    );
    setText(this.el.category.querySelector(".category__code"), cat.code);
    setText(this.el.category.querySelector(".category__label"), t(cat.label));
    setText("#r-kts", fmt.num(state.kts));
    setText("#r-kmh", fmt.num(state.kts * 1.852));
    setText("#r-lat", fmt.lat(state.lat));
    setText("#r-lon", fmt.lon(state.lon));
    this.setSourceLabel(
      state.isOverride ? t("common.manualTest") : t("storm.eonetTrack"),
    );
    this.mapping.setManual(state.isOverride, [
      "note",
      "tempo",
      "band",
      "bright",
    ]);
    this.setReticle(
      `${fmt.num(state.kts)} kt · ${cat.code}`,
      categoryColor(cat),
    );
    setText(
      this.el.eyeCaption,
      visual.eyeStrength > 0.05
        ? t("storm.insideEyeCaption", { wind: fmt.num(state.kts) })
        : t("storm.beforeEyeCaption", { wind: fmt.num(state.kts) }),
    );

    this.renderTopBar({
      time: fmt.dateTimeUTC(state.date),
      elevation,
      night: t("storm.gulfNight"),
      frame: `${t("Imagem")} ${LAYER_NAMES.noaa20} · ${fmt.powerDay(frame.frame.day.replaceAll("-", ""))}`,
    });

    const pan = sound.pan;
    this.mapping.update({
      ...musicValues(
        sound,
        `${fmt.num(state.kts)} kt`,
        `${fmt.num(state.kts)} kt`,
        style,
      ),
      bright: {
        value: `${fmt.num(state.kts)} kt`,
        out: `${fmt.num(sound.brightnessHz)} Hz`,
        t: sound.intensity,
      },
      storm: {
        value: `${fmt.num(state.kts)} kt`,
        out: t("music.perMinute", { value: fmt.num(sound.lightningPerMinute) }),
        t: sound.lightningPerMinute / 40,
      },
      pan: { value: fmt.lon(state.lon), out: fmt.pan(pan), t: (pan + 1) / 2 },
    });
  }

  renderScene(state, sound, { visual, sun, frame }) {
    this.scene.setStorm({
      ...state,
      ...visual,
      intensity: sound.intensity,
      sun,
      frame,
      lightningPerMinute: sound.lightningPerMinute,
    });
  }

  beat() {
    this.scene.beat();
  }

  setCamera(mode) {
    super.setCamera(mode);
    this.el.eyeCaption.hidden = mode !== "eye";
  }

  setPlaying(on) {
    super.setPlaying(on);
    setText(
      this.el.play.querySelector(".btn__label"),
      t(on ? "common.pause" : "storm.playTrack"),
    );
  }

  setTesting(kts) {
    this.el.tests.forEach((btn) =>
      btn.classList.toggle("is-testing", Number(btn.dataset.kts) === kts),
    );
  }
}
