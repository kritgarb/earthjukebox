import { $, $$, setPressed, setText } from "../shared/dom.js";
import { MappingView } from "../shared/MappingView.js";
import { ScopeView } from "../shared/ScopeView.js";
import { renderStatus } from "../shared/StatusView.js";
import * as fmt from "../shared/format.js";
import {
  UNIVERSAL_BAND,
  UNIVERSAL_RULE,
  activeLayers,
  nextLayer,
} from "../../models/core/sotaque.js";
import { onLanguageChange, t } from "../../i18n/index.js";
import { bt } from "../../i18n/backingText.js";
import { listTracks } from "../sensory/RhythmLoops.js";
import { VOLUME_UNITY } from "../sensory/AudioEngine.js";
import { mountVolumeControl } from "../sensory/VolumeControl.js";
import { Narrator } from "../sensory/Narrator.js";

// The two rows of the Earth Jukebox pattern, the same on every page: only the data feeding them
// changes (see SensoryMapper / jukebox).
// kinds: where the two inputs come from ('medido' unless stated; see MappingView).
export const musicRows = (intensity, speed, kinds = {}) => [
  {
    key: "note",
    fromKey: intensity,
    toKey: "music.noteAndChord",
    kind: kinds.note,
  },
  {
    key: "tempo",
    fromKey: speed,
    toKey: "music.tempoAndMelody",
    kind: kinds.tempo,
  },
  {
    key: "band",
    fromKey: "music.intensityThresholds",
    toKey: "music.instrumentsPlaying",
  },
];

// `style` is the Brazilian accent in use (core/sotaque.js), or null for the universal one.
export const musicValues = (sound, intensityValue, speedValue, style) => {
  const layers = style ? activeLayers(style, sound.noteLevel) : null;
  const next = style ? nextLayer(style, sound.noteLevel) : null;
  return {
    note: {
      value: intensityValue,
      out: t(sound.note),
      to: t("music.noteAndChordInKey", { key: t(sound.keyName) }),
      t: sound.noteLevel,
    },
    tempo: {
      value: speedValue,
      out: `${fmt.num(sound.bpm)} BPM · ${fmt.rhythm(sound.arpRate)}`,
      t: sound.speed,
    },
    band: style
      ? {
          value: next
            ? t("music.nextInstrument", {
                label: t(next.label),
                threshold: t(next.at),
              })
            : t("music.fullBand"),
          out: t("music.countOf", {
            count: layers.length,
            total: style.layers.length,
          }),
          to: t("music.instrumentsOf", { style: t(style.of) }),
          t: layers.length / style.layers.length,
        }
      : {
          value: t("music.alwaysAllThree"),
          out: UNIVERSAL_BAND,
          to: t("music.instrumentsPlaying"),
          t: 1,
        },
  };
};

// The HUD shared by every experience page: intro with loading, transport (play, scrubber with the
// data profile, cameras), the "data -> sound" mapping, the scope and the reticle over the subject.
// Subclasses create their scene and render their own readouts.
export class ExperienceView {
  handlers = {};

  constructor({ audio, rows, createScene }) {
    this.audio = audio;
    this.mapping = new MappingView($("#mapping"), rows);
    new ScopeView($("#scope"), audio);
    this.stage = $("#stage");
    this.scene = createScene(this.stage, {
      level: () => audio.level(),
      onFrame: (p) => this.#placeReticle(p),
    });
    this.el = {
      title: $("#event-title"),
      status: $("#event-status"),
      source: $("#map-source"),
      sound: $("#btn-sound"),
      play: $("#btn-play"),
      scrub: $("#scrub"),
      ticks: $("#ticks"),
      track: $("#track"),
      profile: $("#profile"),
      cameras: $("#cameras"),
      hud: $("#btn-hud"),
      reticle: $("#reticle"),
      reticleLabel: $("#reticle-label"),
      intro: $("#intro"),
      start: $("#btn-start"),
      introBar: $("#intro-bar"),
      introStatus: $("#intro-status"),
      accentWhy: $("#accent-why"),
      band: $("#band"),
      layout: $(".layout"),
      drawer: $(".hud--right"),
      science: $("#science"),
    };
    this.cameraModes = $$("button[data-camera]", this.el.cameras).map(
      (b) => b.dataset.camera,
    );
    this.#arrange();
    mountVolumeControl(audio, this.el.sound);
    window.addEventListener("resize", () => this.fitTicks());
    this.unsubscribeI18n = onLanguageChange(() => {
      if (this.loadingState)
        this.renderLoading(
          this.loadingState.done,
          this.loadingState.total,
          this.loadingState.what,
        );
      if (this.readySource) setText(this.el.introStatus, t(this.readySource));
      if (this.loadError != null)
        setText(
          this.el.introStatus,
          t("common.loadError", { error: this.loadError }),
        );
      if (this.tickSource) this.renderTicks(this.tickSource);
      // A view whose profile carries translated labels says how to build it again (reprofile).
      if (this.reprofile) this.reprofile();
      else if (this.profileSource) this.renderProfile(...this.profileSource);
      if (this.backLink) this.backLink.textContent = `← ${t("common.events")}`;
      if (this.lastAccent) this.renderAccent(this.lastAccent, this.lastStyle);
      this.renderBacking();
      if (this.hudArgs) this.#flushHud();
      if (this.soundState != null) this.setSound(this.soundState);
      if (this.playState != null) this.setPlaying(this.playState);
      if (this.cinemaState != null) this.setCinema(this.cinemaState);
      if (this.narratorState != null) this.setNarrator(this.narratorState);
    });

    // With narration on, whatever receives focus or a touch is read aloud (name, role, state).
    const speakTarget = (e) => {
      if (!this.narrating) return;
      const el = e.target.closest?.(
        "button, a[href], input, select, textarea, [role=button], [role=tab], [role=slider], [role=switch]",
      );
      if (
        !el ||
        (el === this.lastSpoken?.el && Date.now() - this.lastSpoken.at < 600)
      )
        return;
      this.lastSpoken = { el, at: Date.now() };
      const name = (
        el.getAttribute("aria-label") ||
        document.getElementById(el.getAttribute("aria-labelledby") || "")
          ?.textContent ||
        el.labels?.[0]?.textContent ||
        el.textContent ||
        el.title ||
        ""
      )
        .replace(/\s+/g, " ")
        .trim();
      if (!name) return;
      const parts = [name];
      const pressed = el.getAttribute("aria-pressed");
      if (pressed != null)
        parts.push(
          t(pressed === "true" ? "common.stateOn" : "common.stateOff"),
        );
      else if (el.matches("a[href]")) parts.push(t("common.roleLink"));
      else if (el.matches("button, [role=button]"))
        parts.push(t("common.roleButton"));
      else if (el.matches("input[type=range], [role=slider]"))
        parts.push(el.getAttribute("aria-valuetext") || el.value || "");
      this.narrator?.cancel();
      this.say(parts.filter(Boolean).join(". "));
    };
    document.addEventListener("focusin", speakTarget);
    document.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "touch") speakTarget(e);
    });

    // In the page from the start, so assistive technology is already listening to it when the
    // first announcement arrives.
    const toast = document.createElement("p");
    toast.id = "toast";
    toast.className = "toast";
    toast.setAttribute("role", "status");
    const outro = document.createElement("section");
    outro.className = "outro";
    outro.hidden = true;
    outro.setAttribute("aria-labelledby", "outro-title");
    outro.innerHTML = `
      <h2 class="outro__title" id="outro-title"></h2>
      <p class="outro__text" id="outro-text"></p>
      <div class="outro__actions">
        <button class="btn btn--primary outro__again" type="button" aria-describedby="outro-text">${t("common.listenAgain")}</button>
        <a class="btn outro__next" href="/"></a>
      </div>`;
    document.body.append(toast, outro);
    Object.assign(this.el, { toast, outro });
    // Behind the intro nothing is reachable yet.
    this.el.layout.inert = document.body.classList.contains("is-intro");
  }

  // One thing on screen by default: what is happening and who is playing. Everything else lives
  // in a drawer with three tabs (music, science, about), opened from the transport.
  #arrange() {
    const drawer = $(".hud--right");
    const tabs = [
      ["musica", t("common.music")],
      ["ciencia", t("common.science")],
      ["sobre", t("common.about")],
    ];
    const nav = document.createElement("div");
    nav.className = "segmented tabs";
    nav.setAttribute("role", "group");
    nav.setAttribute("aria-label", t("common.details"));
    nav.innerHTML = tabs
      .map(
        ([id, label]) =>
          `<button type="button" data-tab-for="${id}" aria-pressed="false">${label}</button>`,
      )
      .join("");
    drawer.prepend(nav);
    $$(".panel[data-tab]").forEach((panel) => drawer.append(panel));
    const show = (id) => {
      drawer.dataset.active = id;
      $$("button", nav).forEach((b) => setPressed(b, b.dataset.tabFor === id));
      drawer.scrollTop = 0;
    };
    nav.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-tab-for]");
      if (btn) show(btn.dataset.tabFor);
    });
    show("musica");

    // The band belongs beside the data: the instruments light up next to the number that
    // brings them in.
    const now = document.createElement("p");
    now.className = "now-band";
    now.id = "now-band";
    $("#event-panel").append(now, $("#band"));

    // While the panels are hidden (key H) the way to bring them back stays on screen.
    const reveal = document.createElement("button");
    reveal.type = "button";
    reveal.className = "btn cinema-chip";
    reveal.innerHTML = `${t("common.showPanels")} <kbd>H</kbd>`;
    reveal.addEventListener("click", () => this.handlers.onToggleHud());
    document.body.append(reveal);

    // The way back to the chooser sits above the card, so the transport holds only playback.
    const back = document.createElement("a");
    back.className = "back-link";
    back.href = "/";
    back.textContent = `← ${t("common.events")}`;
    $(".hud--left").prepend(back);
    this.backLink = back;

    // Anything placed "just above the transport" follows its real height.
    new ResizeObserver(([entry]) => {
      document.documentElement.style.setProperty(
        "--dock-h",
        `${Math.round(entry.contentRect.height)}px`,
      );
    }).observe($(".dock"));

    // On a phone the card is in the sheet, so the transport carries one line with the same
    // argument: the measurement, and how much of the band it has brought in.
    const strip = document.createElement("p");
    strip.className = "now-strip";
    strip.innerHTML =
      '<b class="now-strip__value"></b><span class="now-strip__dots" aria-hidden="true"></span><span class="now-strip__band"></span>';
    $(".dock").prepend(strip);
    this.strip = {
      value: $(".now-strip__value", strip),
      dots: $(".now-strip__dots", strip),
      band: $(".now-strip__band", strip),
    };

    // Phones that can vibrate are told so before they start (iPhones cannot, and are not).
    if ("vibrate" in navigator && matchMedia("(pointer: coarse)").matches) {
      setText(".intro__hint", t("common.headphonesVibrationHint"));
    }
  }

  // The scene and the scrubber follow every frame; the text of the panels is rewritten about nine
  // times a second, which reads the same and leaves the frame to the 3D and the music.
  // Subclasses implement renderScene(state, sound, extra) and renderHud(state, sound, extra).
  renderState(...args) {
    this.setTimeline(args[0].t);
    this.renderScene(...args);
    this.hudArgs = args;
    const wait = 110 - (performance.now() - (this.hudAt ?? 0));
    if (wait <= 0) this.#flushHud();
    else this.hudTimer ??= setTimeout(() => this.#flushHud(), wait);
  }

  #flushHud() {
    clearTimeout(this.hudTimer);
    this.hudTimer = null;
    this.hudAt = performance.now();
    this.renderHud(...this.hudArgs);
    if (this.summary)
      this.el.scrub.setAttribute("aria-valuetext", this.summary);
  }

  bind(handlers) {
    this.handlers = handlers;
    const {
      onStart,
      onToggleSound,
      onTogglePlay,
      onScrub,
      onStep,
      onCamera,
      onToggleHud,
      onAccent,
      onToggleNarrator,
    } = handlers;
    // The accent can be chosen on the intro and changed at any time in the sound panel.
    $$("button[data-accent]").forEach((btn) =>
      btn.addEventListener("click", () => onAccent(btn.dataset.accent)),
    );
    // The only narration button is the header's (site-header.js); it asks the page via this event.
    addEventListener("earth-jukebox:narrator-toggle", () => onToggleNarrator());
    this.mountBacking(handlers.onBacking);
    this.el.start.addEventListener("click", () =>
      this.failed ? location.reload() : onStart(),
    );
    $(".outro__again", this.el.outro).addEventListener("click", () =>
      handlers.onReplay(),
    );
    this.el.sound.addEventListener("click", () => onToggleSound());
    this.el.play.addEventListener("click", () => onTogglePlay());
    this.el.scrub.addEventListener("input", () =>
      onScrub(this.el.scrub.value / 1000),
    );
    this.el.cameras.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-camera]");
      if (btn) onCamera(btn.dataset.camera);
    });
    this.el.hud.addEventListener("click", onToggleHud);
    // A button clicked with the mouse does not keep the focus, so Space goes on meaning
    // "play or pause" instead of pressing that button again. Keyboard users keep their focus.
    $(".transport").addEventListener("click", (e) => {
      if (e.detail > 0) e.target.closest("button")?.blur();
    });

    // Phones: the panels live in a sheet over the full-screen scene.
    const sheet = $("#btn-sheet");
    // Opening the drawer takes the focus into it; closing (the button again, or Esc) returns it.
    const setSheet = (open) => {
      // Asking for the details means wanting the panels: leave the "scene only" mode first.
      if (open && document.body.classList.contains("is-cinema")) onToggleHud();
      document.body.classList.toggle("is-sheet", open);
      sheet.setAttribute("aria-expanded", String(open));
      if (open)
        $('.tabs button[aria-pressed="true"]', this.el.drawer)?.focus({
          preventScroll: true,
        });
      else if (this.el.drawer.contains(document.activeElement))
        sheet.focus({ preventScroll: true });
    };
    sheet?.addEventListener("click", () =>
      setSheet(!document.body.classList.contains("is-sheet")),
    );
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape" || document.body.classList.contains("is-intro"))
        return;
      if (document.body.classList.contains("is-sheet")) setSheet(false);
      else this.hideEnding();
    });

    $$("[data-info-for]").forEach((btn) => {
      const info = $(`#${btn.dataset.infoFor}`);
      btn.addEventListener("click", () => {
        info.hidden = !info.hidden;
        btn.setAttribute("aria-expanded", String(!info.hidden));
      });
    });

    // Number keys pick the cameras in the order of the buttons.
    const keys = {
      " ": () => onTogglePlay(),
      ArrowLeft: () => onStep(-1),
      ArrowRight: () => onStep(1),
      h: onToggleHud,
      m: () => onToggleSound(),
      n: onToggleNarrator,
      b: () =>
        onAccent(document.body.dataset.accent === "br" ? "universal" : "br"),
    };
    this.cameraModes.forEach((mode, i) => (keys[i + 1] = () => onCamera(mode)));
    document.addEventListener("keydown", (e) => {
      if (
        document.body.classList.contains("is-intro") ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey
      )
        return;
      // The timeline is a slider, not a text field: Space and the arrows mean the same on it as
      // anywhere else (Home, End and the vertical arrows keep the slider's own behaviour).
      const tag = e.target.tagName;
      if (
        (tag === "INPUT" && e.target.type !== "range") ||
        (tag === "BUTTON" && e.key === " ") ||
        tag === "SELECT"
      )
        return;
      const action = keys[e.key.length === 1 ? e.key.toLowerCase() : e.key];
      if (!action) return;
      e.preventDefault();
      action();
    });
  }

  // The bar moves with every file; the sentence (a live region) only changes at each quarter,
  // so a screen reader hears four updates instead of forty.
  renderLoading(done, total, what = "imagens de satélite") {
    this.loadingState = { done, total, what };
    this.el.introBar.style.width = `${(done / total) * 100}%`;
    const quarter = Math.floor((done / total) * 4);
    if (
      quarter === this.loadQuarter &&
      this.loadingLanguage === document.documentElement.lang
    )
      return;
    this.loadQuarter = quarter;
    this.loadingLanguage = document.documentElement.lang;
    setText(
      this.el.introStatus,
      t("common.loadingProgress", {
        what: t(what),
        percent: Math.round((done / total) * 100),
      }),
    );
  }

  renderReady(message) {
    this.readySource = message;
    this.loadingState = null;
    setText(this.el.introStatus, t(message));
    this.el.introBar.style.width = "100%";
    this.el.start.disabled = false;
    // Said again once the last images arrive: by then the intro may be gone, and the focus is the
    // visitor's.
    if (document.body.classList.contains("is-intro"))
      this.el.start.focus({ preventScroll: true });
  }

  // The experience can open before every image is here: the button is live while the status keeps
  // showing the progress (renderLoading), and renderReady says so when it is all in.
  enableStart() {
    // For measuring how long a visitor waits before the experience can start (DevTools, ?perf).
    performance.mark("earth-jukebox:start-enabled");
    this.el.start.disabled = false;
  }

  // Says what failed and offers the way out: the start button becomes "try again".
  renderLoadError(err) {
    this.failed = true;
    this.loadError = err.message;
    this.loadingState = null;
    this.readySource = null;
    setText(this.el.introStatus, t("common.loadError", { error: err.message }));
    this.el.introStatus.classList.add("is-error");
    setText(this.el.start, t("common.tryAgain"));
    this.el.start.disabled = false;
    this.el.start.focus();
  }

  hideIntro() {
    document.body.classList.remove("is-intro");
    this.el.intro.classList.add("is-leaving");
    setTimeout(() => (this.el.intro.hidden = true), 900);
    // The controls behind the intro become reachable, and the focus lands on the first of them
    // instead of falling back to the top of the page.
    this.el.layout.inert = false;
    this.el.play.focus({ preventScroll: true });
  }

  renderEvent(title, source) {
    setText(this.el.title, t(title));
    renderStatus(this.el.status, source);
  }

  // ticks: [{ t: 0..1, label }]
  renderTicks(ticks) {
    this.tickSource = ticks;
    this.el.ticks.innerHTML = ticks
      .map(
        (tick) =>
          `<span style="left:${(tick.t * 100).toFixed(2)}%">${tick.label}</span>`,
      )
      .join("");
    this.fitTicks();
  }

  // Hides the date labels that would overlap the one before them (phones, long dates).
  fitTicks() {
    const spans = [...this.el.ticks.children];
    spans.forEach((s) => (s.style.visibility = ""));
    let edge = -Infinity;
    spans.forEach((s) => {
      const r = s.getBoundingClientRect();
      if (r.width === 0) return;
      if (r.left < edge + 8) s.style.visibility = "hidden";
      else edge = r.right;
    });
  }

  // The measured series behind the scrubber, so the timeline shows where the event peaks.
  // points: [{ t, v }]; threshold: { v, label, long }; peak: { t, v, label }.
  // marker: { t, label } draws a vertical line for a moment (e.g. the explosion).
  renderProfile(
    points,
    { max, color, threshold, peak, marker, invertPeak = false },
  ) {
    this.profileSource = [
      points,
      { max, color, threshold, peak, marker, invertPeak },
    ];
    const H = 40;
    const x = (t) => (t * 1000).toFixed(1);
    const y = (v) => (H - (Math.min(v, max) / max) * (H - 4)).toFixed(1);
    const line = points
      .map((p, i) => `${i ? "L" : "M"}${x(p.t)},${y(p.v)}`)
      .join("");
    const area = `${line}L1000,${H}L0,${H}Z`;
    const stops = points
      .map(
        (p) => `<stop offset="${p.t.toFixed(4)}" stop-color="${color(p.v)}"/>`,
      )
      .join("");
    const shape = (cls) => `
      <svg class="profile__layer ${cls}" viewBox="0 0 1000 ${H}" preserveAspectRatio="none">
        <path class="profile__area" d="${area}" fill="url(#profile-grad)"/>
        <path class="profile__line" d="${line}" stroke="url(#profile-grad)"/>
      </svg>`;
    const pct = (v) => ((y(v) / H) * 100).toFixed(1);
    this.el.profile.innerHTML = `
      <svg width="0" height="0" style="position:absolute"><defs>
        <linearGradient id="profile-grad" x1="0" x2="1" y1="0" y2="0">${stops}</linearGradient>
      </defs></svg>
      ${threshold ? `<span class="profile__threshold${threshold.right ? " profile__threshold--right" : ""}" style="top:${pct(threshold.v)}%"><span>${threshold.label}<span class="profile__long">${threshold.long ?? ""}</span></span></span>` : ""}
      ${shape("profile__layer--ghost")}
      ${shape("profile__layer--live")}
      ${marker ? `<span class="profile__marker" style="left:${(marker.t * 100).toFixed(2)}%"><span>${marker.label}</span></span>` : ""}
      ${peak ? `<span class="profile__peak${invertPeak || peak.t < 0.35 ? " profile__peak--right" : ""}" style="left:${(peak.t * 100).toFixed(2)}%;top:${pct(peak.v)}%"><span>${peak.label}</span></span>` : ""}`;
  }

  // Top strip: the moment shown, day or night where the subject is, and the image on screen.
  renderTopBar({ time, elevation, day, night = t("common.night"), frame }) {
    setText("#hud-time", time);
    const chip = $("#hud-sun");
    const isDay = elevation > 0;
    chip.dataset.sun = isDay ? "day" : "night";
    setText(
      chip,
      isDay
        ? (day ?? t("common.sunAt", { degrees: fmt.num(elevation) }))
        : night,
    );
    const frameChip = $("#hud-frame");
    frameChip.hidden = !frame;
    if (frame) setText(frameChip, frame);
  }

  setTimeline(t) {
    this.el.scrub.value = Math.round(t * 1000);
    this.el.track.style.setProperty("--fill", `${t * 100}%`);
  }

  setReticle(label, color) {
    setText(this.el.reticleLabel, label);
    setText(this.strip.value, label);
    if (color) this.el.reticle.style.setProperty("--cat-color", color);
  }

  #placeReticle({ x, y, visible }) {
    // Relative to the stage, which scrolls with the page in the stacked (narrow) layout.
    // Measured once and again only when it can have moved: asking on every frame forces the
    // browser to lay the page out in the middle of the frame.
    if (!this.stageRect) {
      this.stageRect = this.stage.getBoundingClientRect();
      if (!this.stageWatch) {
        const forget = () => (this.stageRect = null);
        this.stageWatch = new ResizeObserver(forget);
        this.stageWatch.observe(this.stage);
        this.stageWatch.observe(document.body);
        addEventListener("scroll", forget, { passive: true, capture: true });
        addEventListener("resize", forget, { passive: true });
      }
    }
    const r = this.stageRect;
    const px = r.left + x * r.width;
    const py = r.top + y * r.height;
    const inside = py > r.top && py < r.bottom && py > 0;
    this.el.reticle.hidden = !(visible && inside);
    if (!this.el.reticle.hidden)
      this.el.reticle.style.transform = `translate(${px}px, ${py}px)`;
  }

  setCamera(mode) {
    this.scene.setCameraMode(mode);
    $$("button", this.el.cameras).forEach((b) =>
      setPressed(b, b.dataset.camera === mode),
    );
  }

  get cameraMode() {
    return this.scene.cameraMode;
  }

  setCinema(on) {
    this.cinemaState = on;
    document.body.classList.toggle("is-cinema", on);
    // Panels that are not shown are not reachable by keyboard either.
    $$(".hud").forEach((hud) => (hud.inert = on));
    setPressed(this.el.hud, on);
    setText(this.el.hud, t(on ? "common.showPanels" : "common.hidePanels"));
  }

  setSound(on) {
    this.soundState = on;
    setPressed(this.el.sound, on);
    setText(
      this.el.sound.querySelector(".btn__label"),
      t(on ? "common.disableSound" : "common.enableSound"),
    );
  }

  setPlaying(on) {
    this.playState = on;
    if (on) this.narrator?.resume();
    else this.narrator?.pause();
    setPressed(this.el.play, on);
    setText(
      this.el.play.querySelector(".btn__label"),
      t(on ? "common.pause" : "common.play"),
    );
  }

  // Which band plays the rule: the Brazilian style of this phenomenon, or the universal synths.
  // The choice of background music (a recorded track under the sound of the event), on the intro
  // and in the sound panel: one select, built here so every experience page has it.
  async mountBacking(onBacking) {
    const tracks = await listTracks();
    if (!tracks.length || !onBacking) return;
    this.backingTracks = tracks;
    const field = `<label class="backing"><span class="backing__label" data-backing-label></span><select class="backing__select" data-backing-select></select></label>`;
    $(".intro__accent")?.insertAdjacentHTML("beforeend", field);
    $('[aria-labelledby="accent-title"] .segmented')?.insertAdjacentHTML(
      "afterend",
      field,
    );
    $$("[data-backing-select]").forEach((sel) =>
      sel.addEventListener("change", () => onBacking(sel.value)),
    );
    this.renderBacking();
  }

  renderBacking(choice = this.backingChoice ?? "auto") {
    this.backingChoice = choice;
    if (!this.backingTracks) return;

    $$("[data-backing-label]").forEach((el) => setText(el, bt("label")));

    const matchingTrack =
      this.backingTracks.find((track) => track.band === this.lastStyle?.id)
        ?.id ?? "none";

    $$("[data-backing-select]").forEach((sel) => {
      sel.replaceChildren(
        new Option(bt("none"), "none"),
        ...this.backingTracks.map(({ id, name }) => new Option(name, id)),
      );

      const selectedValue = choice === "auto" ? matchingTrack : choice;

      sel.value = [...sel.options].some(
        (option) => option.value === selectedValue,
      )
        ? selectedValue
        : "none";
    });
  }

  renderAccent(accent, style) {
    this.lastAccent = accent;
    this.lastStyle = style;
    document.body.dataset.accent = accent;
    $$("button[data-accent]").forEach((b) =>
      setPressed(b, b.dataset.accent === accent),
    );
    setText(
      this.el.accentWhy,
      accent === "br"
        ? `${t(style.name)} · ${t(style.region)}. ${t(style.why)}`
        : t("music.universalDescription"),
    );
    // The intro states the whole rule in one breath, in the words of the accent chosen.
    const rule = $("#intro-rule");
    if (rule)
      setText(
        rule,
        `${rule.dataset.ruleLocalized === "true" ? rule.dataset.rule : t(rule.dataset.rule)} ${
          accent === "br" ? t(style.rule) : t(UNIVERSAL_RULE)
        }`,
      );
    setText(
      "#now-band",
      accent === "br"
        ? t("music.playingStyle", { style: t(style.name).toLowerCase() })
        : t("music.playingSynths"),
    );
    const layers =
      accent === "br"
        ? style.layers
        : UNIVERSAL_BAND.split(" · ").map((label) => ({ label, at: "" }));
    this.el.band.innerHTML = layers
      .map(
        (l) =>
          `<li class="band__chip"><span>${t(l.label)}</span> ${l.at ? `<small>${t(l.at)}</small>` : ""}<span class="visually-hidden" data-state></span></li>`,
      )
      .join("");
    this.bandChips = [...this.el.band.children];
    this.bandOn = -1;
    this.bandName =
      accent === "br" ? t(style.name).toLowerCase() : t("music.synths");
    this.strip.dots.innerHTML = layers.map(() => "<i></i>").join("");
    this.stripDots = [...this.strip.dots.children];
  }

  // Lights the instruments sounding at this intensity.
  renderBand(style, level) {
    const on = style
      ? activeLayers(style, level).length
      : this.bandChips.length;
    if (on === this.bandOn) return;
    this.bandOn = on;
    this.bandChips.forEach((chip, i) => {
      chip.classList.toggle("is-on", i < on);
      setText(
        chip.querySelector("[data-state]"),
        i < on ? t("music.playingState") : t("music.waitingState"),
      );
    });
    this.stripDots.forEach((dot, i) => dot.classList.toggle("is-on", i < on));
    setText(
      this.strip.band,
      t("music.bandCount", {
        band: this.bandName,
        on,
        total: this.bandChips.length,
      }),
    );
  }

  // Physics derived from the data, live: [{ key, label, value, unit, note, wide, alert }].
  renderScience(items) {
    if (!this.scienceCells) {
      this.el.science.innerHTML = items
        .map(
          (it) => `
          <div class="readout${it.wide ? " readout--wide" : ""}" data-key="${it.key}">
            <span class="readout__label">${it.label}</span>
            <span class="readout__value"><span data-v></span> <span class="readout__unit">${it.unit ?? ""}</span></span>
            <span class="readout__note" data-n></span>
          </div>`,
        )
        .join("");
      this.scienceCells = new Map(
        [...this.el.science.children].map((el) => [
          el.dataset.key,
          {
            el,
            label: el.querySelector(".readout__label"),
            unit: el.querySelector(".readout__unit"),
            value: el.querySelector("[data-v]"),
            note: el.querySelector("[data-n]"),
          },
        ]),
      );
    }
    for (const it of items) {
      const cell = this.scienceCells.get(it.key);
      setText(cell.label, it.label);
      setText(cell.unit, it.unit ?? "");
      setText(cell.value, it.value);
      setText(cell.note, it.note ?? "");
      cell.el.classList.toggle("is-alert", Boolean(it.alert));
    }
  }

  // Voice narration of the milestones, for listening without the screen.
  setNarrator(on, announce = false) {
    this.narratorState = on;
    this.narrating = on;
    document.documentElement.dataset.narrator = on ? "on" : "off";
    dispatchEvent(
      new CustomEvent("earth-jukebox:narrator-state", { detail: on }),
    );
    // With the narrator speaking, the announcements stop being a live region: a screen reader
    // would otherwise say every milestone a second time.
    if (on) {
      this.el.toast.removeAttribute("role");
      this.el.toast.setAttribute("aria-live", "off");
    } else {
      this.el.toast.removeAttribute("aria-live");
      this.el.toast.setAttribute("role", "status");
    }
    if (!on) this.narrator?.cancel();
    else if (announce)
      this.say(
        this.summary
          ? `${t("common.narrationOn")} ${this.summary}`
          : t("common.narrationOn"),
      );
  }

  // Utterances queue up like the announcements they read: one never cuts the other off.
  say(text, replace = false) {
    if (!this.narrating) return;
    (this.narrator ??= new Narrator()).say(
      text
        .replaceAll(" · ", ". ")
        .replaceAll(" kt", " nós")
        .replaceAll("km²", "quilômetros quadrados"),
      {
        lang: document.documentElement.lang,
        volume: Math.min(1, this.audio.volume / VOLUME_UNITY),
        replace,
      },
    );
  }

  // Short announcement of an event in the data (a category, a calving, the explosion).
  // Announcements wait their turn, each staying long enough to be read, instead of replacing
  // one another. Options:
  //   quiet: a detail (an instrument joining) that is dropped when something else is showing.
  //   key: a newer waiting announcement with the same key replaces the older one, so a burst
  //        (four categories lost in two seconds) ends on the latest state.
  //   urgent: a moment of the story (the peak, a calving, the explosion) goes to the front and
  //        cuts short whatever is showing, so it is said while it is happening.
  // An announcement that waited too long is dropped: said late, it would contradict the data
  // already on screen.
  toast(text, seconds = 4, { quiet = false, key = null, urgent = false } = {}) {
    const queue = (this.toasts ??= []);
    if (quiet && (this.toastShowing || queue.length)) return;
    const entry = { text, seconds, key, at: performance.now() };
    const waiting = key ? queue.findIndex((t) => t.key === key) : -1;
    if (urgent) queue.unshift(entry);
    else if (waiting !== -1) queue[waiting] = entry;
    else queue.push(entry);
    if (!this.toastShowing) this.#nextToast();
    else if (urgent) {
      // What is on screen keeps at least a second and a half, enough to be read.
      const shown = performance.now() - this.toastShownAt;
      clearTimeout(this.toastTimer);
      this.toastTimer = setTimeout(
        () => {
          this.el.toast.classList.remove("is-on");
          this.toastTimer = setTimeout(() => this.#nextToast(), 200);
        },
        Math.max(0, 1500 - shown),
      );
    }
  }

  // Drops what is waiting and on screen (the story jumped somewhere else).
  clearToasts() {
    this.toasts = [];
    clearTimeout(this.toastTimer);
    this.toastShowing = false;
    this.el.toast.classList.remove("is-on");
    this.narrator?.cancel();
    window.speechSynthesis?.cancel();
  }

  #nextToast() {
    const fresh = performance.now() - 4000;
    let next = this.toasts.shift();
    while (next && next.at < fresh) next = this.toasts.shift();
    this.toastShowing = Boolean(next);
    if (!next) return;
    const el = this.el.toast;
    this.toastShownAt = performance.now();
    setText(el, next.text);
    this.say(next.text, true);
    el.classList.remove("is-on");
    void el.offsetWidth;
    el.classList.add("is-on");
    // With others waiting, each gets a shorter but still readable turn.
    const seconds = this.toasts.length
      ? Math.min(next.seconds, 2.4)
      : next.seconds;
    this.toastTimer = setTimeout(() => {
      el.classList.remove("is-on");
      this.toastTimer = setTimeout(() => this.#nextToast(), 260);
    }, seconds * 1000);
  }

  // The end of the story: what was heard, in one sentence, and where to go next.
  // { title, text, next: { href, label } }
  showEnding({ title, text, next }) {
    const el = this.el.outro;
    setText($(".outro__title", el), title);
    setText($(".outro__text", el), text);
    const link = $(".outro__next", el);
    link.href = next.href;
    setText(link, next.label);
    el.hidden = false;
    document.body.classList.add("is-ended");
    // The card that steps back is not left as an invisible stop for the Tab key.
    $(".hud--left").inert = true;
    $(".outro__again", el).focus({ preventScroll: true });
    this.say(`${title}. ${text}`);
  }

  hideEnding() {
    if (this.el.outro.hidden) return;
    this.el.outro.hidden = true;
    document.body.classList.remove("is-ended");
    $(".hud--left").inert = document.body.classList.contains("is-cinema");
  }

  setSourceLabel(text) {
    setText(this.el.source, text);
  }

  get fmt() {
    return fmt;
  }
}
