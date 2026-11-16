import * as THREE from 'three';

const VERTEX = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
    #include <logdepthbuf_vertex>
  }`;

// Sky seen from near the surface: horizon haze to zenith blue, with the Sun's disc and glow.
const FRAGMENT = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform vec3 up;
  uniform vec3 sunDir;
  uniform vec3 zenith;
  uniform vec3 horizon;
  uniform float day;
  uniform float amount;
  uniform float flash;
  varying vec3 vDir;
  void main() {
    #include <logdepthbuf_fragment>
    vec3 dir = normalize(vDir);
    float h = dot(dir, up);
    vec3 col = mix(horizon, zenith, smoothstep(0.0, 0.6, h));
    col = mix(col, horizon * 0.55, smoothstep(0.0, -0.25, h));
    float s = max(dot(dir, sunDir), 0.0);
    col += vec3(1.0, 0.93, 0.78) * (pow(s, 900.0) * 8.0 + pow(s, 14.0) * 0.35) * day;
    col += vec3(0.55, 0.62, 0.8) * flash * 0.35;
    gl_FragColor = vec4(col, amount);
  }`;

export class SkyDome {
  constructor(scene) {
    this.uniforms = {
      up: { value: new THREE.Vector3(0, 1, 0) },
      sunDir: { value: new THREE.Vector3(1, 0, 0) },
      zenith: { value: new THREE.Color() },
      horizon: { value: new THREE.Color() },
      day: { value: 1 },
      amount: { value: 0 },
      flash: { value: 0 },
    };
    this.mesh = new THREE.Mesh(
      new THREE.SphereGeometry(3, 48, 32),
      new THREE.ShaderMaterial({
        uniforms: this.uniforms,
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        side: THREE.BackSide,
        // Kept in the opaque pass (drawn first, as background) but still alpha-blended.
        transparent: false,
        blending: THREE.CustomBlending,
        blendSrc: THREE.SrcAlphaFactor,
        blendDst: THREE.OneMinusSrcAlphaFactor,
        depthWrite: false,
        depthTest: false,
      }),
    );
    this.mesh.renderOrder = -10;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);

    this.dayZenith = new THREE.Color(0.1, 0.27, 0.6);
    this.dayHorizon = new THREE.Color(0.58, 0.68, 0.8);
    this.nightZenith = new THREE.Color(0.004, 0.008, 0.025);
    this.nightHorizon = new THREE.Color(0.02, 0.03, 0.06);
  }

  get horizonColor() {
    return this.uniforms.horizon.value;
  }

  update(cameraPosition, { up, sunDir, day, amount, flash }) {
    this.mesh.visible = amount > 0.01;
    if (!this.mesh.visible) return;
    this.mesh.position.copy(cameraPosition);
    const u = this.uniforms;
    u.up.value.copy(up);
    u.sunDir.value.copy(sunDir);
    u.zenith.value.copy(this.nightZenith).lerp(this.dayZenith, day);
    u.horizon.value.copy(this.nightHorizon).lerp(this.dayHorizon, day);
    u.day.value = day;
    u.amount.value = amount;
    u.flash.value = flash;
  }
}
