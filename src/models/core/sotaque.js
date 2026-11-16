// Brazilian accents ("sotaques") for the Earth Jukebox pattern. Pure data, no audio.
// The rule never changes (intensity picks the note and chord, speed picks the tempo); an accent
// only changes who plays it: each phenomenon gets a Brazilian rhythm whose instruments enter one
// by one as the intensity crosses thresholds taken from the science of that phenomenon.
import { clamp, norm } from './math.js';
import { JUKEBOX, SCALES } from './music.js';

// Grids are 16 sixteenth notes (two bars of 2/4). Each entry is a velocity 0..1, 0 = rest.
const grid = (hits) => Array.from({ length: 16 }, (_, i) => hits[i] ?? 0);

// Hurricane thresholds: the Saffir-Simpson categories, in the same 35..155 kt scale as the note.
const ss = (kts) => norm(kts, 35, 155);

// Bossa nova: quiet and full of saudade; not in STYLES (the docs page lists the phenomena that
// have a section of their own), it plays the forest height.
const BOSSA = {
  id: 'bossa',
  name: 'Bossa nova',
  of: 'da bossa nova',
  rule: 'A cada ruptura, entra um instrumento da bossa nova.',
  region: 'Rio de Janeiro',
  why: 'Uma música de saudade para um gigante que some devagar. O violão começa sozinho; a cada ruptura registrada entra mais um instrumento.',
  key: JUKEBOX,
  chordSize: 4,
  layers: [
    // One instrument per band of the measured level.
    { id: 'violao', label: 'violão', from: 0, at: 'inteiro' },
    { id: 'baixo', label: 'baixo', from: 0.015, at: '−6% de área' },
    { id: 'ganza', label: 'ganzá', from: 0.07, at: '−22%' },
    { id: 'aro', label: 'aro de caixa', from: 0.25, at: '−58%' },
    { id: 'flauta', label: 'flauta', from: 0.6, at: '−88%' },
  ],
  patterns: {
    // The bossa clave under the fingers, the thumb on every beat.
    violao: grid({ 0: 0.8, 3: 0.6, 6: 0.7, 10: 0.7, 13: 0.6 }),
    baixo: grid({ 0: 0.9, 4: 0.6, 8: 0.8, 12: 0.6 }),
    baixoFifth: [4, 12],
    ganza: grid({ 0: 0.5, 1: 0.2, 2: 0.35, 3: 0.2, 4: 0.5, 5: 0.2, 6: 0.35, 7: 0.2, 8: 0.5, 9: 0.2, 10: 0.35, 11: 0.2, 12: 0.5, 13: 0.2, 14: 0.35, 15: 0.2 }),
    aro: grid({ 0: 0.7, 3: 0.6, 6: 0.7, 10: 0.7, 12: 0.6 }),
  },
  // Long notes and long rests: a bossa melody says little and lets the chords speak.
  phrase: [4, null, null, 2, null, 4, 5, null, 4, null, 2, null, 1, null, 0, null],
};

export const STYLES = {
  // Baião (Nordeste): the wind plays the sanfona, an instrument that only sounds with moving air.
  baiao: {
    id: 'baiao',
    name: 'Baião',
    of: 'do baião',
    rule: 'A cada categoria do furacão, entra um instrumento do baião.',
    region: 'Nordeste',
    why: 'O vento toca a sanfona: o fole só soa com ar em movimento. Cada categoria Saffir-Simpson traz um instrumento do trio de forró.',
    key: { ...JUKEBOX, key: 'Lá dórico', scale: SCALES.dorian },
    chordSize: 3,
    layers: [
      { id: 'triangulo', label: 'triângulo', from: 0, at: 'TT' },
      { id: 'sanfona', label: 'sanfona', from: 0, at: 'TT' },
      { id: 'zabumba', label: 'zabumba', from: ss(64), at: 'C1' },
      { id: 'fole', label: 'fole (acordes)', from: ss(83), at: 'C2' },
      { id: 'bacalhau', label: 'bacalhau', from: ss(96), at: 'C3' },
      { id: 'agogo', label: 'agogô', from: ss(113), at: 'C4' },
      { id: 'caixa', label: 'caixa', from: ss(137), at: 'C5' },
    ],
    patterns: {
      // Tum . . tum . . tá . : the 3+3+2 of the baião.
      zabumba: grid({ 0: 1, 3: 0.8, 8: 1, 11: 0.8 }),
      bacalhau: grid({ 6: 0.9, 14: 0.9, 2: 0.35, 10: 0.35 }),
      // Closed, closed, open, closed on every beat.
      triangulo: grid({ 0: 0.5, 1: 0.3, 2: 0.9, 3: 0.3, 4: 0.5, 5: 0.3, 6: 0.9, 7: 0.3, 8: 0.5, 9: 0.3, 10: 0.9, 11: 0.3, 12: 0.5, 13: 0.3, 14: 0.9, 15: 0.3 }),
      trianguloOpen: [2, 6, 10, 14],
      fole: grid({ 0: 0.9, 3: 0.7, 6: 0.8, 8: 0.9, 11: 0.7, 14: 0.8 }),
      agogo: grid({ 0: 0.8, 2: 0.6, 5: 0.8, 8: 0.6, 10: 0.8, 13: 0.6 }),
      agogoHigh: [0, 5, 10],
      caixa: grid({ 1: 0.3, 2: 0.5, 3: 0.3, 5: 0.3, 6: 0.6, 7: 0.3, 9: 0.3, 10: 0.5, 11: 0.3, 13: 0.4, 14: 0.7, 15: 0.5 }),
    },
    // The tune, in steps of the scale above the chord's root (null = rest): it leans on the
    // fifth and the raised sixth, falls home and answers, the way a sanfona sings a baião.
    phrase: [4, null, 4, 5, 6, 5, 4, 2, 0, null, 2, 4, 2, 1, 0, null],
  },

  // Maracatu de baque virado (Pernambuco): the heaviest drums in Brazilian music, for a volcano.
  maracatu: {
    id: 'maracatu',
    name: 'Maracatu',
    of: 'do maracatu',
    rule: 'A explosão traz as alfaias do maracatu, e a pluma traz o resto da banda.',
    region: 'Pernambuco',
    why: 'As alfaias do baque virado são os tambores mais graves da música brasileira. Antes da explosão só o gonguê marca o tempo; a pluma traz o baque inteiro.',
    key: JUKEBOX,
    chordSize: 3,
    layers: [
      { id: 'gongue', label: 'gonguê', from: 0, at: 'antes' },
      { id: 'alfaia', label: 'alfaias', from: 0.02, at: 'explosão' },
      { id: 'caixa', label: 'caixa', from: 0.2, at: '150 km' },
      { id: 'agbe', label: 'agbê', from: 0.4, at: '300 km' },
      { id: 'metais', label: 'metais', from: 0.6, at: '450 km' },
    ],
    patterns: {
      alfaia: grid({ 0: 1, 3: 0.7, 6: 0.9, 8: 1, 11: 0.7, 12: 0.8, 14: 0.9 }),
      gongue: grid({ 0: 0.9, 2: 0.5, 4: 0.7, 5: 0.5, 7: 0.7, 8: 0.9, 10: 0.5, 12: 0.7, 13: 0.5, 15: 0.6 }),
      gongueHigh: [2, 5, 10, 13],
      caixa: grid({ 0: 0.3, 1: 0.3, 2: 0.8, 3: 0.3, 4: 0.3, 5: 0.3, 6: 0.8, 7: 0.4, 8: 0.3, 9: 0.3, 10: 0.8, 11: 0.3, 12: 0.3, 13: 0.5, 14: 0.8, 15: 0.5 }),
      agbe: grid({ 0: 0.7, 2: 0.4, 4: 0.6, 6: 0.4, 8: 0.7, 10: 0.4, 12: 0.6, 14: 0.4 }),
    },
    // A brass call that hammers the root and jumps to the fifth, with room for the drums.
    phrase: [0, null, 0, 2, 4, null, 4, null, 2, null, 0, null, 4, 2, 0, null],
  },

  // Samba: the music of the city, for a planet seen from space by its night lights.
  samba: {
    id: 'samba',
    name: 'Samba',
    of: 'do samba',
    rule: 'A cada pedaço do mundo que acende, entra um instrumento do samba.',
    region: 'Rio de Janeiro',
    why: 'O samba é a música das cidades, e as luzes da noite são as cidades vistas do espaço. O surdo marca o pulso desde 2012; cada limiar de área acesa traz mais um instrumento da roda.',
    key: JUKEBOX,
    chordSize: 3,
    layers: [
      // Thresholds on the share of the map that is lit (0,315% in 2012 to 0,447% in 2023).
      { id: 'surdo', label: 'surdo', from: 0, at: 'em 2012' },
      { id: 'pandeiro', label: 'pandeiro', from: 0.18, at: '0,34% acesos' },
      { id: 'tamborim', label: 'tamborim', from: 0.35, at: '0,36%' },
      { id: 'cavaquinho', label: 'cavaquinho', from: 0.55, at: '0,39%' },
      { id: 'agogo', label: 'agogô', from: 0.8, at: '0,42%' },
    ],
    patterns: {
      // The surdo marks the second beat of the 2/4 bar, the heart of the samba.
      surdo: grid({ 0: 0.45, 4: 1, 8: 0.45, 12: 1 }),
      pandeiro: grid({ 0: 0.7, 1: 0.3, 2: 0.5, 3: 0.3, 4: 0.7, 5: 0.3, 6: 0.5, 7: 0.3, 8: 0.7, 9: 0.3, 10: 0.5, 11: 0.3, 12: 0.7, 13: 0.3, 14: 0.5, 15: 0.3 }),
      tamborim: grid({ 0: 0.8, 3: 0.6, 6: 0.8, 8: 0.6, 10: 0.8, 13: 0.6, 14: 0.5 }),
      cavaquinho: grid({ 0: 0.8, 2: 0.5, 4: 0.8, 6: 0.5, 8: 0.8, 10: 0.5, 12: 0.8, 14: 0.5 }),
      agogo: grid({ 0: 0.8, 3: 0.6, 6: 0.8, 10: 0.6, 12: 0.8 }),
      agogoHigh: [3, 10],
    },
    // A bright tune that skips along the scale and answers itself, like a cavaquinho solo.
    phrase: [4, null, 5, 4, 2, null, 4, 5, 6, null, 4, 2, 0, null, 2, null],
  },
};

// Accents of the EIC frame experiences. They are not in STYLES (the docs page lists those four):
// each reuses the kit of a Brazilian rhythm with thresholds on the measured level (0..1, the
// range of that series), so the band grows as the data does.
const band = (ids, froms, labels) =>
  ids.map((id, i) => ({
    id,
    label: labels[i],
    from: froms[i],
    at: froms[i] === 0 ? 'desde o início' : `${Math.round(froms[i] * 100)}% da faixa`,
  }));

export const EIC_STYLES = {
  // Lightning: maracatu, the heaviest drums, because thunder answers the flash.
  lightning: {
    ...STYLES.maracatu,
    rule: 'A cada faixa de relâmpagos à vista, entra um instrumento do maracatu.',
    why: 'As alfaias do baque virado soam como trovão, e o trovão é a resposta do relâmpago. O gonguê marca o tempo; quanto mais relâmpagos à vista, mais do baque entra.',
    layers: band(['gongue', 'alfaia', 'caixa', 'agbe', 'metais'], [0, 0.02, 0.2, 0.4, 0.6], ['gonguê', 'alfaias', 'caixa', 'agbê', 'metais']),
  },
  // CO2: samba, the music of the cities and the fires that release it.
  co2: {
    ...STYLES.samba,
    rule: 'A cada faixa de CO₂ à vista, entra um instrumento do samba.',
    why: 'O CO₂ sobe das cidades, das queimadas e das florestas. O surdo marca o pulso e, quanto mais carbono à vista, mais da roda de samba entra.',
    layers: band(['surdo', 'pandeiro', 'tamborim', 'cavaquinho', 'agogo'], [0, 0.18, 0.35, 0.55, 0.8], ['surdo', 'pandeiro', 'tamborim', 'cavaquinho', 'agogô']),
  },
  // Forest height: bossa nova, calm and open like a canopy.
  gedi: {
    ...BOSSA,
    rule: 'A cada faixa de altura média da floresta, entra um instrumento da bossa nova.',
    why: 'Uma música calma para a copa das árvores. O violão começa sozinho; quanto mais alta a floresta à vista, mais instrumentos entram.',
    layers: band(['violao', 'baixo', 'ganza', 'aro', 'flauta'], [0, 0.15, 0.3, 0.5, 0.7], ['violão', 'baixo', 'ganzá', 'aro de caixa', 'flauta']),
  },
  // Sea surface temperature: bossa nova, the music of the sea.
  sst: {
    ...BOSSA,
    rule: 'A cada faixa de águas quentes no mapa, entra um instrumento da bossa nova.',
    why: 'A bossa nova é a música do mar. O violão começa sozinho; quanto mais águas quentes no mapa, mais instrumentos entram.',
    layers: band(['violao', 'baixo', 'ganza', 'aro', 'flauta'], [0, 0.2, 0.4, 0.6, 0.8], ['violão', 'baixo', 'ganzá', 'aro de caixa', 'flauta']),
  },
  // Air quality: samba, the music of the cities where the pollution is made.
  airquality: {
    ...STYLES.samba,
    rule: 'A cada poluente que entra, entra um instrumento do samba.',
    why: 'O samba é a música das cidades, e a poluição vem delas. O surdo marca o pulso e cada poluente que entra traz mais um instrumento da roda.',
    layers: band(['surdo', 'pandeiro', 'tamborim', 'cavaquinho', 'agogo'], [0, 0.18, 0.35, 0.55, 0.8], ['surdo', 'pandeiro', 'tamborim', 'cavaquinho', 'agogô']),
  },
  // Ocean currents: maracatu, born on the coast of Pernambuco, the alfaias like waves.
  ocean: {
    ...STYLES.maracatu,
    rule: 'A cada camada de correntes que entra, entra um instrumento do maracatu.',
    why: 'O maracatu nasce no litoral de Pernambuco, e as alfaias soam como ondas. O gonguê marca o tempo; cada camada de correntes traz mais do baque.',
    layers: band(['gongue', 'alfaia', 'caixa', 'agbe', 'metais'], [0, 0.02, 0.2, 0.4, 0.6], ['gonguê', 'alfaias', 'caixa', 'agbê', 'metais']),
  },
  // Atmospheric river: baião, because the wind carries the moisture.
  river: {
    ...STYLES.baiao,
    rule: 'A cada faixa de vapor d\'água à vista, entra um instrumento do baião.',
    why: 'O vento toca a sanfona, e é o vento que transporta o vapor d\'água num rio atmosférico. Quanto mais vapor à vista, mais do trio de forró entra.',
    layers: band(['triangulo', 'sanfona', 'zabumba', 'fole', 'bacalhau', 'agogo', 'caixa'], [0, 0, 0.2, 0.4, 0.55, 0.7, 0.85], ['triângulo', 'sanfona', 'zabumba', 'fole (acordes)', 'bacalhau', 'agogô', 'caixa']),
  },
  // Aerosols: baião, because the sanfona only sounds with moving air, and wind carries aerosols.
  aerosols: {
    ...STYLES.baiao,
    rule: 'A cada tipo de aerossol que entra, entra um instrumento do baião.',
    why: 'O vento toca a sanfona, e é o vento que carrega poeira, fumaça e sal pelo planeta. Cada tipo de aerossol traz mais um instrumento do trio de forró.',
    layers: band(['triangulo', 'sanfona', 'zabumba', 'fole', 'bacalhau', 'agogo', 'caixa'], [0, 0, 0.2, 0.4, 0.55, 0.7, 0.85], ['triângulo', 'sanfona', 'zabumba', 'fole (acordes)', 'bacalhau', 'agogô', 'caixa']),
  },
};

// Layers sounding at an intensity 0..1, in the order they entered.
export function activeLayers(style, level) {
  const l = clamp(level);
  return style.layers.filter((layer) => l >= layer.from);
}

// The next instrument to come in, or null when the whole band is playing.
export function nextLayer(style, level) {
  const l = clamp(level);
  return style.layers.find((layer) => l < layer.from) ?? null;
}

// What the mapper needs from an accent (see jukebox in core/music.js).
export const tuneOf = (style) => (style ? { key: style.key, chordSize: style.chordSize } : undefined);

// The second half of the rule when the universal accent plays it.
export const UNIVERSAL_RULE = 'Quanto mais rápido ele muda, mais rápido o ritmo.';

// The universal accent: the synthesizer trio of HarmonyLayer.
export const UNIVERSAL_BAND = 'pad · arpejo · baixo';
