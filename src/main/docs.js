// The documentation page. Every table and the calculator are built from the same modules the
// experiences use (core/music.js, core/sotaque.js, SensoryMapper.js, core/physics.js), so the
// numbers on the page cannot drift away from what actually plays.
import { getLanguage, initI18n, onLanguageChange, t } from "../i18n/index.js";
import {
  JUKEBOX,
  SCALES,
  chordOf,
  degreeToMidi,
  midiToHz,
  noteName,
} from "../models/core/music.js";
import { EIC_STYLES, STYLES, activeLayers, tuneOf } from "../models/core/sotaque.js";
import { EIC } from "../config/eic.js";
import { et } from "../i18n/eicText.js";
import { SOURCES, dt, dtNightlights, per } from "../i18n/eicDocsText.js";
import {
  eruptionToSound,
  hurricaneToSound,
  intensityToVibration,
  nightLightsToSound,
} from "../models/SensoryMapper.js";
import { norm } from "../models/core/math.js";
import {
  SAO_PAULO,
  lambWave,
  plumePhysics,
  windPhysics,
} from "../models/core/physics.js";
import { categorize } from "../models/HurricaneModel.js";
import { TONGA } from "../config/example.js";

initI18n();

const $ = (sel) => document.querySelector(sel);
const nf = (v, d = 0) =>
  v.toLocaleString(getLanguage(), {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
const pitchClass = (midi) => noteName(midi).replace(/-?\d+$/, "");

// Chord quality from the stacked intervals, in the usual cipher.
const QUALITY = {
  "3,4": "m",
  "4,3": "",
  "3,3": "dim",
  "3,4,3": "m7",
  "4,3,4": "maj7",
  "4,3,3": "7",
  "3,3,4": "m7(♭5)",
};
function chordName(chord) {
  const steps = chord
    .slice(1)
    .map((m, i) => m - chord[i])
    .join(",");
  return `${t(noteName(chord[0]).replace(/-?\d+$/, ""))}${QUALITY[steps] ?? "?"}`;
}
const chordNotes = (chord) =>
  chord.map((midi) => t(noteName(midi))).join(" · ");

// What each phenomenon feeds into the rule, and the way back from a level 0..1 to the data.
// Measured in the 12 yearly EIC frames (NightLightsModel): the smallest and largest lit share of
// the map, and the largest change between two years.
const LIT = { min: 0.003149, max: 0.004472, maxStep: 0.000373 };
const INVERSE = {
  baiao: (level) => `${nf(35 + level * 120)} kt`,
  maracatu: (level) => `${nf(level * 750)} km`,
  samba: (level) => `${nf((LIT.min + level * (LIT.max - LIT.min)) * 100, 3)} %`,
};

// ---------------------------------------------------------------- the 15 degrees
function renderScale() {
  const dorian = { ...JUKEBOX, scale: SCALES.dorian };
  const rows = Array.from({ length: JUKEBOX.steps }, (_, degree) => {
    const level = degree / (JUKEBOX.steps - 1);
    const midi = degreeToMidi(degree, JUKEBOX.scale, JUKEBOX.rootMidi);
    const midiD = degreeToMidi(degree, dorian.scale, dorian.rootMidi);
    const triad = chordOf(degree, JUKEBOX.scale, JUKEBOX.rootMidi, 3);
    const tetrad = chordOf(degree, JUKEBOX.scale, JUKEBOX.rootMidi, 4);
    const triadD = chordOf(degree, dorian.scale, dorian.rootMidi, 3);
    return `<tr>
      <td class="num">${degree}</td>
      <td><b>${t(noteName(midi))}</b>${midiD !== midi ? ` <span class="alt">(${t(noteName(midiD))} ${t("docs.inDorian")})</span>` : ""}</td>
      <td class="num">${nf(midiToHz(midi), 2)}</td>
      <td class="num">${midi}</td>
      <td><b>${chordName(triad)}</b> <span class="alt">${chordNotes(triad)}</span></td>
      <td><b>${chordName(triadD)}</b></td>
      <td><b>${chordName(tetrad)}</b></td>
      <td class="num">${INVERSE.baiao(level)}</td>
      <td class="num">${INVERSE.maracatu(level)}</td>
      <td class="num">${INVERSE.samba(level)}</td>
    </tr>`;
  });
  $("#scale-table tbody").innerHTML = rows.join("");
}

// ---------------------------------------------------------------- the three bands
const STEP_LABELS = [
  "1",
  "e",
  "&",
  "a",
  "2",
  "e",
  "&",
  "a",
  "1",
  "e",
  "&",
  "a",
  "2",
  "e",
  "&",
  "a",
];

function renderStyle(style) {
  const tune = tuneOf(style);
  const key = tune.key;

  $(`#layers-${style.id} tbody`).innerHTML = style.layers
    .map((layer) => {
      const degree = Math.round(layer.from * (key.steps - 1));
      const chord = chordOf(degree, key.scale, key.rootMidi, tune.chordSize);
      return `<tr>
        <td><b>${t(layer.label)}</b></td>
        <td>${t(layer.at)}</td>
        <td class="num">${nf(layer.from, 3)}</td>
        <td class="num">${layer.from === 0 ? t("docs.fromTheStart") : INVERSE[style.id](layer.from)}</td>
        <td>${t(noteName(degreeToMidi(degree, key.scale, key.rootMidi)))} · ${chordName(chord)}</td>
      </tr>`;
    })
    .join("");

  // Only the 16-step grids; lists such as `agogoHigh` say which hits take the high note.
  const grids = Object.entries(style.patterns).filter(
    ([, v]) =>
      v.length === 16 &&
      typeof v[0] === "number" &&
      v.some((x) => x > 0 && x <= 1),
  );
  $(`#grid-${style.id}`).innerHTML =
    `<div class="seq__row seq__row--head" aria-hidden="true"><span class="seq__name"></span>${STEP_LABELS.map((l, i) => `<span class="seq__step${i % 4 === 0 ? " is-beat" : ""}">${l}</span>`).join("")}</div>` +
    grids
      .map(([id, pattern]) => {
        const hits = pattern.map((v, i) => (v ? i + 1 : null)).filter(Boolean);
        return `<div class="seq__row" role="img" aria-label="${t("docs.sequenceAria", { name: id, hits: hits.join(", ") })}">
          <span class="seq__name">${t(id)}</span>${pattern.map((v, i) => `<span class="seq__cell${i % 4 === 0 ? " is-beat" : ""}" style="--v:${v}"></span>`).join("")}
        </div>`;
      })
      .join("");

  $(`#phrase-${style.id}`).textContent = style.phrase
    .map((s) => (s == null ? "·" : s))
    .join("  ");
  $(`#key-${style.id}`).textContent =
    `${t(key.key)} · ${t(tune.chordSize === 4 ? "docs.seventhChords" : "docs.triads")}`;
}

// ---------------------------------------------------------------- live calculator
const CALC = {
  helene: {
    style: STYLES.baiao,
    a: {
      label: "docs.sustainedWind",
      unit: "kt",
      min: 15,
      max: 160,
      step: 1,
      value: 64,
    },
    b: null,
    sound: (a, _b, tune) =>
      hurricaneToSound({ kts: a, lon: -85.5 }, [-88, -83], tune),
    facts: (a) => {
      const p = windPhysics(a);
      return [
        [t("docs.category"), t(categorize(a).label)],
        [
          t("docs.dynamicPressure"),
          `${nf(p.pressurePa)} Pa (${nf(p.pushKgM2)} kg/m²)`,
        ],
        [
          t("docs.destructivePotential"),
          `${nf(p.powerRatio, 1)}× ${t("docs.newlyFormedHurricane")}`,
        ],
      ];
    },
    haptic: (s) => intensityToVibration(s.intensity),
  },
  tonga: {
    style: STYLES.maracatu,
    a: {
      label: "docs.plumeDiameter",
      unit: "km",
      min: 0,
      max: 750,
      step: 5,
      value: 300,
    },
    b: {
      label: "docs.edgeExpansion",
      unit: "km/min",
      min: 0,
      max: 6,
      step: 0.1,
      value: 2.5,
    },
    sound: (a, b, tune) =>
      eruptionToSound(
        { diameterKm: a, expansionKmMin: b, coreIndex: 0.2, erupted: a > 0 },
        tune,
      ),
    facts: (a, b) => {
      const p = plumePhysics({ diameterKm: a, expansionKmMin: b });
      return [
        [t("docs.plumeArea"), `${nf(p.areaKm2)} km²`],
        [
          t("docs.equivalentTo"),
          `${nf(p.states, 2)} ${t("docs.saoPauloStates")}`,
        ],
        [t("docs.edge"), `${nf(p.edgeKmH)} km/h`],
      ];
    },
    haptic: (s) => intensityToVibration(s.intensity),
  },
};

CALC.nightlights = {
  style: STYLES.samba,
  a: {
    label: "docs.litArea",
    unit: "docs.thousandthsOfPercent",
    min: 315,
    max: 447,
    step: 1,
    value: 380,
  },
  b: null,
  // Speed fixed at half of the largest yearly change.
  sound: (a, _b, tune) =>
    nightLightsToSound(
      {
        litLevel: norm(a / 100000, LIT.min, LIT.max),
        stepPerYear: LIT.maxStep / 2,
        moreShare: 0,
        lessShare: 0,
        changeMix: 0,
      },
      LIT.maxStep,
      tune,
    ),
  facts: (a) => [
    [t("docs.litArea"), `${nf(a / 1000, 3)} %`],
    [t("docs.growthSince2012"), `${nf((a / 100000 / LIT.min - 1) * 100, 1)} %`],
  ],
  haptic: (s) => intensityToVibration(s.litLevel * 0.8),
};

const RHYTHM = {
  "4n": "format.quarterNotes",
  "8n": "format.eighthNotes",
  "16n": "format.sixteenthNotes",
};
let lastChord = null;

function renderCalc() {
  const which = $("#calc-event").value;
  const accent = $("#calc-accent").value;
  const cfg = CALC[which];
  const style = accent === "br" ? cfg.style : null;
  const a = Number($("#calc-a").value);
  const b = cfg.b ? Number($("#calc-b").value) : 0;
  const s = cfg.sound(a, b, tuneOf(style));
  lastChord = s.chord;

  $("#calc-a-out").textContent = `${nf(a)} ${t(cfg.a.unit)}`;
  if (cfg.b) $("#calc-b-out").textContent = `${nf(b, 1)} ${t(cfg.b.unit)}`;

  const band = style
    ? activeLayers(style, s.noteLevel)
        .map((l) => t(l.label))
        .join(", ")
    : t("docs.alwaysThree");
  const rows = [
    [t("docs.ruleLevel"), nf(s.noteLevel, 3)],
    [t("docs.scaleDegree"), `${s.degree} ${t("docs.of")} ${JUKEBOX.steps - 1}`],
    [t("docs.note"), `${t(s.note)} · ${nf(s.pitchHz, 2)} Hz`],
    [t("docs.chord"), `${chordName(s.chord)} (${chordNotes(s.chord)})`],
    [t("docs.key"), t(s.keyName)],
    [t("docs.speed"), nf(s.speed, 3)],
    [
      t("docs.tempo"),
      `${nf(s.bpm)} BPM · ${t("docs.melodyIn")} ${t(RHYTHM[s.arpRate])}`,
    ],
    [t("docs.whoPlays"), band],
    [t("docs.vibration"), cfg.haptic(s).join(" · ") || t("docs.none")],
    ...cfg.facts(a, b),
  ];
  $("#calc-out").innerHTML = rows
    .map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`)
    .join("");
}

function setupCalc() {
  const sync = () => {
    const cfg = CALC[$("#calc-event").value];
    const set = (id, c) => {
      const input = $(`#calc-${id}`);
      const field = input.closest(".calc__field");
      field.hidden = !c;
      if (!c) return;
      Object.assign(input, {
        min: c.min,
        max: c.max,
        step: c.step,
        value: c.value,
      });
      field.querySelector(".calc__label").textContent = t(c.label);
    };
    set("a", cfg.a);
    set("b", cfg.b);
    renderCalc();
  };
  $("#calc-event").addEventListener("change", sync);
  ["#calc-accent", "#calc-a", "#calc-b"].forEach((sel) =>
    $(sel).addEventListener("input", renderCalc),
  );
  sync();

  // Tone is only loaded if someone asks to hear the chord.
  let synth = null;
  $("#calc-play").addEventListener("click", async () => {
    const Tone = await import("tone");
    await Tone.start();
    synth ??= new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "fattriangle", count: 3, spread: 16 },
      envelope: { attack: 0.05, decay: 0.4, sustain: 0.6, release: 1.4 },
      volume: -12,
    }).toDestination();
    const now = Tone.now();
    lastChord.forEach((m, i) =>
      synth.triggerAttackRelease(midiToHz(m), 1.6, now + i * 0.14),
    );
  });
}

// ---------------------------------------------------------------- derived numbers in the text
function renderLamb() {
  const w = lambWave({
    vent: TONGA.vent,
    onset: new Date(TONGA.onset),
    speedMs: TONGA.lambWaveMs,
    place: SAO_PAULO,
    waveKm: 0,
  });
  $("#lamb-km").textContent = nf(w.distanceKm);
  $("#lamb-hours").textContent = nf(w.hours, 1);
  $("#lamb-lap").textContent = nf(w.lapHours, 1);
  $("#lamb-arrival").textContent =
    `${w.arrival.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}


// ---------------------------------------------------------------- EIC frame experiences
const esc = (v) => String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const tag = (kind) =>
  `<span class="tag ${kind === "m" ? "tag--m" : "tag--c"}">${dt(kind === "m" ? "measured" : "calculated")}</span>`;
const EIC_IDS = Object.keys(EIC);

function renderEicDocs() {
  // Overview: one row per experience, and the list of challenge resources used.
  const body = $("#overview-body");
  body.querySelectorAll("tr[data-eic]").forEach((tr) => tr.remove());
  body.insertAdjacentHTML(
    "beforeend",
    EIC_IDS.map((id) => {
      const p = per(id);
      return `<tr data-eic="${id}">
        <td><a href="/eic.html?e=${id}">${esc(et(id, "name"))}</a></td>
        <td>${esc(p.period)}</td>
        <td>${esc(p.source)}</td>
        <td>${esc(p.input)}</td>
        <td>${esc(t(EIC_STYLES[id].name))}</td>
      </tr>`;
    }).join(""),
  );
  const list = ["5313", ...EIC_IDS.map((id) => EIC[id].svs)].map((n) => `SVS ${n}`).join(", ");
  $("#eic-resources").textContent = dt("overviewResources", { list });

  // Section 6: the four experiences, each with the table of what becomes sound.
  $("#eic-docs").innerHTML = `<h3>${esc(dt("title"))}</h3><p>${esc(dt("intro"))}</p>` +
    EIC_IDS.map((id) => {
      const exp = EIC[id];
      const style = EIC_STYLES[id];
      const rows = [
        [et(id, "intensity"), dt("note"), dt("noteOut"), "m"],
        [et(id, "speed"), dt("tempo"), dt("tempoOut"), "c"],
        ...exp.kinds.map((k) => [et(id, `kind.${k.id}.from`), et(id, `kind.${k.id}.to`), "", "m"]),
      ];
      return `<h4 class="eic-h">${esc(et(id, "name"))} <span class="mono">SVS ${exp.svs} · ${esc(t(style.name))}</span></h4>
        <p>${esc(et(id, "about1"))}</p>
        <div class="table-wrap"><table><thead><tr>
          <th>${esc(dt("colInput"))}</th><th>${esc(dt("colOutput"))}</th><th></th><th>${esc(dt("colOrigin"))}</th>
        </tr></thead><tbody>${rows.map(([a, b, c, k]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td><td>${esc(c)}</td><td>${tag(k)}</td></tr>`).join("")}</tbody></table></div>
        <p>${esc(et(id, "about2"))}</p>`;
    }).join("") + `<p class="aside">${esc(et("_", "caveat"))}</p>`;

  // Section 7: which rhythm each plays.
  $("#eic-accents").innerHTML = `<p>${esc(dt("accents"))}</p>`;

  // Section 10: the files behind them.
  const nl = dtNightlights();
  const src = [
    [5313, "Change in Night Lights between 2012 and 2023, EIC Version", nl.file, nl.size, nl.use],
    ...EIC_IDS.map((id) => [SOURCES[id].svs, SOURCES[id].title, SOURCES[id].file, SOURCES[id].size, per(id).use]),
  ];
  $("#eic-sources").innerHTML = `<h3>${esc(dt("sourcesTitle"))}</h3><p>${esc(dt("sourcesIntro"))}</p>
    <div class="table-wrap"><table><thead><tr>
      <th>${esc(dt("colSvs"))}</th><th>${esc(dt("colFile"))}</th><th>${esc(dt("colSize"))}</th><th>${esc(dt("colUse"))}</th>
    </tr></thead><tbody>${src.map(([n, title, file, size, use]) => `<tr>
      <td><a href="https://svs.gsfc.nasa.gov/${n}/" rel="noopener">SVS ${n}</a> · ${esc(title)}</td>
      <td><code>${esc(file)}</code></td><td class="num">${esc(size)}</td><td>${esc(use)}</td></tr>`).join("")}</tbody></table></div>
    <p><b>${esc(dt("notUsedTitle"))}:</b> ${esc(dt("notUsed"))}</p>`;

  // Section 15: references.
  const anchor = $("#eic-refs-anchor");
  document.querySelectorAll("li[data-eic-ref]").forEach((li) => li.remove());
  EIC_IDS.slice().reverse().forEach((id) => {
    const { svs, title, credit } = SOURCES[id];
    anchor.insertAdjacentHTML(
      "afterend",
      `<li data-eic-ref>${esc(dt("refsPrefix"))} ${esc(title)} (SVS ${svs})${credit ? `. ${esc(credit)}` : ""}. <span>svs.gsfc.nasa.gov/${svs}</span></li>`,
    );
  });
}

renderEicDocs();
renderScale();
Object.values(STYLES).forEach(renderStyle);
setupCalc();
renderLamb();

onLanguageChange(() => {
  renderEicDocs();
  renderScale();
  Object.values(STYLES).forEach(renderStyle);
  renderCalc();
});
