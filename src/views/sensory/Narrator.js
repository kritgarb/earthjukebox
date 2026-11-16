// Voice narration. Phrases are read by ElevenLabs through the /api/tts proxy (the key lives on
// the server); if the proxy is down or unconfigured, the browser's own voice takes over so the
// narration never goes silent. Phrases play in order: each one is fetched as soon as it is said
// (so the audio is ready by its turn) but starts only after the previous one has ended.

const RETRY_AFTER_FAILURE_MS = 60_000;

export class Narrator {
  constructor() {
    this.chain = Promise.resolve();
    this.generation = 0;
    this.audio = null;
    this.downUntil = 0;
    this.controller = new AbortController();
  }

  // `replace`: drop what is still waiting or being said first, so the voice stays with the story
  // instead of falling behind it.
  say(text, { lang, volume, replace = false }) {
    if (replace) this.cancel();
    const gen = this.generation;
    const audioBlob = this.#fetch(text, lang);
    this.chain = this.chain.then(async () => {
      if (gen !== this.generation) return;
      const blob = await audioBlob;
      if (gen !== this.generation) return;
      if (!blob || !(await this.#play(blob, volume, gen))) await this.#fallback(text, lang, volume, gen);
    });
    return this.chain; // settles when this phrase has been spoken (or dropped by cancel())
  }

  cancel() {
    this.generation++;
    this.controller.abort();
    this.controller = new AbortController();
    this.audio?.pause();
    this.audio = null;
    // The phrase being played will never end by itself: settle it so nothing keeps waiting on it.
    this.endCurrent?.();
    this.chain = Promise.resolve();
    window.speechSynthesis?.cancel();
  }

  // Pauses/resumes whatever is speaking right now; queued phrases wait behind it.
  pause() {
    this.paused = true;
    this.audio?.pause();
    if (window.speechSynthesis?.speaking) speechSynthesis.pause();
  }

  resume() {
    this.paused = false;
    this.audio?.play().catch(() => {});
    if (window.speechSynthesis?.paused) speechSynthesis.resume();
  }

  async #fetch(text, lang) {
    if (Date.now() < this.downUntil) return null;
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, lang: lang.slice(0, 2) }),
        signal: this.controller.signal,
      });
      if (!res.ok) throw new Error(String(res.status));
      return await res.blob();
    } catch (err) {
      if (err.name !== "AbortError") this.downUntil = Date.now() + RETRY_AFTER_FAILURE_MS;
      return null;
    }
  }

  // Resolves true when played to the end, false if the browser refused to play it.
  #play(blob, volume, gen) {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.volume = volume;
      this.audio = audio;
      const done = (ok) => {
        URL.revokeObjectURL(url);
        if (this.audio === audio) this.audio = null;
        resolve(ok || gen !== this.generation);
      };
      this.endCurrent = () => done(true);
      audio.onended = () => done(true);
      audio.onerror = () => done(false);
      if (!this.paused) audio.play().catch(() => done(false));
    });
  }

  #fallback(text, lang, volume, gen) {
    return new Promise((resolve) => {
      if (!("speechSynthesis" in window) || gen !== this.generation) return resolve();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang;
      u.rate = 1.05;
      u.volume = volume;
      u.onend = u.onerror = () => resolve();
      speechSynthesis.speak(u);
    });
  }
}
