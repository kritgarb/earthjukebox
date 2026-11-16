import { interpolateRgbBasis } from 'd3';

// Calm sea-green to hot bougainvillea pink: the cross-modal "intensity" ramp used everywhere,
// in the colours of the Brazilian palette (styles/tokens.css).
export const intensityColor = interpolateRgbBasis(['#19c3c9', '#1fc46b', '#ffd23f', '#ff2e7e']);

export const CATEGORY_COLORS = ['#19c3c9', '#1fc46b', '#b5dc45', '#ffd23f', '#ff9a1f', '#ff5a3c', '#ff2e7e'];

export const categoryColor = (category) => CATEGORY_COLORS[category.level];

// Sustained wind (kt) on the same ramp, shared by the globe track and the timeline profile.
export const windColor = (kts) => intensityColor(Math.max(0, Math.min(1, (kts - 15) / 125)));

// Remaining ice (share of the original area): fresh white-blue when whole, warm as it melts away.
export const iceColor = interpolateRgbBasis(['#3dbefb', '#ffd23f', '#19c3c9', '#eafcff']);

// Umbrella growth 0..1 for the eruption: ash violet to incandescent orange and pink.
export const ashColor = interpolateRgbBasis(['#a199c8', '#b79cff', '#ffd23f', '#ff2e7e']);

// Share of the map that is lit, 0..1: the violet of a dark night, then the warm yellow of the
// lamps themselves, then the white of the brightest cities.
export const lightColor = interpolateRgbBasis(['#7a5cff', '#ffd23f', '#fff4c2']);
