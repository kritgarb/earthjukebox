import * as Tone from 'tone';
import { lerp } from '../../../models/core/math.js';
import { createMusic, swapMusic } from './createMusic.js';

// Synth voice for a storm: the shared Jukebox music, plus its texture: wind (filtered pink
// noise), a core on the current note that grows rough with the category, and rain hiss.
// Receives parameters from SensoryMapper (hurricaneToSound).
export class StormVoice {
  #sourcesStarted = false;

  set onBeat(fn) {
    this.music.onBeat = fn;
  }

  constructor(destination, style = null) {
    this.output = new Tone.Gain(0).connect(destination);
    this.panner = new Tone.Panner(0).connect(this.output);
    this.reverb = new Tone.Reverb({ decay: 5, wet: 0.3 }).connect(this.panner);
    this.tone = new Tone.Filter({ type: 'lowpass', frequency: 1500, rolloff: -24, Q: 0.7 }).connect(this.reverb);
    this.drive = new Tone.Distortion({ distortion: 0.5, wet: 0 }).connect(this.tone);

    this.windFilter = new Tone.AutoFilter({
      frequency: 0.2,
      baseFrequency: 240,
      octaves: 3.4,
      depth: 0.9,
      filter: { type: 'bandpass', rolloff: -12, Q: 1.3 },
    }).connect(this.tone);
    this.wind = new Tone.Noise('pink').connect(this.windFilter);
    this.wind.volume.value = -80;

    this.core = new Tone.FatOscillator({ type: 'sawtooth', count: 3, spread: 12, frequency: 220 }).connect(this.drive);
    this.core.volume.value = -31;
    this.sub = new Tone.Oscillator({ type: 'sine', frequency: 110 }).connect(this.tone);
    this.sub.volume.value = -28;

    // Rain as a band of soft noise: a high-passed white noise read as hiss under the music.
    this.rainFilter = new Tone.Filter({ type: 'bandpass', frequency: 1600, Q: 0.8 }).connect(this.reverb);
    this.rain = new Tone.Noise('pink').connect(this.rainFilter);
    this.rain.volume.value = -80;

    this.music = createMusic(style, this.reverb, this.panner);
  }

  // Universal (null) or a Brazilian style from core/sotaque.js.
  setStyle(style) {
    swapMusic(this, style, this.reverb, this.panner);
  }

  start() {
    if (!this.#sourcesStarted) {
      const t = Tone.now();
      [this.wind, this.core, this.sub, this.rain, this.windFilter].forEach((n) => n.start(t));
      this.#sourcesStarted = true;
    }
    this.music.start();
    this.output.gain.rampTo(1, 0.6);
  }

  stop() {
    this.output.gain.rampTo(0, 0.4);
    this.music.stop();
  }

  set(p, ramp = 0.35) {
    this.music.set(p, ramp);
    if (p.pitchHz != null) {
      // Notes step rather than slide, like an instrument.
      this.core.frequency.rampTo(p.pitchHz, 0.06);
      this.sub.frequency.rampTo(p.pitchHz / 2, 0.06);
    }
    if (p.windDb != null) this.wind.volume.rampTo(p.windDb, ramp);
    if (p.intensity != null) this.windFilter.frequency.rampTo(lerp(0.08, 2.4, p.intensity), ramp);
    if (p.brightnessHz != null) this.tone.frequency.rampTo(p.brightnessHz, ramp);
    if (p.detuneCents != null) this.core.spread = p.detuneCents;
    if (p.drive != null) this.drive.wet.rampTo(p.drive, ramp);
    if (p.pan != null) this.panner.pan.rampTo(p.pan, ramp);
    if (p.rainDb != null) this.rain.volume.rampTo(p.rainDb, ramp);
    if (p.reverbWet != null) this.reverb.wet.rampTo(p.reverbWet, ramp);
    if (p.level != null) this.output.gain.rampTo(p.level, ramp);
  }
}
