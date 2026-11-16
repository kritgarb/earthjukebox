import gsap from "gsap";
import { STYLES, activeLayers, tuneOf } from "../models/core/sotaque.js";
import { t } from "../i18n/index.js";
import { resolveTrack, prefetchTrack } from "../views/sensory/RhythmLoops.js";

const playing = (names) =>
  names.length === 1
    ? t("controller.playingOneInstrument", { instrument: t(names[0]) })
    : t("controller.playingSeveralInstruments", {
        instruments: `${names.slice(0, -1).map(t).join(", ")} ${t("controller.and")} ${t(names.at(-1))}`,
      });

const ACCENT_KEY = "earth-jukebox:accent";
const NARRATOR_KEY = "earth-jukebox:narrator";
const BACKING_KEY = "earth-jukebox:backing";

// Preferences survive across the three experiences; storage may be unavailable (private mode).
const recall = (key, fallback) => {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
};
const remember = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* the choice just lasts for this page */
  }
};

// Shared flow of every experience: load the data, unlock audio on the first gesture, play the
// timeline, scrub, switch cameras. Subclasses implement load(), render(state) and createVoice(input).
export class ExperienceController {
  soundOn = false;
  cinema = false;
  voice = null;
  tween = null;

  ready = false;
  bandSize = 0;
  // The recorded track under the event (see views/sensory/RhythmLoops.js), when its band has one.
  backing = null;
  backingActive = false;
  backingCheck = 0;
  // "auto" (the track of the band that is playing), "none" or the id of a track the listener picked.
  backingChoice = "auto";
  backingStorageKey = BACKING_KEY;

  // `style`: the Brazilian accent of this phenomenon (a key of STYLES in core/sotaque.js).
  constructor({
    view,
    timeline,
    audio,
    playSeconds,
    stepT,
    startCamera,
    style,
  }) {
    this.brStyle = typeof style === "string" ? STYLES[style] : style;
    this.backingStorageKey = `${BACKING_KEY}:${location.pathname}`;
    this.backingChoice = recall(this.backingStorageKey, "auto");
    this.accent = recall(ACCENT_KEY, "br") === "universal" ? "universal" : "br";
    this.narrator = recall(NARRATOR_KEY, "off") === "on";
    this.view = view;
    this.timeline = timeline;
    this.audio = audio;
    this.playSeconds = playSeconds;
    this.stepT = stepT;
    this.startCamera = startCamera;
  }

  handlers() {
    return {
      onStart: () => this.start(),
      onToggleSound: () => this.toggleSound(),
      onTogglePlay: () => this.togglePlay(),
      onScrub: (t) => this.scrub(t),
      onStep: (dir) => this.scrub(this.timeline.t + dir * this.stepT),
      onCamera: (mode) => this.setCamera(mode),
      onToggleHud: () => this.toggleHud(),
      onReplay: () => this.replay(),
      onAccent: (accent) => this.setAccent(accent),
      onToggleNarrator: () => this.setNarrator(!this.narrator),
      onBacking: (choice) => this.setBacking(choice),
    };
  }

  // Sends the mapped parameters to the voice. Sixteen updates a second are heard as continuous;
  // one per frame only floods the audio clock with ramps.
  sing(sound) {
    this.pendingSound = sound;
    if (!this.soundOn) return;
    const push = () => {
      this.singTimer = null;
      this.sungAt = performance.now();
      if (this.soundOn) {
        // Under a recording the event's music keeps the recording's tempo, not the data's.
        const sound =
          this.backingActive && this.backing
            ? { ...this.pendingSound, bpm: this.backing.tempo }
            : this.pendingSound;
        this.voice.set(sound);
      }
    };
    const wait = 60 - (performance.now() - (this.sungAt ?? 0));
    if (wait <= 0) push();
    else this.singTimer ??= setTimeout(push, wait);
  }

  // The band playing the Jukebox rule: a Brazilian style, or null for the universal synthesizers.
  get style() {
    return this.accent === "br" ? this.brStyle : null;
  }

  // Mode and chord size the accent asks of the mapper.
  get tune() {
    return tuneOf(this.style);
  }

  setAccent(accent) {
    if (accent === this.accent) return;
    this.accent = accent;
    remember(ACCENT_KEY, accent);
    this.voice?.setStyle(this.style);
    this.refreshBacking();
    this.view.renderAccent(accent, this.brStyle);
    this.bandSize = 0;
    if (this.ready) this.render(this.timeline.state);
  }

  setNarrator(on) {
    this.narrator = on;
    remember(NARRATOR_KEY, on ? "on" : "off");
    this.view.setNarrator(on, true);
  }

  // The instruments that just came in, when the timeline moves forward across their threshold.
  bandEntered(level, forward) {
    const style = this.style;
    if (!style) return null;
    const layers = activeLayers(style, level);
    const entered =
      forward && this.bandSize && layers.length > this.bandSize
        ? layers.slice(this.bandSize)
        : null;
    this.bandSize = layers.length;
    return entered;
  }

  // Says which instrument joined the band.
  announceBand(level, forward) {
    const entered = this.bandEntered(level, forward);
    if (this.backingActive) return;
    if (entered) {
      this.view.toast(
        t("controller.instrumentJoins", {
          style: t(this.style.name),
          instruments: entered
            .map((l) => t(l.label))
            .join(` ${t("controller.and")} `),
          threshold: t(entered.at(-1).at),
        }),
        3,
        { quiet: true },
      );
    }
  }

  async init() {
    this.view.bind(this.handlers());
    this.view.renderAccent(this.accent, this.brStyle);
    this.view.renderBacking(this.backingChoice);
    this.view.setNarrator(this.narrator);
    try {
      await this.load();
    } catch (err) {
      console.error(err);
      this.view.renderLoadError(err);
      return;
    }
    this.timeline.on("change", (state) => this.render(state));
    // Once the page has settled, the track is already in the cache when the listener taps start.
    const warm = () => prefetchTrack(this.backingChoice, this.style?.id).catch(() => {});
    setTimeout(() => (window.requestIdleCallback ? requestIdleCallback(warm, { timeout: 4000 }) : warm()), 2000);
    this.ready = true;
    this.timeline.setTime(0);
  }

  // The first gesture unlocks audio, flies the camera down to the subject and starts the story.
  async start() {
    // First thing in the tap: phones only allow audio to start inside the gesture.
    this.audio.unlock();
    this.view.hideIntro();
    this.setCamera(this.startCamera);
    await this.toggleSound(true);
    this.togglePlay();
    this.announceOpening();
  }

  // Said as the story starts: where the data is and, with the Brazilian accent, who is playing.
  // Subclasses give the data half in openingLine(state).
  announceOpening() {
    const state = this.timeline.state;
    const style = this.style;
    const level = this.pendingSound?.noteLevel ?? 0;
    const band =
      style && !this.backingActive
        ? ` · ${playing(activeLayers(style, level).map((l) => l.label))}`
        : "";
    this.view.toast(`${this.openingLine(state)}${band}`, 5);
  }

  openingLine() {
    return "";
  }

  // Moments of the story that are not a change in the band: [{ t, text, seconds }], announced
  // when the timeline moves forward across them.
  moments = [];

  announceMoments(from, to) {
    if (!(to > from && to - from < 0.05)) return;
    this.moments
      .filter((m) => m.t > from && m.t <= to)
      .forEach((m) =>
        this.view.toast(m.text, m.seconds ?? 5, { urgent: true }),
      );
  }

  // What the ending card says. Subclasses return { title, text, next: { href, label } }.
  ending() {
    return null;
  }

  replay() {
    this.view.hideEnding();
    this.view.clearToasts();
    this.bandSize = 0;
    this.timeline.setTime(0);
    this.togglePlay();
    this.announceOpening();
  }

  async toggleSound(force) {
    const on = force ?? !this.soundOn;
    if (on === this.soundOn || this.soundBusy) return;
    // A second tap while the first is still loading Tone and building the voice would build another.
    this.soundBusy = true;
    try {
      if (on) {
        const input = await this.audio.start();
        this.input = input;
        if (!this.voice) this.voice = await this.createVoice(input);
        this.soundOn = true;
        this.render(this.timeline.state);
        // Paused: the music waits for play, it does not start by itself.
        if (this.tween) this.voice.start();
      } else {
        this.soundOn = false;
        this.voice.stop();
      }
    } finally {
      this.soundBusy = false;
    }
    this.refreshBacking();
    this.view.setSound(this.soundOn);
  }

  // The recorded track of the band that is playing, underneath the voice of the event: it starts
  // with the sound, follows its tempo and stops with it. No track for the band (or the universal
  // accent): nothing changes. What of the synthesized band it silences is set in the manifest.
  async refreshBacking() {
    const check = ++this.backingCheck;
    const entry =
      this.soundOn && this.input && this.tween
        ? await resolveTrack(this.backingChoice, this.style?.id)
        : null;
    if (check !== this.backingCheck) return;
    if (!entry) {
      this.backing?.stop();
      this.backingActive = false;
      this.silenceBand(false);
      return;
    }
    if (!this.backing) {
      const { BackingTrack } = await import("../views/sensory/BackingTrack.js");
      if (check !== this.backingCheck) return;
      this.backing = new BackingTrack(this.input);
    }
    const playing = await this.backing.play(entry);
    if (check !== this.backingCheck) return;
    this.backingActive = playing;
    this.silenceBand(playing);
  }

  setBacking(choice) {
    this.backingChoice = choice;
    remember(this.backingStorageKey, choice);
    this.view.renderBacking(choice);
    this.refreshBacking();
  }

  // With a recorded track under the event, the recording is the rhythm: the synthesized rhythm
  // section stays quiet and the sounds the event generates play on top.
  silenceBand(playing) {
    this.voice?.music?.setAccompaniment?.(!playing);
  }

  togglePlay() {
    if (this.tween) {
      this.pause();
      return;
    }

    this.view.hideEnding();
    this.view.scene?.setPlaying?.(true);

    const proxy = { t: this.timeline.t >= 0.999 ? 0 : this.timeline.t };

    this.tween = gsap.to(proxy, {
      t: 1,
      duration: this.playSeconds * (1 - proxy.t),
      ease: "none",
      onUpdate: () => this.timeline.setTime(proxy.t),
      onComplete: () => {
        this.pause();

        const ending = this.ending();
        if (ending) this.view.showEnding(ending);
      },
    });

    // Resumes the audio only if it is already enabled (after the timeline runs: the recording only
    // plays while it does).
    if (this.soundOn) {
      this.voice?.start();
      this.refreshBacking();
    }

    this.view.setPlaying(true);
  }

  pause() {
    this.tween?.kill();
    this.tween = null;

    // Stop the synthesized music and the background track, along with the timeline.
    this.voice?.stop();
    this.backing?.stop();
    this.backingActive = false;
    this.silenceBand(false);

    this.view.scene?.setPlaying?.(false);
    this.view.setPlaying(false);
  }

  scrub(t) {
    this.view.hideEnding();
    // Announcements still waiting belong to the moment the listener just left.
    this.view.clearToasts();
    this.pause();
    this.timeline.setTime(t);
  }

  setCamera(mode) {
    this.view.setCamera(mode);
    this.render(this.timeline.state);
  }

  toggleHud() {
    this.cinema = !this.cinema;
    this.view.setCinema(this.cinema);
  }
}
