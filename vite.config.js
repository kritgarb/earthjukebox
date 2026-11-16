import { defineConfig, loadEnv } from "vite";
import { createTtsHandler } from "./server/ttsHandler.js";
import tailwindcss from "@tailwindcss/vite";

// Dev and preview serve /api/tts with the same handler as the production server (server/index.js).
function ttsProxy(env) {
  const handler = createTtsHandler(env);
  // No return value: Vite would run a returned function as a post-middleware hook.
  const attach = (server) => {
    server.middlewares.use("/api/tts", (req, res) => handler(req, res));
  };
  return { name: "tts-proxy", configureServer: attach, configurePreviewServer: attach };
}

export default defineConfig(({ mode }) => ({
  plugins: [tailwindcss(), ttsProxy(loadEnv(mode, process.cwd(), ""))],
  // One page per experience, plus the chooser.
  build: {
    rollupOptions: {
      output: {
        // Libraries in their own files: a change to the app's code no longer invalidates the
        // browser's copy of Three.js (~700 KB) on the next visit.
        manualChunks(id) {
          if (id.includes('node_modules/three/')) return 'three';
          if (id.includes('node_modules/gsap/')) return 'gsap';
        },
      },
      input: {
        index: "index.html",
        helene: "helene.html",
        tonga: "tonga.html",
        nightlights: "nightlights.html",
        eic: "eic.html",
        docs: "docs.html",
      },
    },
  },
  // Pre-bundle the libraries at startup so an open tab never requests a stale bundle.
  optimizeDeps: {
    entries: ["*.html"],
    include: [
      "three",
      "three/addons/controls/OrbitControls.js",
      "three/addons/utils/BufferGeometryUtils.js",
      "three/addons/postprocessing/EffectComposer.js",
      "three/addons/postprocessing/RenderPass.js",
      "three/addons/postprocessing/UnrealBloomPass.js",
      "three/addons/postprocessing/ShaderPass.js",
      "three/addons/postprocessing/OutputPass.js",
      "tone",
      "gsap",
      "d3",
    ],
  },
}));
