import { HarmonyLayer } from './HarmonyLayer.js';
import { BrazilLayer } from './BrazilLayer.js';

// The music of a voice: the universal synthesizer trio, or a Brazilian band when a style from
// core/sotaque.js is given. Both answer start(), stop(), set(sound) and onBeat.
export function createMusic(style, wet, dry) {
  return style ? new BrazilLayer(wet, dry, style) : new HarmonyLayer(wet);
}

// Changes the accent of a voice while it plays: the old band stops, the new one comes in on the
// same chord and tempo.
export function swapMusic(voice, style, wet, dry) {
  const old = voice.music;
  const next = createMusic(style, wet, dry);
  next.onBeat = old.onBeat;
  old.stop();
  // Let the tails ring out before freeing the old instruments.
  setTimeout(() => old.dispose(), 4000);
  voice.music = next;
  if (old.playing) next.start();
  return next;
}
