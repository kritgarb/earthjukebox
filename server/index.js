import { createServer } from "node:http";
import { createTtsHandler } from "./ttsHandler.js";

// Standalone production server for the narration proxy. Put it behind the reverse proxy
// (Traefik) so that /api/tts reaches this port while the static site is served as usual.
//   ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID, [ELEVENLABS_MODEL_ID], [PORT]
const tts = createTtsHandler();
const port = Number(process.env.PORT) || 8787;

createServer((req, res) => {
  if (req.url?.split("?")[0] === "/api/tts") return tts(req, res);
  res.writeHead(404).end("Not found");
}).listen(port, () => console.log(`[tts] listening on :${port}`));
