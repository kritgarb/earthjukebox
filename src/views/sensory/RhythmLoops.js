// The background music of an experience: recorded tracks (made in Suno) that play underneath the
// sound of the event. The listener picks one, or leaves it on "the phenomenon's own", which is the
// track of the band that is playing (the baião track under the hurricane, the maracatu under the
// volcano). Files sit in public/audio/rhythms/ and are listed in manifest.json:
//
//   { "baiao": { "file": "baiao.m4a", "name": "Baião", "bpm": 99, "band": "baiao" } }
//
// - the key is the id of the track and `name` is what the selector shows;
// - `bpm`: the tempo of the file; or `beats`: how many quarter-note beats it holds (a short loop of
//   4 bars of 4/4 = 16), from which the tempo is worked out;
// - `band`: the accent band (baiao, maracatu, samba, bossa) this track accompanies when the choice
//   is left on automatic; a track without it plays only when picked;
// - `gain` (0..1, default 0.7): how loud the track sits under the event.
// While a track plays, the synthesized rhythm section of the band steps aside and the sounds the
// event generates (the chord and the tune that follow the data, the bells, the textures) play on top.
// A track whose file is missing or fails to load is ignored and the event plays as before.

const BASE = "/audio/rhythms/";
let manifest = null;
const checked = new Map();

function loadManifest() {
  manifest ??= fetch(`${BASE}manifest.json`)
    .then((res) =>
      res.ok && /json/.test(res.headers.get("content-type") ?? "")
        ? res.json()
        : {},
    )
    .catch(() => ({}));
  return manifest;
}

// The tracks the listener can choose from, in the order of the manifest: [{ id, name }].
export async function listTracks() {
  const all = await loadManifest();
  return Object.entries(all)
    .filter(([id, entry]) => !id.startsWith("_") && entry?.file)
    .map(([id, entry]) => ({
      id,
      name: entry.name ?? id,
      band: entry.band,
    }));
}

// The track that should play: `choice` is "none", a track id, or "auto" (the track of the band
// `bandId`). Resolves null when there is none: { id, url, gain, bpm?, beats? }.
export async function resolveTrack(choice, bandId) {
  if (choice === "none") return null;
  const all = await loadManifest();
  const picked =
    choice && choice !== "auto" && all[choice]?.file ? choice : null;
  const id =
    picked ??
    (bandId
      ? Object.keys(all).find((k) => all[k]?.band === bandId && all[k]?.file)
      : null);
  if (!id) return null;
  return { ...verified(id, all[id]), id };
}

function verified(id, entry) {
  // No HEAD request first: it only added a round trip before the track could start. A missing
  // file (or a page served in its place) fails to decode, and BackingTrack ignores the track.
  if (!checked.has(id)) {
    checked.set(id, {
      url: BASE + entry.file,
      gain: Math.min(1, Math.max(0, entry.gain ?? 0.7)),
      bpm: entry.bpm,
      beats: entry.beats,
    });
  }
  return checked.get(id);
}

// Warms the browser cache with the track that will be asked for, once the page has settled, so the
// first tap starts it at once. Nothing is decoded here.
export async function prefetchTrack(choice, bandId) {
  const entry = await resolveTrack(choice, bandId);
  if (entry) fetch(entry.url).catch(() => {});
}

// Tempo of the file in beats per minute, from `bpm` or from its length in beats.
export const loopBpm = (entry, seconds) =>
  entry.bpm ?? (entry.beats ? (entry.beats * 60) / seconds : 100);
