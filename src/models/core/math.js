export const clamp = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v));
export const norm = (v, min, max) => clamp((v - min) / (max - min));
export const lerp = (a, b, t) => a + (b - a) * t;
// Exponential interpolation: perceptually even steps for pitch and filter frequency.
export const expMap = (t, min, max) => min * Math.pow(max / min, clamp(t));
