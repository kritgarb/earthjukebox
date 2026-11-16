import { createTtsHandler } from "../server/ttsHandler.js";

// Vercel serverless function: serves POST /api/tts in production with the same handler the Vite
// dev server uses. Set ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID (and optionally
// ELEVENLABS_MODEL_ID) in the Vercel project's Environment Variables.
export default createTtsHandler();
