// Every API call returns the same metadata shape so views can show what was requested.
// source: 'live' (API answered) | 'snapshot' (local copy of a previous real response)
// `?local` in the page address skips the network and goes straight to the local copies: a demo
// on a bad connection starts at once instead of waiting for each request to time out.
// The choice lasts for the browser tab, so it follows the links between the pages.
const LOCAL_ONLY = (() => {
  try {
    if (new URLSearchParams(location.search).has('local')) sessionStorage.setItem('earth-jukebox:local', '1');
    return sessionStorage.getItem('earth-jukebox:local') === '1';
  } catch {
    return false;
  }
})();
// Data saver or a 2G link: the live answer would not arrive in a useful time, so the local copy
// (the same real data, labelled as a snapshot) is used at once.
const slowLink = () => {
  const c = navigator.connection;
  return Boolean(c && (c.saveData || ['slow-2g', '2g'].includes(c.effectiveType)));
};
// Whether live requests are being made at all (see above).
export const liveAllowed = () => !(LOCAL_ONLY || slowLink());
const skipLive = (fallback) => ((LOCAL_ONLY || slowLink()) && fallback ? Promise.reject(new Error(LOCAL_ONLY ? 'modo local' : 'conexão lenta')) : null);

// How long the live answer may take when a local copy exists. A request that hangs used to hold
// the whole experience for 15 to 25 s before the copy was even asked for.
const LIVE_JSON_BUDGET = 8000;
const LIVE_IMAGE_BUDGET = 10000;

export async function fetchJSON(url, { fallback, timeout = 15000 } = {}) {
  if (fallback) timeout = Math.min(timeout, LIVE_JSON_BUDGET);
  const t0 = performance.now();
  try {
    await skipLive(fallback);
    const res = await fetch(url, { signal: AbortSignal.timeout(timeout) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return { url, data, source: 'live', status: `HTTP ${res.status}`, ms: elapsed(t0) };
  } catch (err) {
    if (!fallback) throw Object.assign(err, { url, ms: elapsed(t0) });
    const data = await (await fetch(fallback)).json();
    return { url, data, source: 'snapshot', status: reason(err), fallback, ms: elapsed(t0) };
  }
}

export function fetchImage(url, { fallback, timeout = 25000 } = {}) {
  if (fallback) timeout = Math.min(timeout, LIVE_IMAGE_BUDGET);
  const t0 = performance.now();
  return (skipLive(fallback) ?? loadImage(url, timeout))
    .then((img) => ({ url, img, source: 'live', status: `${img.naturalWidth}×${img.naturalHeight} px`, ms: elapsed(t0) }))
    .catch((err) => {
      if (!fallback) throw err;
      return loadImage(fallback, timeout).then((img) => ({
        url, img, source: 'snapshot', status: reason(err), fallback, ms: elapsed(t0),
      }));
    });
}

function loadImage(src, timeout) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const timer = setTimeout(() => {
      img.src = '';
      reject(new Error('tempo esgotado'));
    }, timeout);
    img.onload = () => {
      clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timer);
      reject(new Error('imagem indisponível'));
    };
    img.src = src;
  });
}

const elapsed = (t0) => Math.round(performance.now() - t0);
const reason = (err) => (err.name === 'TimeoutError' ? 'tempo esgotado' : err.message || String(err));
