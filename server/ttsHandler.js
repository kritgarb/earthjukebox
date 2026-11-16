import { createHash } from "node:crypto";

// Text-to-speech proxy for ElevenLabs. The API key stays on the server: the browser only
// ever talks to /api/tts. Shared by the Vite dev server and the standalone production server.

const MAX_CHARS = 600;
const CACHE_MAX = 200; // phrases kept in memory
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 40; // requests per IP per window
const LANGS = new Set(["pt", "en", "es"]);

const cache = new Map(); // hash -> Buffer (insertion order = LRU order)
const hits = new Map(); // ip -> [timestamps]

function limited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < RATE_WINDOW_MS)) hits.delete(k);
  return recent.length > RATE_MAX;
}

function readBody(req, limit = 4096) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > limit) {
        reject(new Error("too large"));
        req.destroy();
      } else chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

// Vercel hands over a request whose JSON body is already parsed (and its stream consumed).
async function parseBody(req) {
  if (req.body === undefined) return JSON.parse(await readBody(req));
  if (Buffer.isBuffer(req.body)) return JSON.parse(req.body.toString("utf8"));
  return typeof req.body === "string" ? JSON.parse(req.body) : req.body;
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, { "Cache-Control": "no-store", ...headers });
  res.end(body);
}

export function createTtsHandler(env = process.env) {
  const key = env.ELEVENLABS_API_KEY;
  const voice = env.ELEVENLABS_VOICE_ID;
  const model = env.ELEVENLABS_MODEL_ID || "eleven_flash_v2_5";

  return async function handle(req, res) {
    if (req.method !== "POST") return send(res, 405, "Method not allowed", { Allow: "POST" });
    if (!key || !voice) return send(res, 503, "TTS not configured");

    const ip = String(req.headers["x-forwarded-for"] ?? req.socket.remoteAddress ?? "").split(",")[0].trim();
    if (limited(ip)) return send(res, 429, "Too many requests", { "Retry-After": "60" });

    let text, lang;
    try {
      ({ text, lang } = (await parseBody(req)) ?? {});
    } catch {
      return send(res, 400, "Bad request");
    }
    text = typeof text === "string" ? text.trim() : "";
    if (!text || text.length > MAX_CHARS) return send(res, 400, "Invalid text");
    lang = LANGS.has(String(lang).slice(0, 2)) ? String(lang).slice(0, 2) : "pt";

    const hash = createHash("sha256").update(`${voice}|${model}|${lang}|${text}`).digest("hex");
    let audio = cache.get(hash);
    if (audio) {
      cache.delete(hash);
      cache.set(hash, audio);
    } else {
      let upstream;
      try {
        upstream = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_64`,
          {
            method: "POST",
            headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" },
            body: JSON.stringify({ text, model_id: model, language_code: lang }),
            signal: AbortSignal.timeout(15_000),
          },
        );
      } catch {
        return send(res, 504, "TTS upstream unreachable");
      }
      if (!upstream.ok) {
        console.error(`[tts] ElevenLabs answered ${upstream.status}: ${(await upstream.text().catch(() => "")).slice(0, 300)}`);
        return send(res, 502, "TTS upstream error");
      }
      audio = Buffer.from(await upstream.arrayBuffer());
      cache.set(hash, audio);
      if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
    }
    send(res, 200, audio, { "Content-Type": "audio/mpeg", "Content-Length": audio.length, "Cache-Control": "private, max-age=86400" });
  };
}
