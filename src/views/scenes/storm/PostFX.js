import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// A soft vignette only: grain and colour fringes made the picture noisy and cost a full pass of
// extra texture reads.
const LensShader = {
  uniforms: {
    tDiffuse: { value: null },
    vignette: { value: 0.5 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float vignette;
    varying vec2 vUv;
    void main() {
      vec3 col = texture2D(tDiffuse, vUv).rgb;
      col *= 1.0 - vignette * smoothstep(0.35, 0.9, length(vUv - 0.5));
      gl_FragColor = vec4(col, 1.0);
    }`,
};

export class PostFX {
  constructor(renderer, scene, camera) {
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.3, 0.5, 0.92);
    this.composer.addPass(this.bloom);
    this.lens = new ShaderPass(LensShader);
    this.composer.addPass(this.lens);
    this.composer.addPass(new OutputPass());
  }

  setSize(w, h) {
    this.composer.setSize(w, h);
    this.#shrinkBloom();
  }

  setPixelRatio(ratio) {
    this.composer.setPixelRatio(ratio);
    this.#shrinkBloom();
  }

  // The glow is blurred anyway: its chain runs at half the size of the picture (a quarter of the
  // pixels in its first, most expensive levels), and nobody can tell.
  #shrinkBloom() {
    const w = this.composer._width * this.composer._pixelRatio;
    const h = this.composer._height * this.composer._pixelRatio;
    if (w && h) this.bloom.setSize(Math.max(2, Math.round(w / 2)), Math.max(2, Math.round(h / 2)));
  }

  // Turned off as a last resort on slow graphics (see GlobeScene).
  setBloom(on) {
    this.bloom.enabled = on;
  }

  // The glow follows the music: it swells with what is playing and with flashes of light.
  update(time, { level, flash }) {
    this.bloom.strength = 0.22 + level * 0.55 + flash * 0.7;
  }

  render() {
    this.composer.render();
  }
}
