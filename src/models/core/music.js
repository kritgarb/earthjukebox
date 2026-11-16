// Music theory for the sonifications: data picks a degree of a scale instead of a raw frequency,
// so what plays is made of notes and chords. Pure functions, no audio.
import { clamp } from './math.js';

// Semitones above the root for each scale.
export const SCALES = {
  minor: [0, 2, 3, 5, 7, 8, 10], // natural minor (aeolian)
  // The minor mode of the Brazilian Northeast (baião, xote): natural minor with a raised sixth.
  dorian: [0, 2, 3, 5, 7, 9, 10],
};

const NAMES = ['Dó', 'Dó#', 'Ré', 'Ré#', 'Mi', 'Fá', 'Fá#', 'Sol', 'Sol#', 'Lá', 'Lá#', 'Si'];

export const midiToHz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

// Brazilian solfège with the scientific octave number (Dó4 = middle C).
export const noteName = (midi) => `${NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;

// MIDI note of a scale degree; degrees past the scale's length climb into the next octaves.
export function degreeToMidi(degree, scale, rootMidi) {
  const n = scale.length;
  const octave = Math.floor(degree / n);
  return rootMidi + octave * 12 + scale[((degree % n) + n) % n];
}

// A value 0..1 picks one of `steps` degrees (0 = lowest).
export const degreeOf = (t, steps) => Math.round(clamp(t) * (steps - 1));

// Chord built on a degree by stacking every other note of the scale (a triad, plus a seventh).
export function chordOf(degree, scale, rootMidi, size = 3) {
  return Array.from({ length: size }, (_, i) => degreeToMidi(degree + i * 2, scale, rootMidi));
}

// Everything a voice needs for one moment: the note, its chord and how to show it.
export function harmony(t, { scale, rootMidi, steps, chordSize = 3 }) {
  const degree = degreeOf(t, steps);
  const midi = degreeToMidi(degree, scale, rootMidi);
  return {
    degree,
    midi,
    pitchHz: midiToHz(midi),
    note: noteName(midi),
    chord: chordOf(degree, scale, rootMidi, chordSize),
  };
}

// ---------------------------------------------------------------- The Earth Jukebox pattern
// One musical rule for every event, so a listener learns it once and can read any phenomenon:
// the same key (A minor, A2 to A4), the more intense the event the higher the note and chord,
// the faster it changes the faster the music.
export const JUKEBOX = { key: 'Lá menor', scale: SCALES.minor, rootMidi: 45, steps: 15 };

// level 0..1: how intense the event is now. speed 0..1: how fast it is changing.
// `tune` lets an accent (core/sotaque.js) swap the mode or the chord size; the rule stays the same.
export function jukebox(level, speed, { key = JUKEBOX, chordSize = 3 } = {}) {
  const s = clamp(speed);
  return {
    ...harmony(level, { ...key, chordSize }),
    keyName: key.key,
    // Named apart from a voice's own `level` (its output volume).
    noteLevel: clamp(level),
    speed: s,
    bpm: 60 + s * 90,
    arpRate: s < 0.33 ? '4n' : s < 0.66 ? '8n' : '16n',
  };
}
