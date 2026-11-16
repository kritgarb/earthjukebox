import * as Tone from 'tone';
import { activeLayers } from '../../../models/core/sotaque.js';
import { degreeToMidi } from '../../../models/core/music.js';

const toHz = (midi) => Tone.Frequency(midi, 'midi').toFrequency();
// The same note folded into the drum register (55 to 104 Hz), audible on small speakers.
const low = (midi) => 33 + (((midi - 33) % 12) + 12) % 12;

// The Earth Jukebox music with a Brazilian accent: same chord, same tempo, same rule as
// HarmonyLayer, played by a synthesized baião trio, bossa nova group or maracatu nation
// (core/sotaque.js). Nothing is sampled: every drum, bell and reed is built from oscillators and
// noise, so the band is generated from the data like everything else.
// The song comes first: a warm pad holds the chord, a melody sings a phrase of the style in the
// scale, and the percussion sits behind them. Instruments enter one by one as the intensity
// crosses the style's thresholds.
export class BrazilLayer {
  chord = null;
  sounding = null;
  degree = 0;
  rate = '8n';
  level = 0;
  step = 0;
  leadStep = 0;
  playing = false;
  onBeat = null;
  #nodes = [];
  #active = new Set();
  #held = false;
  #accompany = true;

  // `wet` is the voice's reverb (melody and chords); `dry` skips it so the drums stay tight.
  constructor(wet, dry, style) {
    this.style = style;
    this.tonal = this.#keep(new Tone.Gain(1).connect(wet));
    this.perc = this.#keep(new Tone.Gain(0.8).connect(dry));
    // Some of the room on the drums, so they sit in the same space as the rest.
    this.perc.connect(this.#keep(new Tone.Gain(0.22).connect(wet)));

    // The bed of every style: the chord held softly, so there is always harmony under the rhythm.
    const padFilter = this.#keep(new Tone.Filter({ type: 'lowpass', frequency: 1100, rolloff: -12 }).connect(this.tonal));
    this.pad = this.#keep(
      new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'fattriangle', count: 3, spread: 16 },
        envelope: { attack: 0.9, decay: 0.5, sustain: 0.85, release: 2.2 },
      }).connect(padFilter),
    );
    this.pad.volume.value = -19;

    this.kit = KITS[style.id](this);

    this.loop = new Tone.Loop((time) => this.#tick(time), '16n');
    this.leadLoop = new Tone.Loop((time) => this.#lead(time), '8n');
  }

  start() {
    this.playing = true;
    this.step = 0;
    this.leadStep = 0;
    this.loop.start(0);
    this.leadLoop.start(0);
    const transport = Tone.getTransport();
    if (transport.state !== 'started') transport.start();
    this.sounding = null;
    this.#held = false;
  }

  stop() {
    this.playing = false;
    this.loop.stop();
    this.leadLoop.stop();
    this.pad.releaseAll();
    this.kit.release?.();
    this.sounding = null;
    this.#held = false;
  }

  // Same contract as HarmonyLayer.set, plus the scale degree (for the melody) and noteLevel (the
  // intensity that brings instruments in).
  set({ chord, degree, arpRate, bpm, noteLevel }, ramp = 0.4) {
    if (bpm != null) Tone.getTransport().bpm.rampTo(bpm, ramp);
    if (arpRate && arpRate !== this.rate) {
      this.rate = arpRate;
      this.leadLoop.interval = arpRate;
    }
    if (chord && chord.join(',') !== this.chord?.join(',')) this.chord = chord;
    if (degree != null) this.degree = degree;
    if (noteLevel != null && noteLevel !== this.level) {
      this.level = noteLevel;
      this.#active = new Set(activeLayers(this.style, noteLevel).map((l) => l.id));
    }
  }

  // While a recorded track plays under the event, the band's rhythm section (drums and the
  // instruments that comp the chords) steps aside. What the data plays stays: the pad that holds
  // the chord and the tune that climbs and falls with the intensity.
  setAccompaniment(on) {
    if (on === this.#accompany) return;
    this.#accompany = on;
    if (!on) this.kit.release?.();
  }

  dispose() {
    this.loop.dispose();
    this.leadLoop.dispose();
    this.#nodes.forEach((n) => n.dispose());
  }

  on(id) {
    return this.#active.has(id);
  }

  // Registers a node for disposal and returns it.
  make(node) {
    return this.#keep(node);
  }

  #keep(node) {
    this.#nodes.push(node);
    return node;
  }

  #tick(time) {
    if (!this.chord) return;
    const s = this.step % 16;
    this.step += 1;
    // Chords move on the beat, so a change in the data is heard as the harmony moving.
    if (s % 4 === 0 && (this.chord !== this.sounding || !this.#held)) {
      this.sounding = this.chord;
      this.soundingDegree = this.degree;
      this.pad.releaseAll(time);
      this.pad.triggerAttack(this.chord.slice(0, 3).map((m) => toHz(m - 12)), time + 0.02);
      this.#held = true;
    }
    if (this.#accompany) this.kit.tick(s, time, this.sounding ?? this.chord);
    if (s % 4 === 0 && this.onBeat) setTimeout(this.onBeat, Math.max(0, (time - Tone.getContext().currentTime) * 1000));
  }

  // The melody: a phrase of the style, written in steps of the scale above the chord's root, so
  // it climbs and falls with the data while staying a tune. Rests let it breathe.
  #lead(time) {
    if (!this.sounding) return;
    const phrase = this.style.phrase;
    const i = this.leadStep % phrase.length;
    this.leadStep += 1;
    const step = phrase[i];
    if (step == null) return;
    // A note followed by a rest is held through it.
    const beats = phrase[(i + 1) % phrase.length] == null ? 1.9 : 0.95;
    const { scale, rootMidi } = this.style.key;
    const midi = degreeToMidi((this.soundingDegree ?? this.degree) + step, scale, rootMidi);
    this.kit.lead(midi, time, Tone.Time(this.rate).toSeconds() * beats);
  }
}

// ---------------------------------------------------------------- instrument builders
// Percussion is built soft on purpose: slower attacks and lower, rounder bands than a real kit,
// so the rhythm is felt as a pulse under the song instead of a string of clicks.
const hit = (layer, dest, { type = 'pink', filter, decay, volume }) => {
  const f = layer.make(new Tone.Filter(filter).connect(dest));
  const synth = layer.make(new Tone.NoiseSynth({ noise: { type }, envelope: { attack: 0.004, decay, sustain: 0, release: 0.04 } }).connect(f));
  synth.volume.value = volume;
  return synth;
};

const drum = (layer, dest, { pitchDecay, octaves, decay, volume }) => {
  const synth = layer.make(
    new Tone.MembraneSynth({ pitchDecay, octaves, oscillator: { type: 'sine' }, envelope: { attack: 0.006, decay, sustain: 0, release: 0.08 } }).connect(dest),
  );
  synth.volume.value = volume;
  return synth;
};

// Struck metal (triangle, agogô, gonguê) as a small bell: two sine partials, no harsh overtones.
const bell = (layer, dest, { harmonicity, decay, volume }) => {
  const synth = layer.make(
    new Tone.FMSynth({
      harmonicity,
      modulationIndex: 2.5,
      envelope: { attack: 0.003, decay, sustain: 0, release: decay },
      modulationEnvelope: { attack: 0.002, decay: decay * 0.5, sustain: 0 },
    }).connect(dest),
  );
  synth.volume.value = volume;
  return synth;
};

const poly = (layer, dest, { oscillator, envelope, cutoff, volume }) => {
  const f = layer.make(new Tone.Filter({ type: 'lowpass', frequency: cutoff, rolloff: -12 }).connect(dest));
  const synth = layer.make(new Tone.PolySynth(Tone.Synth, { oscillator, envelope }).connect(f));
  synth.volume.value = volume;
  return synth;
};

// A singing voice: a little vibrato and a short glide between notes.
const mono = (layer, dest, { oscillator, envelope, cutoff, volume, glide = 0.03 }) => {
  const f = layer.make(new Tone.Filter({ type: 'lowpass', frequency: cutoff, rolloff: -12 }).connect(dest));
  const vibrato = layer.make(new Tone.Vibrato({ frequency: 5, depth: 0.06 }).connect(f));
  const synth = layer.make(new Tone.Synth({ oscillator, envelope, portamento: glide }).connect(vibrato));
  synth.volume.value = volume;
  return synth;
};

// Small human variation in how hard each note is played.
const vel = (v) => Math.min(1, v * (0.88 + Math.random() * 0.24));

// ---------------------------------------------------------------- the three bands
const KITS = {
  // Baião trio: sanfona in front, zabumba (low skin + the thin "bacalhau" stick) and triangle.
  baiao(L) {
    const p = L.style.patterns;
    const zabumba = drum(L, L.perc, { pitchDecay: 0.03, octaves: 2, decay: 0.34, volume: -11 });
    const bacalhau = hit(L, L.perc, { filter: { type: 'bandpass', frequency: 1500, Q: 1.2 }, decay: 0.05, volume: -27 });
    const triangulo = bell(L, L.perc, { harmonicity: 3.4, decay: 0.09, volume: -32 });
    const agogo = bell(L, L.perc, { harmonicity: 2.4, decay: 0.16, volume: -27 });
    const caixa = hit(L, L.perc, { filter: { type: 'bandpass', frequency: 2000, Q: 0.7 }, decay: 0.06, volume: -31 });
    // Two slightly detuned reeds per note is what makes an accordion sound like one.
    const reed = { type: 'fatsawtooth', count: 2, spread: 16 };
    const fole = poly(L, L.tonal, { oscillator: reed, envelope: { attack: 0.03, decay: 0.2, sustain: 0.6, release: 0.25 }, cutoff: 1700, volume: -21 });
    const sanfona = mono(L, L.tonal, { oscillator: reed, envelope: { attack: 0.03, decay: 0.2, sustain: 0.7, release: 0.25 }, cutoff: 2400, volume: -12 });
    return {
      tick(s, time, chord) {
        if (L.on('triangulo') && p.triangulo[s]) {
          const open = p.trianguloOpen.includes(s);
          triangulo.triggerAttackRelease(open ? 2093 : 2349, open ? 0.12 : 0.04, time, vel(p.triangulo[s]));
        }
        if (L.on('zabumba') && p.zabumba[s]) zabumba.triggerAttackRelease(toHz(low(chord[0])), 0.3, time, vel(p.zabumba[s]));
        if (L.on('bacalhau') && p.bacalhau[s]) bacalhau.triggerAttackRelease(0.04, time, vel(p.bacalhau[s]));
        if (L.on('fole') && p.fole[s]) fole.triggerAttackRelease(chord.map((m) => toHz(m)), '8n', time, vel(p.fole[s]));
        if (L.on('agogo') && p.agogo[s]) agogo.triggerAttackRelease(toHz(chord[p.agogoHigh.includes(s) ? 2 : 0] + 24), 0.14, time, vel(p.agogo[s]));
        if (L.on('caixa') && p.caixa[s]) caixa.triggerAttackRelease(0.05, time, vel(p.caixa[s]));
      },
      lead(midi, time, seconds) {
        if (L.on('sanfona')) sanfona.triggerAttackRelease(toHz(midi + 12), seconds, time, vel(0.8));
      },
      release: () => fole.releaseAll(),
    };
  },

  // Bossa nova: nylon guitar on the bossa clave, a soft bass under the thumb, ganzá, rim, flute.
  bossa(L) {
    const p = L.style.patterns;
    const pluck = { attack: 0.006, decay: 1.3, sustain: 0, release: 0.6 };
    const violao = poly(L, L.tonal, { oscillator: { type: 'triangle' }, envelope: pluck, cutoff: 1700, volume: -11 });
    const baixo = poly(L, L.tonal, { oscillator: { type: 'sine' }, envelope: { attack: 0.015, decay: 0.6, sustain: 0.2, release: 0.3 }, cutoff: 500, volume: -12 });
    const ganza = hit(L, L.perc, { type: 'white', filter: { type: 'bandpass', frequency: 4200, Q: 0.8 }, decay: 0.05, volume: -34 });
    const aro = bell(L, L.perc, { harmonicity: 1.5, decay: 0.05, volume: -27 });
    const flauta = mono(L, L.tonal, { oscillator: { type: 'sine' }, envelope: { attack: 0.07, decay: 0.2, sustain: 0.75, release: 0.5 }, cutoff: 3000, volume: -14, glide: 0.05 });
    return {
      tick(s, time, chord) {
        // Fingers play the upper notes of the seventh chord; the thumb keeps root and fifth.
        if (L.on('violao') && p.violao[s]) violao.triggerAttackRelease(chord.slice(1).map((m) => toHz(m)), '8n', time, vel(p.violao[s]));
        if (p.baixo[s]) {
          const midi = p.baixoFifth.includes(s) ? chord[2] : chord[0];
          if (L.on('baixo')) baixo.triggerAttackRelease(toHz(low(midi)), '8n', time, vel(p.baixo[s]));
          else if (L.on('violao')) violao.triggerAttackRelease(toHz(midi - 12), '8n', time, vel(p.baixo[s] * 0.8));
        }
        if (L.on('ganza') && p.ganza[s]) ganza.triggerAttackRelease(0.04, time, vel(p.ganza[s]));
        if (L.on('aro') && p.aro[s]) aro.triggerAttackRelease(880, 0.04, time, vel(p.aro[s]));
      },
      lead(midi, time, seconds) {
        // Before the flute arrives the guitar picks the tune itself, softly.
        if (L.on('flauta')) flauta.triggerAttackRelease(toHz(midi + 12), seconds, time, vel(0.7));
        else violao.triggerAttackRelease(toHz(midi + 12), seconds, time, vel(0.45));
      },
      release: () => violao.releaseAll(),
    };
  },

  // Maracatu de baque virado: gonguê, alfaias, caixa, agbê, and brass on top.
  maracatu(L) {
    const p = L.style.patterns;
    const alfaia = drum(L, L.perc, { pitchDecay: 0.05, octaves: 2, decay: 0.6, volume: -10 });
    const gongue = bell(L, L.perc, { harmonicity: 1.41, decay: 0.22, volume: -24 });
    const caixa = hit(L, L.perc, { filter: { type: 'bandpass', frequency: 1900, Q: 0.6 }, decay: 0.07, volume: -30 });
    const agbe = hit(L, L.perc, { filter: { type: 'bandpass', frequency: 3200, Q: 0.7 }, decay: 0.09, volume: -31 });
    const brass = { type: 'fatsawtooth', count: 3, spread: 10 };
    const metais = mono(L, L.tonal, { oscillator: brass, envelope: { attack: 0.04, decay: 0.25, sustain: 0.6, release: 0.3 }, cutoff: 1500, volume: -13 });
    // Before the brass arrives a soft low voice hums the tune.
    const voz = mono(L, L.tonal, { oscillator: { type: 'triangle' }, envelope: { attack: 0.08, decay: 0.3, sustain: 0.6, release: 0.5 }, cutoff: 1200, volume: -17, glide: 0.06 });
    return {
      tick(s, time, chord) {
        // The bell rings on notes of the chord, so even the timekeeper is in the harmony.
        if (L.on('gongue') && p.gongue[s]) gongue.triggerAttackRelease(toHz(chord[p.gongueHigh.includes(s) ? 2 : 0] + 12), 0.2, time, vel(p.gongue[s]));
        // Two alfaias on the chord's root: the low one takes the accents, the other sits an octave up.
        if (L.on('alfaia') && p.alfaia[s]) alfaia.triggerAttackRelease(toHz(low(chord[0]) + (p.alfaia[s] >= 0.9 ? 0 : 12)), 0.5, time, vel(p.alfaia[s]));
        if (L.on('caixa') && p.caixa[s]) caixa.triggerAttackRelease(0.06, time, vel(p.caixa[s]));
        if (L.on('agbe') && p.agbe[s]) agbe.triggerAttackRelease(0.08, time, vel(p.agbe[s]));
      },
      lead(midi, time, seconds) {
        if (L.on('metais')) metais.triggerAttackRelease(toHz(midi), seconds, time, vel(0.85));
        else voz.triggerAttackRelease(toHz(midi), seconds, time, vel(0.6));
      },
    };
  },

  // Samba: surdo on the second beat, pandeiro and tamborim on top, cavaquinho playing the chords
  // and the tune, agogô bells.
  samba(L) {
    const p = L.style.patterns;
    const surdo = drum(L, L.perc, { pitchDecay: 0.04, octaves: 2, decay: 0.45, volume: -10 });
    const pandeiro = hit(L, L.perc, { type: 'white', filter: { type: 'bandpass', frequency: 3000, Q: 0.8 }, decay: 0.05, volume: -33 });
    const tamborim = hit(L, L.perc, { filter: { type: 'bandpass', frequency: 3600, Q: 1 }, decay: 0.035, volume: -28 });
    const agogo = bell(L, L.perc, { harmonicity: 2.1, decay: 0.15, volume: -27 });
    const pluck = { attack: 0.004, decay: 0.5, sustain: 0, release: 0.3 };
    const cavaco = poly(L, L.tonal, { oscillator: { type: 'triangle' }, envelope: pluck, cutoff: 3400, volume: -14 });
    // Before the cavaquinho arrives a soft voice hums the tune.
    const voz = mono(L, L.tonal, { oscillator: { type: 'triangle' }, envelope: { attack: 0.08, decay: 0.3, sustain: 0.6, release: 0.5 }, cutoff: 1300, volume: -17, glide: 0.05 });
    return {
      tick(s, time, chord) {
        if (L.on('surdo') && p.surdo[s]) surdo.triggerAttackRelease(toHz(low(chord[0])), 0.4, time, vel(p.surdo[s]));
        if (L.on('pandeiro') && p.pandeiro[s]) pandeiro.triggerAttackRelease(0.04, time, vel(p.pandeiro[s]));
        if (L.on('tamborim') && p.tamborim[s]) tamborim.triggerAttackRelease(0.04, time, vel(p.tamborim[s]));
        if (L.on('cavaquinho') && p.cavaquinho[s]) cavaco.triggerAttackRelease(chord.map((m) => toHz(m + 12)), '16n', time, vel(p.cavaquinho[s]));
        if (L.on('agogo') && p.agogo[s]) agogo.triggerAttackRelease(toHz(chord[p.agogoHigh.includes(s) ? 2 : 0] + 24), 0.14, time, vel(p.agogo[s]));
      },
      lead(midi, time, seconds) {
        if (L.on('cavaquinho')) cavaco.triggerAttackRelease(toHz(midi + 12), Math.min(seconds, 0.5), time, vel(0.85));
        else voz.triggerAttackRelease(toHz(midi + 12), seconds, time, vel(0.6));
      },
      release: () => cavaco.releaseAll(),
    };
  },
};
