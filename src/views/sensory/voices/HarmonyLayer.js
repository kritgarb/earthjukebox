import * as Tone from 'tone';

const toHz = (midi) => Tone.Frequency(midi, 'midi').toFrequency();

// The music of the Earth Jukebox pattern, identical for every event: a pad holding the chord
// the data picked, an arpeggio walking through it and a bass note on every beat. Chord changes
// land on the beat, so a change in the data is heard as the harmony moving.
// Each voice adds its own texture (wind, ocean, roar) under this layer.
export class HarmonyLayer {
  chord = null;
  sounding = null;
  rate = '8n';
  step = 0;
  playing = false;
  onBeat = null;

  constructor(destination) {
    this.output = new Tone.Gain(1).connect(destination);

    this.pad = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'fattriangle', count: 3, spread: 18 },
      envelope: { attack: 1.2, decay: 0.5, sustain: 0.8, release: 2.5 },
    }).connect(this.output);
    this.pad.volume.value = -18;

    this.arp = new Tone.FMSynth({
      harmonicity: 2,
      modulationIndex: 3,
      envelope: { attack: 0.005, decay: 0.35, sustain: 0.05, release: 0.6 },
      modulationEnvelope: { attack: 0.005, decay: 0.2, sustain: 0 },
    }).connect(this.output);
    this.arp.volume.value = -17;

    this.bass = new Tone.MembraneSynth({
      pitchDecay: 0.03,
      octaves: 2,
      envelope: { attack: 0.002, decay: 0.45, sustain: 0 },
    }).connect(this.output);
    this.bass.volume.value = -16;

    // Up through the chord over two octaves, then back to the bottom.
    this.arpLoop = new Tone.Loop((time) => {
      if (!this.chord) return;
      const notes = [...this.chord, ...this.chord.map((m) => m + 12)];
      this.arp.triggerAttackRelease(toHz(notes[this.step % notes.length]), '16n', time);
      this.step += 1;
    }, '8n');

    // Every beat: change the pad if the data asked for another chord (once, on the beat), then
    // play the bass on the chord's root.
    this.beatLoop = new Tone.Loop((time) => {
      if (!this.chord) return;
      if (this.chord !== this.sounding) {
        this.pad.releaseAll(time);
        this.#attack(time + 0.02);
      }
      this.bass.triggerAttackRelease(toHz(this.chord[0] - 24), '8n', time);
      if (this.onBeat) setTimeout(this.onBeat, Math.max(0, (time - Tone.getContext().currentTime) * 1000));
    }, '4n');
  }

  start() {
    this.playing = true;
    this.arpLoop.start(0);
    this.beatLoop.start(0);
    const transport = Tone.getTransport();
    if (transport.state !== 'started') transport.start();
    this.sounding = null;
  }

  stop() {
    this.playing = false;
    this.arpLoop.stop();
    this.beatLoop.stop();
    this.pad.releaseAll();
    this.sounding = null;
  }

  // From SensoryMapper (jukebox): chord (MIDI notes), arpRate ('4n'/'8n'/'16n') and bpm.
  set({ chord, arpRate, bpm }, ramp = 0.4) {
    if (bpm != null) Tone.getTransport().bpm.rampTo(bpm, ramp);
    // Only when the figure changes: resetting the loop on every frame would chop the arpeggio.
    if (arpRate && arpRate !== this.rate) {
      this.rate = arpRate;
      this.arpLoop.interval = arpRate;
    }
    // Kept as the same array while the notes are the same, so the beat sees no change.
    if (chord && chord.join(',') !== this.chord?.join(',')) this.chord = chord;
  }

  dispose() {
    [this.arpLoop, this.beatLoop, this.pad, this.arp, this.bass, this.output].forEach((n) => n.dispose());
  }

  #attack(time) {
    this.sounding = this.chord;
    this.pad.triggerAttack(this.chord.map((m) => toHz(m - 12)), time);
  }
}
