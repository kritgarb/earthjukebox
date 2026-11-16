import * as THREE from 'three';
import { R } from './geo.js';

const EARTH_VERTEX = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vPosW;
  void main() {
    vUv = uv;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vec4 w = modelMatrix * vec4(position, 1.0);
    vPosW = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
    #include <logdepthbuf_vertex>
  }`;

// Day side: Blue Marble lit by the real Sun. Night side: VIIRS Black Marble city lights.
const EARTH_FRAGMENT = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform sampler2D dayMap;
  uniform sampler2D nightMap;
  uniform vec3 sunDir;
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vPosW;
  void main() {
    #include <logdepthbuf_fragment>
    vec3 n = normalize(vNormalW);
    vec3 viewDir = normalize(cameraPosition - vPosW);
    float d = dot(n, sunDir);
    float day = smoothstep(-0.08, 0.2, d);

    vec3 dayC = texture2D(dayMap, vUv).rgb;
    vec3 nightC = texture2D(nightMap, vUv).rgb;
    float lights = smoothstep(0.08, 0.5, max(nightC.r, max(nightC.g, nightC.b)));

    vec3 lit = dayC * (0.05 + 1.1 * max(d, 0.0));
    vec3 night = dayC * 0.015 + vec3(1.0, 0.72, 0.38) * lights * 0.9;

    float water = step(dayC.r + 0.01, dayC.b) * step(dayC.g, dayC.b + 0.02);
    float spec = pow(max(dot(reflect(-sunDir, n), viewDir), 0.0), 220.0) * water * day;

    vec3 col = mix(night, lit, day) + vec3(1.0, 0.93, 0.8) * spec * 0.3;
    float fres = pow(1.0 - max(dot(n, viewDir), 0.0), 3.0);
    col += vec3(0.3, 0.55, 1.0) * fres * (0.08 + 0.5 * day);
    gl_FragColor = vec4(col, 1.0);
  }`;

const ATMOS_VERTEX = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  varying vec3 vNormalV;
  varying vec3 vPosW;
  void main() {
    vNormalV = normalize(normalMatrix * normal);
    vec4 w = modelMatrix * vec4(position, 1.0);
    vPosW = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
    #include <logdepthbuf_vertex>
  }`;

const ATMOS_FRAGMENT = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform vec3 sunDir;
  uniform float shellRadius;
  varying vec3 vNormalV;
  varying vec3 vPosW;
  void main() {
    #include <logdepthbuf_fragment>
    float glow = pow(max(0.0, 0.7 - dot(vNormalV, vec3(0.0, 0.0, 1.0))), 3.0);
    float lit = smoothstep(-0.35, 0.35, dot(normalize(vPosW), sunDir));
    // Seen from inside the shell (near the surface) the rim glow would wash the view out.
    float outside = smoothstep(shellRadius * 0.995, shellRadius * 1.03, length(cameraPosition));
    gl_FragColor = vec4(vec3(0.35, 0.62, 1.0) * glow * (0.12 + 0.88 * lit) * outside, 1.0);
  }`;

export class Earth {
  constructor(scene) {
    this.uniforms = {
      dayMap: { value: placeholder('#0b1a33') },
      nightMap: { value: placeholder('#000000') },
      sunDir: { value: new THREE.Vector3(1, 0, 0) },
    };

    this.mesh = new THREE.Mesh(
      new THREE.SphereGeometry(R, 192, 128),
      new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: EARTH_VERTEX, fragmentShader: EARTH_FRAGMENT }),
    );

    this.atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(R * 1.045, 96, 64),
      new THREE.ShaderMaterial({
        uniforms: { sunDir: this.uniforms.sunDir, shellRadius: { value: R * 1.045 } },
        vertexShader: ATMOS_VERTEX,
        fragmentShader: ATMOS_FRAGMENT,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
      }),
    );

    scene.add(this.mesh, this.atmosphere);
  }

  setMaps(dayImg, nightImg, anisotropy) {
    // The maps can be set twice (the local copies, then the live ones): the old pair is freed.
    const old = [this.uniforms.dayMap.value, this.uniforms.nightMap.value];
    this.uniforms.dayMap.value = texture(dayImg, anisotropy);
    this.uniforms.nightMap.value = texture(nightImg, anisotropy);
    old.forEach((tex) => tex?.dispose?.());
  }

  setSun(dir) {
    this.uniforms.sunDir.value.copy(dir);
  }
}

export function texture(image, anisotropy = 1) {
  const tex = image instanceof HTMLCanvasElement ? new THREE.CanvasTexture(image) : new THREE.Texture(image);
  // WebGL ignores flipY for an ImageBitmap: the worker that composes the frames flips it already.
  if (typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap) {
    tex.flipY = false;
    // Once on the GPU the decoded copy is dead weight (~16 MB for a 2048 frame): let it go.
    tex.onUpdate = () => image.close();
  }
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

function placeholder(color) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 2;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 2, 2);
  return texture(canvas);
}
