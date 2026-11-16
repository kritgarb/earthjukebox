// Tone.js is the heaviest library of the page (~340 KB) and nothing sounds before the first tap,
// so it is not part of the page's own load: it is fetched once the page has settled (see warm),
// and in any case when the sound is first turned on.
let Tone = null;

// One second of silence as a WAV file (8 kHz, 16-bit mono).
function silentWavUrl(seconds = 1, rate = 8000) {
  const samples = seconds * rate;
  const view = new DataView(new ArrayBuffer(44 + samples * 2));
  const text = (offset, s) => [...s].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  text(0, 'RIFF');
  view.setUint32(4, 36 + samples * 2, true);
  text(8, 'WAVEfmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, samples * 2, true);
  return URL.createObjectURL(new Blob([view], { type: 'audio/wav' }));
}

// Master bus shared by every voice on a page, with analysers for the visual scopes.
// Volume is a 0..100 slider; UNITY is where the mix sounds exactly as it was composed. Above it
// there is up to ~6 dB of extra gain (the limiter at the end of the chain keeps it from clipping).
export const VOLUME_UNITY = 70;
const VOLUME_KEY = 'earth-jukebox:volume';
const gainFor = (percent) => (percent / VOLUME_UNITY) ** 2;

export class AudioEngine {
  bus = null;
  #volume = VOLUME_UNITY;
  #volumeListeners = new Set();
  #unlocked = false;
  #loading = null;
  #adopted = false;
  native = null;

  constructor() {
    try {
      const saved = Number(localStorage.getItem(VOLUME_KEY));
      if (localStorage.getItem(VOLUME_KEY) != null && saved >= 0 && saved <= 100) this.#volume = saved;
    } catch {
      // Storage unavailable: keep the default.
    }
    // By the time someone has read the intro and pressed the button, Tone is already here. And if
    // it is not, the tap still works: the audio context is created and resumed by unlock(), inside
    // the gesture, and Tone adopts it when it arrives (see start).
    const warm = () => this.load().catch(() => {});
    setTimeout(() => (window.requestIdleCallback ? requestIdleCallback(warm, { timeout: 4000 }) : warm()), 1500);
    document.addEventListener('pointerdown', warm, { once: true, passive: true });
  }

  load() {
    this.#loading ??= import('tone').then((mod) => (Tone = mod));
    return this.#loading;
  }

  // Must run synchronously inside the user's tap, before any await.
  // On iPhone, Web Audio follows the ring/silent switch and stays mute in silent mode; declaring
  // the page as media playback (audioSession on iOS 17+, a looping silent <audio> on older
  // versions) makes it sound like a video would. It also resumes audio the system suspended
  // (screen locked, another app took over).
  unlock() {
    if (this.#unlocked) return;
    this.#unlocked = true;
    if (navigator.audioSession) navigator.audioSession.type = 'playback';
    const silence = new Audio(silentWavUrl());
    silence.loop = true;
    silence.setAttribute('playsinline', '');
    silence.play().catch(() => {});
    this.silence = silence;

    // The context itself is born and resumed here, synchronously in the tap: phones do not let a
    // context start after an await (such as the download of Tone). Tone adopts it later.
    const Context = window.AudioContext || window.webkitAudioContext;
    if (Context) {
      try {
        this.native = new Context({ latencyHint: 'interactive' });
        this.native.resume().catch(() => {});
      } catch {
        this.native = null;
      }
    }

    const resume = () => {
      if (!this.bus) return;
      const ctx = this.native ?? Tone?.getContext().rawContext;
      if (ctx && ctx.state !== 'running') ctx.resume();
      if (this.silence.paused) this.silence.play().catch(() => {});
    };
    document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && resume());
    document.addEventListener('pointerdown', resume, { passive: true });
  }

  async start() {
    this.unlock();
    // Normally already loaded (see the constructor); this only waits if the tap came very early.
    if (!Tone) await this.load();
    // Before any node exists, so the whole graph lives in the context that the tap unlocked.
    if (this.native && !this.#adopted) {
      Tone.setContext(this.native);
      this.#adopted = true;
    }
    await Tone.start();
    if (!this.bus) {
      const limiter = new Tone.Limiter(-1.5).toDestination();
      // Gentle cut of the very top, where noise textures turn into hiss.
      // Master volume sits right before the limiter, after the analysers' tap, so the scopes keep
      // showing the data's own level whatever the listener's volume.
      const master = new Tone.Gain(gainFor(this.#volume)).connect(limiter);
      const air = new Tone.Filter({ type: 'lowpass', frequency: 7000, rolloff: -12 }).connect(master);
      // A soft compressor holds the band together and lifts the quiet openings, so the music is
      // present from the first bar instead of only at the peak of the event.
      const glue = new Tone.Compressor({ threshold: -26, ratio: 3, attack: 0.02, release: 0.3, knee: 12 });
      const makeup = new Tone.Volume(5).connect(air);
      glue.connect(makeup);
      const input = new Tone.Volume(0).connect(glue);
      const waveformNode = new Tone.Waveform(1024);
      const fftNode = new Tone.FFT(64);
      input.connect(waveformNode);
      input.connect(fftNode);
      this.bus = { input, limiter, master, waveformNode, fftNode };
    }
    return this.bus.input;
  }

  // 0..100. Persisted, and applied at once if the bus already exists (or when it is built).
  get volume() {
    return this.#volume;
  }

  setVolume(percent) {
    this.#volume = Math.round(Math.min(100, Math.max(0, percent)));
    try {
      localStorage.setItem(VOLUME_KEY, String(this.#volume));
    } catch {
      // Keeps working for this visit.
    }
    this.bus?.master.gain.rampTo(gainFor(this.#volume), 0.05);
    this.#volumeListeners.forEach((fn) => fn(this.#volume));
  }

  onVolumeChange(fn) {
    this.#volumeListeners.add(fn);
    return () => this.#volumeListeners.delete(fn);
  }

  get started() {
    return this.bus != null;
  }

  get input() {
    return this.bus?.input;
  }

  waveform() {
    return this.bus ? this.bus.waveformNode.getValue() : null;
  }

  spectrum() {
    return this.bus ? this.bus.fftNode.getValue() : null;
  }

  // Sample-accurate repeating callback on the transport; `callback(time)` runs ahead of the audio.
  repeat(callback, intervalSeconds) {
    const transport = Tone.getTransport();
    const id = transport.scheduleRepeat(callback, intervalSeconds, transport.seconds + 0.05);
    if (transport.state !== 'started') transport.start();
    return id;
  }

  cancel(id) {
    if (id != null) Tone.getTransport().clear(id);
  }

  // Runs a visual update when the audio event scheduled at `time` is heard.
  // (Tone.Draw drops events when a frame is late, so a timer keyed to the audio clock is used.)
  draw(fn, time) {
    setTimeout(fn, Math.max(0, (time - Tone.getContext().currentTime) * 1000));
  }

  // RMS loudness 0..~0.7, used to make visuals react to what is actually playing.
  level() {
    const w = this.waveform();
    if (!w) return 0;
    let sum = 0;
    for (let i = 0; i < w.length; i++) sum += w[i] * w[i];
    return Math.sqrt(sum / w.length);
  }
}
