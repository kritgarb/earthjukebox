import * as Tone from "tone";
import { loopBpm } from "./RhythmLoops.js";

const BACKING_VOLUME = 0.2; // 20% of the current volume

// The recorded track under an event (see RhythmLoops.js). It goes straight to the page's audio bus,
// next to the voice of the event. It plays at its own speed and pitch, untouched: stretching music
// in real time smears it and burns CPU. Instead, the event's synthesized music takes the tempo of
// the recording (see `tempo`), so both keep time.
// Only the track that is playing stays decoded in memory (a decoded track is tens of MB).
export class BackingTrack {
  #player = null;
  #entry = null;
  #tempo = 100;
  #token = 0;
  #url = null;
  #loading = null;

  constructor(destination) {
    this.out = new Tone.Gain(0).connect(destination);
  }

  get playing() {
    return Boolean(this.#player);
  }

  // Beats per minute of the recording that is playing.
  get tempo() {
    return this.#tempo;
  }

  #load(url) {
    if (this.#url !== url) {
      this.#url = url;
      this.#loading = Tone.ToneAudioBuffer.fromUrl(url).catch((err) => {
        if (this.#url === url) this.#url = this.#loading = null;
        throw err;
      });
    }
    return this.#loading;
  }

  // Starts the track of this entry (a no-op if it is already the one playing). Resolves true when
  // it is sounding, false if the file could not be loaded or something else was asked meanwhile.
  async play(entry) {
    if (this.#entry?.url === entry.url && this.#player) {
      this.out.gain.rampTo(entry.gain * BACKING_VOLUME, 0.4);
      return true;
    }
    this.stop();
    const token = ++this.#token;
    let buffer;
    try {
      buffer = await this.#load(entry.url);
    } catch {
      return false;
    }
    if (token !== this.#token) return false;
    this.#entry = entry;
    this.#tempo = loopBpm(entry, buffer.duration);
    const transport = Tone.getTransport();
    // Before asking for the next bar, so it is counted at the tempo it will be heard at.
    transport.bpm.value = this.#tempo;
    const player = new Tone.Player({ url: buffer, loop: true, fadeIn: 0.05 }).connect(this.out);
    this.#player = player;
    // In step with the music: it comes in on the next bar of the transport when that is running.
    player.start(transport.state === "started" ? transport.nextSubdivision("1m") : Tone.now());
    this.out.gain.rampTo(entry.gain * BACKING_VOLUME, 1.2);
    return true;
  }

  stop() {
    this.#token++;
    const player = this.#player;
    this.#player = null;
    this.#entry = null;
    if (!player) return;
    this.out.gain.rampTo(0, 0.4);
    setTimeout(() => {
      try {
        player.stop();
      } catch {
        /* it was not playing */
      }
      player.dispose();
    }, 500);
  }
}
