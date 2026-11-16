import * as Tone from 'tone';
import { createMusic, swapMusic } from './createMusic.js';

// Synth voice for the eruption: the shared Jukebox music, plus its texture: a roar that follows
// the umbrella's growth, a drone on the current note, an icy shimmer for the coldest tops, and
// the explosion itself (a drum stroke and a chord). Receives parameters from SensoryMapper (eruptionToSound).
export class EruptionVoice {
  #sourcesStarted = false;

  constructor(destination, style = null) {
    this.output = new Tone.Gain(0).connect(destination);
    this.reverb = new Tone.Reverb({ decay: 8, wet: 0.3 }).connect(this.output);
    this.drive = new Tone.Distortion({ distortion: 0.1, wet: 0 }).connect(this.reverb);

    this.roarFilter = new Tone.Filter({ type: 'bandpass', frequency: 300, Q: 0.6 }).connect(this.drive);
    this.roar = new Tone.Noise('brown').connect(this.roarFilter);
    this.roar.volume.value = -80;

    this.droneFilter = new Tone.Filter({ type: 'lowpass', frequency: 420, rolloff: -24 }).connect(this.reverb);
    this.drone = new Tone.FatOscillator({ type: 'sawtooth', count: 3, spread: 28, frequency: 55 }).connect(this.droneFilter);
    this.drone.volume.value = -60;
    this.sub = new Tone.Oscillator({ type: 'sine', frequency: 27.5 }).connect(this.reverb);
    this.sub.volume.value = -60;

    this.shimmer = new Tone.FatOscillator({ type: 'sine', count: 4, spread: 45, frequency: 1760 }).connect(this.reverb);
    this.shimmer.volume.value = -62;

    this.music = createMusic(style, this.reverb, this.output);

    // The explosion, as music: one deep drum stroke and the full chord opening over it.
    this.boomOut = new Tone.Gain(1).connect(destination);
    this.boomVerb = new Tone.Reverb({ decay: 7, wet: 0.5 }).connect(this.boomOut);
    this.thump = new Tone.MembraneSynth({
      pitchDecay: 0.5,
      octaves: 2.5,
      envelope: { attack: 0.01, decay: 2.6, sustain: 0, release: 1 },
    }).connect(this.boomVerb);
    this.thump.volume.value = -7;
    this.swell = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'fatsawtooth', count: 3, spread: 22 },
      envelope: { attack: 0.25, decay: 2.5, sustain: 0.25, release: 4 },
    }).connect(new Tone.Filter({ type: 'lowpass', frequency: 1300, rolloff: -24 }).connect(this.boomVerb));
    this.swell.volume.value = -15;
  }

  // Universal (null) or a Brazilian style from core/sotaque.js.
  setStyle(style) {
    swapMusic(this, style, this.reverb, this.output);
  }

  start() {
    if (!this.#sourcesStarted) {
      const t = Tone.now();
      [this.roar, this.drone, this.sub, this.shimmer].forEach((n) => n.start(t));
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
    this.roar.volume.rampTo(p.roarDb, ramp);
    this.roarFilter.frequency.rampTo(p.roarHz, ramp);
    this.music.set(p, ramp);
    this.drone.frequency.rampTo(p.pitchHz / 2, 0.08);
    this.sub.frequency.rampTo(p.pitchHz / 4, 0.08);
    this.drone.volume.rampTo(p.droneDb, ramp);
    this.sub.volume.rampTo(p.droneDb - 2, ramp);
    this.shimmer.volume.rampTo(p.shimmerDb, ramp);
    this.reverb.wet.rampTo(p.reverbWet, ramp);
  }

  // chord: MIDI notes sounding now.
  boom(chord = [45, 48, 52]) {
    const t = Tone.now();
    const hz = (m) => Tone.Frequency(m, 'midi').toFrequency();
    this.thump.triggerAttackRelease(55, 2.6, t);
    // Root, fifth and octaves of the chord, from the bass up.
    const notes = [chord[0] - 12, chord[0], chord[2], chord[0] + 12, chord[1] + 12].map(hz);
    this.swell.triggerAttackRelease(notes, 3.5, t + 0.03);
  }
}
