import * as THREE from 'three';
import { R, patchGeometry } from '../storm/geo.js';
import { texture } from '../storm/Earth.js';
import { NOISE_GLSL } from '../storm/noise.glsl.js';

const VERTEX = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  uniform sampler2D irA;
  uniform sampler2D irB;
  uniform float mixAB;
  uniform float heightScale;
  uniform vec3 vent;
  varying vec2 vUv;
  varying vec3 vPosW;
  varying vec3 vNormalW;
  varying float vCold;

  // In the GOES infrared rendering warm surfaces are grey and cold tops are coloured.
  float coldness(vec2 p) {
    vec3 c = mix(texture2D(irA, p).rgb, texture2D(irB, p).rgb, mixAB);
    return smoothstep(0.12, 0.4, max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b)));
  }

  void main() {
    vUv = uv;
    // Averaged neighbourhood so the relief is smooth rather than pixel steps.
    const float o = 0.008;
    float cold = 0.0;
    for (int i = -1; i <= 1; i++) {
      for (int j = -1; j <= 1; j++) cold += coldness(uv + vec2(float(i), float(j)) * o);
    }
    cold /= 9.0;
    vec2 e = min(uv, 1.0 - uv);
    cold *= smoothstep(0.02, 0.12, min(e.x, e.y));

    vec3 n = normalize(position);
    vec3 world = (modelMatrix * vec4(position, 1.0)).xyz;
    // The umbrella reached the stratosphere (~35 km), about three times higher than the
    // thunderstorms around it (~12 km); the whole relief is exaggerated by the same factor.
    float boost = 0.3 + 0.7 * exp(-pow(distance(world, vent) / 0.9, 2.0));
    vCold = cold;
    vec3 p = position + n * cold * heightScale * boost;
    vec4 w = modelMatrix * vec4(p, 1.0);
    vPosW = w.xyz;
    vNormalW = normalize(mat3(modelMatrix) * n);
    gl_Position = projectionMatrix * viewMatrix * w;
    #include <logdepthbuf_vertex>
  }`;

const FRAGMENT = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform sampler2D colorA;
  uniform sampler2D colorB;
  uniform float mixAB;
  uniform vec3 sunDir;
  uniform vec3 flashPos;
  uniform float flashPower;
  varying vec2 vUv;
  varying vec3 vPosW;
  varying vec3 vNormalW;
  varying float vCold;
  ${NOISE_GLSL}

  void main() {
    #include <logdepthbuf_fragment>
    // GeoColor is already lit by the real Sun (and switches to infrared clouds at night).
    vec3 c = mix(texture2D(colorA, vUv).rgb, texture2D(colorB, vUv).rgb, mixAB);

    // The relief catches the light on its sunward side.
    vec3 n = normalize(vNormalW);
    vec3 gn = normalize(cross(dFdx(vPosW), dFdy(vPosW)));
    if (dot(gn, n) < 0.0) gn = -gn;
    float day = smoothstep(-0.1, 0.25, dot(n, sunDir));
    float shade = mix(1.0, 0.6 + 0.7 * max(dot(gn, sunDir), 0.0), vCold * day * 0.85);
    vec3 col = c * shade;
    col += vec3(0.75, 0.82, 1.0) * flashPower * exp(-distance(vPosW, flashPos) * 3.0) * (0.3 + vCold);

    vec2 e = min(vUv, 1.0 - vUv);
    float ragged = min(e.x, e.y) + 0.03 * snoise(vec3(vUv * 7.0, 3.0)) + 0.012 * snoise(vec3(vUv * 23.0, 5.0));
    gl_FragColor = vec4(col, smoothstep(0.01, 0.1, ragged));
  }`;

// GOES-West frames draped on the globe. The colour image is the surface; the infrared image
// lifts the cold cloud tops, so the umbrella rises as a dome measured by the satellite.
export class PlumePatch {
  constructor(scene, region) {
    this.uniforms = {
      colorA: { value: null },
      colorB: { value: null },
      irA: { value: null },
      irB: { value: null },
      mixAB: { value: 0 },
      heightScale: { value: 0.16 },
      vent: { value: new THREE.Vector3() },
      sunDir: { value: new THREE.Vector3(1, 0, 0) },
      flashPos: { value: new THREE.Vector3() },
      flashPower: { value: 0 },
    };
    this.mesh = new THREE.Mesh(
      patchGeometry(region, R * 1.0008, 256),
      new THREE.ShaderMaterial({
        uniforms: this.uniforms,
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        transparent: true,
        depthWrite: true,
      }),
    );
    this.mesh.renderOrder = 1;
    this.mesh.visible = false;
    scene.add(this.mesh);
  }

  // `renderer` sends the frames to the GPU now, a pair at a time while the intro is open: left to the
  // first time each one is sampled, every new frame of the eruption stalled the frame that needed it.
  setFrames(colorCanvases, irCanvases, anisotropy, renderer) {
    this.color = colorCanvases.map((c) => texture(c, anisotropy));
    // The infrared frames are data: read them as they are, without colour-space conversion.
    this.ir = irCanvases.map((c) => {
      const tex = texture(c);
      tex.colorSpace = THREE.NoColorSpace;
      return tex;
    });
    if (renderer) {
      this.color.forEach((tex, i) =>
        setTimeout(() => {
          renderer.initTexture(tex);
          renderer.initTexture(this.ir[i]);
        }, 150 * i),
      );
    }
    this.mesh.visible = true;
    this.setMix(0, 0, 0);
  }

  setMix(a, b, mix) {
    if (!this.color) return;
    const u = this.uniforms;
    u.colorA.value = this.color[a];
    u.colorB.value = this.color[b];
    u.irA.value = this.ir[a];
    u.irB.value = this.ir[b];
    u.mixAB.value = mix;
  }

  setVent(position) {
    this.uniforms.vent.value.copy(position);
  }

  setSun(dir) {
    this.uniforms.sunDir.value.copy(dir);
  }

  setFlash(pos, power) {
    this.uniforms.flashPos.value.copy(pos);
    this.uniforms.flashPower.value = power;
  }
}
