import * as THREE from 'three';
import { R } from '../storm/geo.js';

const VERTEX = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    #include <logdepthbuf_vertex>
  }`;

// A ring at a fixed angular distance from the vent, with two fainter ripples behind it.
const FRAGMENT = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform vec3 vent;
  uniform float angle;
  uniform float strength;
  varying vec3 vDir;
  float ring(float a, float at, float width) {
    float x = (a - at) / width;
    return exp(-x * x);
  }
  void main() {
    #include <logdepthbuf_fragment>
    float a = acos(clamp(dot(normalize(vDir), vent), -1.0, 1.0));
    float r = ring(a, angle, 0.0022) + 0.3 * ring(a, angle - 0.012, 0.003) + 0.12 * ring(a, angle - 0.03, 0.005);
    r *= step(0.0005, angle);
    gl_FragColor = vec4(vec3(1.0, 0.72, 0.42) * r * strength, 1.0);
  }`;

// The Lamb wave: the pressure pulse of the explosion, which circled the Earth several times.
// Modelled from its measured speed, not from imagery.
export class PressureWave {
  constructor(scene) {
    this.uniforms = {
      vent: { value: new THREE.Vector3(0, 1, 0) },
      angle: { value: 0 },
      strength: { value: 0 },
    };
    this.mesh = new THREE.Mesh(
      new THREE.SphereGeometry(R * 1.006, 128, 64),
      new THREE.ShaderMaterial({
        uniforms: this.uniforms,
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.mesh.renderOrder = 6;
    scene.add(this.mesh);
  }

  set(ventDir, distanceKm) {
    this.uniforms.vent.value.copy(ventDir);
    this.uniforms.angle.value = distanceKm / 6371;
    // Bright as it leaves, then a steady faint ring as it spreads over the planet.
    this.uniforms.strength.value = distanceKm > 0 ? 0.45 + 0.6 * Math.exp(-distanceKm / 900) : 0;
  }
}
