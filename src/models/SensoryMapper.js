// Pure data -> sensory parameter mappings. No DOM, no audio nodes: views consume the output.
// Every event follows the same musical pattern (core/music.js, jukebox): one key, the more
// intense the event the higher the note and chord, the faster it changes the faster the music.
// What differs per event is only the texture under the music and the accents on top of it.
import { clamp, expMap, lerp, norm } from './core/math.js';
import { jukebox } from './core/music.js';

// Hurricane: intensity and speed are both the sustained wind (35 kt -> lowest note, 155 kt -> highest).
export function hurricaneToSound({ kts, lon }, lonRange = [-88, -83], tune) {
  const intensity = norm(kts, 15, 140);
  return {
    ...jukebox(norm(kts, 35, 155), intensity, tune),
    intensity,
    // Textures are a quiet bed far under the music: a breath of wind, never a roar, no distortion.
    windDb: lerp(-56, -33, intensity * intensity),
    brightnessHz: expMap(intensity, 500, 2400),
    detuneCents: lerp(4, 16, intensity),
    drive: 0,
    pan: lerp(-1, 1, norm(lon, lonRange[0], lonRange[1])),
    rainDb: intensity < 0.35 ? -80 : lerp(-60, -46, norm(intensity, 0.35, 1)),
    reverbWet: 0.3,
    // Eyewall lightning becomes more frequent as the storm strengthens (none below tropical storm).
    lightningPerMinute: kts < 34 ? 0 : lerp(2, 40, norm(kts, 34, 140)),
  };
}

// Visual rules: a clear eye only exists at hurricane strength and sharpens as the storm deepens.
export function hurricaneToVisual({ kts }) {
  return { eyeStrength: norm(kts, 64, 105) };
}

// Inside the eye the air is nearly calm: wind and rain drop, the pulse keeps going.
export function insideEye(sound) {
  return {
    ...sound,
    windDb: sound.windDb - 16,
    rainDb: -80,
    brightnessHz: sound.brightnessHz * 0.45,
    reverbWet: 0.6,
  };
}

// Vibration pattern (ms on/off). Stronger = more, longer and closer pulses.
export function intensityToVibration(intensity) {
  const i = clamp(intensity);
  if (i < 0.04) return [];
  const pulses = Math.round(lerp(1, 5, i));
  const on = Math.round(lerp(35, 190, i));
  const off = Math.round(lerp(230, 45, i));
  return Array.from({ length: pulses * 2 - 1 }, (_, k) => (k % 2 === 0 ? on : off));
}

// A lightning strike: a single short pulse, stronger for stronger storms.
export function lightningToVibration(intensity) {
  return [Math.round(lerp(30, 90, clamp(intensity)))];
}

// ---------------------------------------------------------------- Hunga Tonga
// Intensity is the umbrella's diameter (measured from the frames), speed is how fast it grows.
// The roar in the texture follows the growth; the space around the sound opens as it widens.
// The cold core adds an icy shimmer.
export function eruptionToSound({ diameterKm, expansionKmMin, coreIndex, erupted }, tune) {
  const energy = erupted ? norm(expansionKmMin, 0, 6) : 0;
  const spread = norm(diameterKm, 0, 750);
  return {
    ...jukebox(spread, energy, tune),
    energy,
    spread,
    erupted,
    intensity: Math.max(energy, spread * 0.4),
    roarDb: erupted ? lerp(-58, -34, energy) : -80,
    roarHz: expMap(energy, 110, 520),
    droneDb: erupted ? lerp(-30, -17, spread) : -60,
    reverbWet: lerp(0.2, 0.6, spread),
    shimmerDb: lerp(-62, -20, norm(coreIndex, 0, 0.4)),
    // Illustrative: the eruption set lightning records, but no flash data is loaded here.
    lightningPerMinute: lerp(0, 45, energy),
  };
}

// The explosion itself: a long rumble that fades out.
export function explosionToVibration() {
  return [600, 60, 380, 60, 220, 80, 120];
}

// ---------------------------------------------------------------- Night lights (EIC)
// Intensity is how much of the world is lit (share of lit pixels, 2012 = lowest note, 2023 =
// highest). Speed is how fast that share is changing from one year to the next, so the music
// quickens when the lights grow quickly (2021 to 2022) and slows when they stall (2019 to 2020).
// Once the change map appears the pitch stays at the 2023 level and the sweep plays what changed:
// brighter places as high bells, dimmer places as low notes.
export function nightLightsToSound({ litLevel, stepPerYear, moreShare, lessShare, changeMix }, maxStep, tune) {
  const pace = norm(Math.abs(stepPerYear), 0, maxStep);
  // Under the change map the music keeps the tempo of the fastest year: the change is the story.
  const speed = Math.max(pace, changeMix * 0.85);
  return {
    ...jukebox(litLevel, speed, tune),
    litLevel,
    shimmerDb: lerp(-62, -30, litLevel),
    droneDb: lerp(-36, -22, litLevel),
    reverbWet: lerp(0.3, 0.5, litLevel),
    // How the sweep plays: chance that a lit column rings, and the colour of the change map.
    brightness: lerp(0.35, 1, litLevel),
    moreShare,
    lessShare,
    changeMix,
  };
}

// The EIC frame experiences (lightning, CO2, forest height, aerosols): the measured level picks
// the note and the chord; how fast that level is changing picks the tempo. The sweep then rings a
// bell for every column of the frame that holds something to hear.
export function framesToSound({ level, stepPerUnit }, maxStep, tune) {
  const pace = norm(Math.abs(stepPerUnit), 0, maxStep);
  return {
    ...jukebox(level, pace, tune),
    level,
    shimmerDb: lerp(-62, -32, level),
    droneDb: lerp(-36, -22, level),
    reverbWet: lerp(0.3, 0.5, level),
    brightness: lerp(0.35, 1, level),
  };
}

// A new place lighting up: one short, bright tap. A place going dark: a slower, softer one.
export const lightsToVibration = (kind) => (kind === 'less' ? [90] : [24]);
