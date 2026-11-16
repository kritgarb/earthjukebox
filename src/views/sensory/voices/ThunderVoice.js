import * as Tone from 'tone';

const toHz = (midi) => Tone.Frequency(midi, 'midi').toFrequency();

// Lightning as music: a bell on a note of the current chord and a soft low drum on its root,
// placed on the next eighth note so every strike lands in time with the band. (It used to be a
// crack of noise and a rumble; an accent that belongs to the harmony reads as part of the song.)
export class ThunderVoice {
  constructor(destination) {
    this.output = new Tone.Gain(0.9).connect(destination);
    this.reverb = new Tone.Reverb({ decay: 4, wet: 0.45 }).connect(this.output);

    this.bell = new Tone.FMSynth({
      harmonicity: 3.01,
      modulationIndex: 6,
      envelope: { attack: 0.004, decay: 1.4, sustain: 0, release: 1.2 },
      modulationEnvelope: { attack: 0.002, decay: 0.5, sustain: 0 },
    }).connect(this.reverb);
    this.bell.volume.value = -22;

    this.drum = new Tone.MembraneSynth({
      pitchDecay: 0.04,
      octaves: 1.5,
      envelope: { attack: 0.012, decay: 1.1, sustain: 0, release: 0.4 },
    }).connect(this.reverb);
    this.drum.volume.value = -16;
  }

  // power 0..1; distance 0..1 makes a farther strike softer; chord: MIDI notes sounding now.
  strike(power = 1, distance = 0.3, chord = [57, 60, 64]) {
    const time = Tone.getTransport().state === 'started' ? Tone.getTransport().nextSubdivision('8n') : Tone.now();
    const near = 1 - distance * 0.6;
    const note = chord[Math.floor(Math.random() * chord.length)] + 24;
    this.bell.triggerAttackRelease(toHz(note), 1.2, time, (0.35 + power * 0.45) * near);
    this.drum.triggerAttackRelease(toHz(33 + ((chord[0] - 33) % 12)), 0.9, time, (0.3 + power * 0.4) * near);
  }
}
