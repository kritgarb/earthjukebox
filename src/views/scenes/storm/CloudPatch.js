import * as THREE from 'three';
import { R, patchGeometry } from './geo.js';
import { texture } from './Earth.js';
import { NOISE_GLSL } from './noise.glsl.js';

const VERTEX = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  uniform sampler2D frameA;
  uniform sampler2D frameB;
  uniform float mixAB;
  uniform float heightScale;
  uniform vec3 eyeCenter;
  uniform float eyeRadius;
  uniform float eyeStrength;
  uniform float wallHeight;
  uniform float time;
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vPosW;
  varying vec3 vEyeLocal;
  varying float vCloud;
  varying float vWall;
  varying float vWallHeight;
  varying vec3 vWallNormal;
  ${NOISE_GLSL}

  float cloudiness(vec3 c) {
    return smoothstep(0.08, 0.55, min(c.r, min(c.g, c.b)));
  }

  // Most of the time the story sits on one satellite frame: then the second is not even read
  // (the branch is on a uniform, so it costs nothing). That halves the vertex fetches.
  vec3 frameColor(vec2 p) {
    vec3 a = texture2D(frameA, p).rgb;
    return mixAB > 0.0005 ? mix(a, texture2D(frameB, p).rgb, mixAB) : a;
  }

  void main() {
    vUv = uv;
    // Averaged neighbourhood (a cross of five samples): small isolated clouds no longer turn
    // into towers.
    const float o = 0.007;
    vec3 c = frameColor(uv) * 2.0
      + frameColor(uv + vec2(o, 0.0)) + frameColor(uv - vec2(o, 0.0))
      + frameColor(uv + vec2(0.0, o)) + frameColor(uv - vec2(0.0, o));
    c /= 6.0;

    vec3 world = (modelMatrix * vec4(position, 1.0)).xyz;
    vec3 n = normalize(position);
    vEyeLocal = world - eyeCenter;

    // Eye from the EONET position: a clear centre ringed by a taller eyewall ("stadium").
    // eyeStrength is 0 below hurricane strength, so weaker storms have no eye.
    // The wall is steep on the inside and slopes gently outward, like a real eyewall.
    float d = length(vEyeLocal);
    float clear = smoothstep(eyeRadius * 0.6, eyeRadius * 1.0, d);
    float peak = eyeRadius * 1.3;
    float width = d < peak ? eyeRadius * 0.32 : eyeRadius * 0.9;
    float ring = (d - peak) / width;
    vWall = exp(-ring * ring) * eyeStrength;
    vCloud = max(cloudiness(c), vWall) * mix(1.0, clear, eyeStrength);

    vec3 p = position;
    vWallNormal = mat3(modelMatrix) * n;
    vWallHeight = 0.0;
    #if LAYER == 1
      // Billowing towers: low-frequency noise that slowly "boils" along the wall.
      // Only the wall itself boils; the noise is skipped everywhere else.
      float billow = 0.5;
      if (vWall > 0.002) billow = 0.5 + 0.5 * snoise(vEyeLocal * 9.0 + vec3(0.0, time * 0.06, 0.0));
      float wallH = vWall * wallHeight * (0.85 + 0.3 * billow);
      vWallHeight = vWall * (0.85 + 0.3 * billow);
      // Brighter, thicker cloud is pushed higher: relief estimated from the image brightness.
      // Around the eye the modeled wall replaces the image relief, which would read as shards up close.
      float imageRelief = mix(1.0, smoothstep(eyeRadius * 2.0, eyeRadius * 3.4, d), eyeStrength);
      vec2 ev = min(uv, 1.0 - uv);
      float border = smoothstep(0.02, 0.16, min(ev.x, ev.y));
      p += n * (vCloud * vCloud * heightScale * imageRelief * border + wallH);
      // Smooth analytic normal of the ring profile; fine detail is added per pixel.
      vec3 radial = normalize(vEyeLocal - n * dot(vEyeLocal, n) + 1e-6);
      float slope = wallHeight * vWall * (-2.0 * ring / width);
      vWallNormal = normalize(mat3(modelMatrix) * (n - radial * slope));
    #endif
    vec4 w = modelMatrix * vec4(p, 1.0);
    vPosW = w.xyz;
    vNormalW = normalize(mat3(modelMatrix) * n);
    gl_Position = projectionMatrix * viewMatrix * w;
    #include <logdepthbuf_vertex>
  }`;

const FRAGMENT = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform sampler2D frameA;
  uniform sampler2D frameB;
  uniform float mixAB;
  uniform vec3 sunDir;
  uniform vec3 flashPos;
  uniform float flashPower;
  uniform float time;
  uniform float wallDetail;
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vPosW;
  varying vec3 vEyeLocal;
  varying float vCloud;
  varying float vWall;
  varying float vWallHeight;
  varying vec3 vWallNormal;
  ${NOISE_GLSL}

  // Bump mapping from a scalar height using screen-space derivatives (Mikkelsen).
  vec3 perturb(vec3 pos, vec3 nrm, float h, float scale) {
    vec3 sx = dFdx(pos);
    vec3 sy = dFdy(pos);
    vec3 r1 = cross(sy, nrm);
    vec3 r2 = cross(nrm, sx);
    float det = dot(sx, r1);
    vec2 dh = vec2(dFdx(h), dFdy(h)) * scale;
    vec3 grad = sign(det) * (dh.x * r1 + dh.y * r2);
    return normalize(abs(det) * nrm - grad);
  }

  void main() {
    #include <logdepthbuf_fragment>
    vec3 c = texture2D(frameA, vUv).rgb;
    if (mixAB > 0.0005) c = mix(c, texture2D(frameB, vUv).rgb, mixAB);
    float valid = max(step(0.004, c.r + c.g + c.b), step(0.05, vWall));
    // Ragged, wide fade at the border: the satellite patch dissolves into the globe instead of
    // reading as a pasted rectangle.
    vec2 e = min(vUv, 1.0 - vUv);
    float ragged = min(e.x, e.y) + 0.035 * snoise(vec3(vUv * 7.0, 0.0)) + 0.015 * snoise(vec3(vUv * 23.0, 1.0));
    float edge = smoothstep(0.01, 0.13, ragged);

    vec3 n = normalize(vNormalW);
    float d = dot(n, sunDir);
    float day = smoothstep(-0.06, 0.3, d);
    // Same lighting as the globe underneath so the patch blends into it.
    float light = 0.02 + 1.0 * max(d, 0.0);
    float detail = 0.5;

    #if LAYER == 1
      // Cloud relief is lit by its real slope: sunward faces bright, lee faces in shadow.
      vec3 gn = normalize(cross(dFdx(vPosW), dFdy(vPosW)));
      if (dot(gn, n) < 0.0) gn = -gn;
      gn = normalize(mix(n, gn, 0.7));
      float wallMix = smoothstep(0.02, 0.25, vWall);
      vec3 wn = normalize(vWallNormal);
      // Uniform branch (only up close): cauliflower texture of convective towers on the eyewall.
      if (wallDetail > 0.5) {
        detail = 0.5 + 0.5 * fbm(vEyeLocal * 32.0 + vec3(0.0, time * 0.04, 0.0));
        wn = perturb(vPosW, wn, detail, 0.007);
      }
      gn = normalize(mix(gn, wn, wallMix));
      vec3 wallColor = vec3(0.84, 0.87, 0.92) * mix(0.7, 1.05, detail);
      // The base of the wall sits in its own shadow (blue-grey storm cloud); the tops catch the light.
      float lift = smoothstep(0.05, 0.95, vWallHeight);
      wallColor *= mix(vec3(0.26, 0.29, 0.34), vec3(1.0), lift);
      c = mix(c, wallColor, wallMix * 0.85);
      light = 0.02 + day * (0.28 + 0.82 * max(dot(gn, sunDir), 0.0));
    #endif

    float flash = flashPower * exp(-distance(vPosW, flashPos) * 4.0);
    vec3 col = c * light + vec3(0.72, 0.8, 1.0) * flash * (0.25 + vCloud) * (0.6 + detail * 0.8);

    #if LAYER == 0
      // Only the clouds are taken from the frame; ground and ocean come from the globe underneath,
      // so the patch has no visible seam (and city lights show through clear sky at night).
      float alpha = valid * edge * smoothstep(0.0, 0.55, vCloud);
    #else
      float alpha = mix(vCloud * valid * edge * 0.94, 1.0, smoothstep(0.1, 0.4, vWall));
      // Thin haze is not written to depth, so it never hides the wind behind it.
      if (alpha < 0.3) discard;
    #endif
    gl_FragColor = vec4(col, alpha);
  }`;

// The day's real satellite frame draped on the globe, plus a second copy displaced into 3D cloud tops.
export class CloudPatch {
  constructor(scene, region) {
    this.uniforms = {
      frameA: { value: null },
      frameB: { value: null },
      mixAB: { value: 0 },
      heightScale: { value: 0.085 },
      sunDir: { value: new THREE.Vector3(1, 0, 0) },
      flashPos: { value: new THREE.Vector3() },
      flashPower: { value: 0 },
      eyeCenter: { value: new THREE.Vector3() },
      eyeRadius: { value: 0.05 },
      eyeStrength: { value: 0 },
      wallHeight: { value: 0.12 },
      time: { value: 0 },
      wallDetail: { value: 0 },
    };

    const material = (layer) =>
      new THREE.ShaderMaterial({
        uniforms: this.uniforms,
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        defines: { LAYER: layer },
        transparent: true,
        depthWrite: true,
      });

    // The surface layer is not displaced, so it needs few vertices; the relief keeps enough for
    // the eyewall to stay round.
    this.surface = new THREE.Mesh(patchGeometry(region, R * 1.0008, 64), material(0));
    this.tops = new THREE.Mesh(patchGeometry(region, R * 1.0014, 288), material(1));
    this.surface.material.depthWrite = false;
    this.surface.renderOrder = 1;
    this.tops.renderOrder = 2;
    this.surface.visible = this.tops.visible = false;
    scene.add(this.surface, this.tops);
  }

  // The frames may arrive one by one (see StormImageryModel): `setFrame` adds each as it is ready.
  // `renderer` lets a frame go up to the GPU right away, one at a time: left to the first time it
  // is drawn, every change of day used to stall the frame that needed it.
  setFrames(canvases, anisotropy, renderer) {
    this.anisotropy = anisotropy;
    this.renderer = renderer;
    this.textures = [];
    this.uploads = 0;
    canvases.forEach((c, i) => c && this.setFrame(i, c));
  }

  setFrame(i, canvas) {
    const tex = texture(canvas, this.anisotropy);
    // A live image replacing the local copy of the same day: whatever is showing the old one moves
    // to the new, and the old leaves the GPU (16 MB for a 2048 frame).
    const old = this.textures[i];
    this.textures[i] = tex;
    if (old) {
      for (const slot of [this.uniforms.frameA, this.uniforms.frameB]) if (slot.value === old) slot.value = tex;
      old.dispose();
    }
    if (this.renderer) {
      const delay = 300 * this.uploads++;
      setTimeout(() => {
        // Not if a live image took its place meanwhile (it was freed).
        if (this.textures[i] === tex) this.renderer.initTexture(tex);
        this.uploads--;
      }, delay);
    }
    if (!this.surface.visible) {
      this.surface.visible = this.tops.visible = true;
      this.setMix(i, i, 0);
    }
  }

  // A day whose frame is not there yet shows the nearest one that is.
  setMix(a, b, mix) {
    if (!this.textures) return;
    const ready = this.textures.find(Boolean);
    this.uniforms.frameA.value = this.textures[a] ?? ready;
    this.uniforms.frameB.value = this.textures[b] ?? ready;
    this.uniforms.mixAB.value = mix;
  }

  setSun(dir) {
    this.uniforms.sunDir.value.copy(dir);
  }

  setEye(center, radius, strength) {
    this.uniforms.eyeCenter.value.copy(center);
    this.uniforms.eyeRadius.value = radius;
    this.uniforms.eyeStrength.value = strength;
  }

  setFlash(pos, power) {
    this.uniforms.flashPos.value.copy(pos);
    this.uniforms.flashPower.value = power;
  }

  tick(time, closeUp) {
    this.uniforms.time.value = time;
    this.uniforms.wallDetail.value = closeUp ? 1 : 0;
  }
}
