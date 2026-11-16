import * as Tone from 'tone';
import { createMusic, swapMusic } from './createMusic.js';

// Synth voice for the night lights: the shared Jukebox music, plus its texture (a shimmer that
// brightens as the world lights up, and a soft drone on the current note) and the sweep: one
// bell per lit place the scan line passes over. Places that got brighter ring high and clear,
// places that went dark sound low and soft. Receives parameters from SensoryMapper
// (nightLightsToSound).
export class NightLightsVoice {
  #sourcesStarted = false;

  constructor(destination, style = null) {
    this.output = new Tone.Gain(0).connect(destination);
    this.reverb = new Tone.Reverb({ decay: 7, wet: 0.35 }).connect(this.output);

    this.shimmer = new Tone.FatOscillator({ type: 'sine', count: 4, spread: 38, frequency: 1760 }).connect(this.reverb);
    this.shimmer.volume.value = -62;
    this.droneFilter = new Tone.Filter({ type: 'lowpass', frequency: 520, rolloff: -24 }).connect(this.reverb);
    this.drone = new Tone.FatOscillator({ type: 'triangle', count: 3, spread: 18, frequency: 110 }).connect(this.droneFilter);
    this.drone.volume.value = -60;

    this.music = createMusic(style, this.reverb, this.output);

    // The sweep: all three kinds of bell share one panner, set at the moment each one sounds.
    this.panner = new Tone.Panner(0).connect(this.reverb);
    this.lit = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 3,
      modulationIndex: 1.6,
      envelope: { attack: 0.004, decay: 0.7, sustain: 0, release: 0.8 },
      modulationEnvelope: { attack: 0.003, decay: 0.3, sustain: 0 },
    }).connect(this.panner);
    this.lit.volume.value = -20;
    // More light: a brighter, glassier bell.
    this.more = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 4.01,
      modulationIndex: 3.2,
      envelope: { attack: 0.003, decay: 1.1, sustain: 0, release: 1.2 },
      modulationEnvelope: { attack: 0.002, decay: 0.5, sustain: 0 },
    }).connect(this.panner);
    this.more.volume.value = -19;
    // Less light: a low, rounded note that fades like a lamp turned down.
    this.lessFilter = new Tone.Filter({ type: 'lowpass', frequency: 700, rolloff: -12 }).connect(this.panner);
    this.less = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.03, decay: 1.2, sustain: 0, release: 1.4 },
    }).connect(this.lessFilter);
    this.less.volume.value = -13;
  }

  setStyle(style) {
    swapMusic(this, style, this.reverb, this.output);
  }

  start() {
    if (!this.#sourcesStarted) {
      const t = Tone.now();
      [this.shimmer, this.drone].forEach((n) => n.start(t));
      this.#sourcesStarted = true;
    }
    this.music.start();
    this.output.gain.rampTo(1, 0.8);
  }

  stop() {
    this.output.gain.rampTo(0, 0.4);
    this.music.stop();
  }

  set(p, ramp = 0.4) {
    this.music.set(p, ramp);
    this.shimmer.volume.rampTo(p.shimmerDb, ramp);
    this.shimmer.frequency.rampTo(p.pitchHz * 8, 0.1);
    this.drone.frequency.rampTo(p.pitchHz, 0.1);
    this.drone.volume.rampTo(p.droneDb, ramp);
    this.reverb.wet.rampTo(p.reverbWet, ramp);
  }

  // Seconds until the next sixteenth of the music, so a bell lands on the grid of the band.
  #nextSixteenth() {
    const transport = Tone.getTransport();
    if (transport.state !== 'started') return Tone.now();
    const step = 60 / transport.bpm.value / 4;
    const ahead = step - (transport.seconds % step);
    return Tone.now() + (ahead < 0.02 ? ahead + step : ahead);
  }

  // kind: 'lit' (a place that is lit), 'more' or 'less'; midi: a note of the current chord;
  // pan -1..1 from the longitude; strength 0..1.
  ping(kind, midi, pan, strength = 0.7) {
    const t = this.#nextSixteenth();
    this.panner.pan.setValueAtTime(pan, t);
    const hz = Tone.Frequency(midi, 'midi').toFrequency();
    const synth = this[kind] ?? this.lit;
    synth.triggerAttackRelease(hz, kind === 'less' ? 1.2 : 0.6, t, Math.min(1, 0.35 + strength * 0.65));
  }
}
