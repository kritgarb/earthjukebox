import * as THREE from 'three';
import { NOISE_GLSL } from './noise.glsl.js';

const VERTEX = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  varying vec2 vLocal;
  varying vec3 vPosW;
  varying vec3 vUp;
  void main() {
    vLocal = position.xy;
    vec4 w = modelMatrix * vec4(position, 1.0);
    vPosW = w.xyz;
    vUp = normalize(mat3(modelMatrix) * vec3(0.0, 0.0, 1.0));
    gl_Position = projectionMatrix * viewMatrix * w;
    #include <logdepthbuf_vertex>
  }`;

// Sea surface inside the eye: waves, foam that grows with intensity, sky reflection, sun glint.
const FRAGMENT = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform float time;
  uniform float intensity;
  uniform float day;
  uniform vec3 sunDir;
  uniform vec3 skyColor;
  uniform vec3 flashPos;
  uniform float flashPower;
  uniform float waveScale;
  varying vec2 vLocal;
  varying vec3 vPosW;
  varying vec3 vUp;
  ${NOISE_GLSL}

  vec3 perturb(vec3 pos, vec3 nrm, float h, float scale) {
    vec3 sx = dFdx(pos);
    vec3 sy = dFdy(pos);
    vec3 r1 = cross(sy, nrm);
    vec3 r2 = cross(nrm, sx);
    float det = dot(sx, r1);
    vec2 dh = vec2(dFdx(h), dFdy(h)) * scale;
    return normalize(abs(det) * nrm - sign(det) * (dh.x * r1 + dh.y * r2));
  }

  void main() {
    #include <logdepthbuf_fragment>
    float r = length(vLocal);
    float fade = 1.0 - smoothstep(0.7, 1.0, r);

    // Fine chop fades with distance so far water does not alias into noise.
    float dist = length(cameraPosition - vPosW);
    float near = 1.0 - smoothstep(0.015, 0.09, dist);
    vec2 p = vLocal * waveScale;
    float swell = fbm3(vec3(p, time * 0.3));
    float chop = snoise(vec3(p * 3.0, time * 0.8)) * 0.3 * near;
    vec3 n = perturb(vPosW, vUp, swell + chop, 0.0016 * (24.0 / waveScale) * (0.5 + intensity) * mix(0.35, 1.0, near));

    vec3 viewDir = normalize(cameraPosition - vPosW);
    float fres = 0.04 + 0.96 * pow(1.0 - max(dot(n, viewDir), 0.0), 5.0);
    vec3 deep = vec3(0.01, 0.05, 0.08) * (0.25 + 0.75 * day);
    vec3 col = mix(deep, skyColor, fres);

    float spec = pow(max(dot(reflect(-sunDir, n), viewDir), 0.0), 140.0) * day;
    col += vec3(1.0, 0.94, 0.82) * spec * 1.6;

    // Whitecaps and spray streaks, more of them in stronger storms.
    float foamNoise = 0.5 + 0.5 * fbm3(vec3(p * 1.4, time * 0.25));
    float foam = smoothstep(0.72 - 0.2 * intensity, 0.95, foamNoise) * intensity;
    col = mix(col, vec3(0.82, 0.86, 0.9) * (0.08 + 0.92 * day), foam * 0.5);

    col += vec3(0.7, 0.78, 1.0) * flashPower * exp(-distance(vPosW, flashPos) * 5.0) * 0.6;
    gl_FragColor = vec4(col, fade);
  }`;

export class EyeOcean {
  constructor(scene) {
    this.uniforms = {
      time: { value: 0 },
      intensity: { value: 0.5 },
      day: { value: 1 },
      sunDir: { value: new THREE.Vector3(1, 0, 0) },
      skyColor: { value: new THREE.Color(0.5, 0.65, 0.8) },
      flashPos: { value: new THREE.Vector3() },
      flashPower: { value: 0 },
      // Wave cells across the disc; larger discs need more of them to keep the waves small.
      waveScale: { value: 24 },
    };
    this.mesh = new THREE.Mesh(
      new THREE.CircleGeometry(1, 160),
      new THREE.ShaderMaterial({
        uniforms: this.uniforms,
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        transparent: true,
        depthWrite: true,
      }),
    );
    this.mesh.matrixAutoUpdate = false;
    this.mesh.renderOrder = 1;
    this.mesh.visible = false;
    scene.add(this.mesh);
  }

  // Disc tangent to the globe at the eye; local x east, y north, z up.
  setPose(center, { east, north, up }, radius) {
    this.mesh.matrix.makeBasis(east.clone().multiplyScalar(radius), north.clone().multiplyScalar(radius), up);
    this.mesh.matrix.setPosition(center.clone().addScaledVector(up, -0.0004));
    this.mesh.matrixWorldNeedsUpdate = true;
  }

  update({ time, intensity, day, sunDir, skyColor, flashPos, flashPower, visible }) {
    this.mesh.visible = visible;
    if (!visible) return;
    const u = this.uniforms;
    u.time.value = time;
    u.intensity.value = intensity;
    u.day.value = day;
    u.sunDir.value.copy(sunDir);
    u.skyColor.value.copy(skyColor);
    u.flashPos.value.copy(flashPos);
    u.flashPower.value = flashPower;
  }
}
