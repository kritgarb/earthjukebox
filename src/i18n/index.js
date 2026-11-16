import ptBR from "./locales/pt-BR.json";

// Portuguese is the only catalogue every page actually needs on first paint, and it is small
// (12 KB). English and Spanish are full sentence-level translation dictionaries of every string
// on every page (150 KB and 128 KB uncompressed) — bundling them eagerly used to add ~210 KB
// gzip to *every* page load, even for the near-totality of visits that stay in Portuguese. They
// are now fetched once, lazily, only when a visitor actually asks for that language.
const LOADERS = {
  en: () => import("./locales/en.json"),
  es: () => import("./locales/es.json"),
};

const STORAGE_KEY = "earth-jukebox:language";
// The site always starts in English; a language the visitor picked is remembered and wins.
const DEFAULT_LANGUAGE = "en";
const LOCALES = { "pt-BR": ptBR };
const pendingLoads = new Map();

// Resolves once `language` is in LOCALES (a no-op for pt-BR, already loaded).
function ensureLocale(language) {
  if (LOCALES[language] || !LOADERS[language]) return Promise.resolve();
  let pending = pendingLoads.get(language);
  if (!pending) {
    pending = LOADERS[language]()
      .then((mod) => {
        LOCALES[language] = mod.default ?? mod;
        // Fragment matchers may have been built against the Portuguese fallback while this
        // catalogue was still loading; drop them so they are rebuilt from the real one.
        fragmentLanguage = undefined;
        fragmentCache.clear();
      })
      .catch(() => {
        // Offline or blocked: the UI falls back to Portuguese until it can try again.
        pendingLoads.delete(language);
      });
    pendingLoads.set(language, pending);
  }
  return pending;
}
const ATTRIBUTES = [
  "aria-label",
  "aria-description",
  "aria-valuetext",
  "title",
  "placeholder",
  "alt",
  "content",
  "data-rule",
];
const textSources = new WeakMap();
const attributeSources = new WeakMap();
const listeners = new Set();
let activeLanguage = DEFAULT_LANGUAGE;
let observer;
let fragmentLanguage;
let announcedLanguage;
let fragmentMatchers = [];

const normalizeText = (value) => value.trim().replace(/\s+/g, " ");
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// The catalogue for `language`, falling back to Portuguese while a lazy import is still in
// flight (or failed): text stays readable, just untranslated, until the fetch resolves.
function catalogFor(language) {
  return LOCALES[language] ?? LOCALES["pt-BR"];
}

function getFragmentMatchers() {
  if (fragmentLanguage === activeLanguage) return fragmentMatchers;
  fragmentLanguage = activeLanguage;
  const catalog = catalogFor(activeLanguage);
  fragmentMatchers = [catalog.source, catalog.messages]
    .flatMap((dictionary) => Object.entries(dictionary))
    .filter(([source]) => normalizeText(source).length >= 14)
    .sort(([a], [b]) => b.length - a.length)
    .map(([source, translated]) => ({
      pattern: new RegExp(
        normalizeText(source).split(" ").map(escapeRegExp).join("\\s+"),
        "g",
      ),
      translated,
      // A sentence can only be in a text that has its first word: a plain search for it rules
      // out nearly every sentence without running its regular expression.
      first: normalizeText(source).split(" ")[0],
    }));
  return fragmentMatchers;
}

function supportedLanguage(language, fallback = "pt-BR") {
  return Object.hasOwn(LOCALES, language) || Object.hasOwn(LOADERS, language)
    ? language
    : fallback;
}

// Text that is not a whole entry of the catalogue is searched for known sentences inside it: one
// regular expression per sentence (over a thousand). The panels write new numbers on every frame,
// so the answer for each string is kept, and a string shorter than the shortest sentence searched
// for (14 characters) is not searched at all.
const fragmentCache = new Map();
let fragmentCacheLanguage;
function translateFragments(text) {
  if (text.length < 14) return text;
  if (fragmentCacheLanguage !== activeLanguage || fragmentCache.size > 4000) {
    fragmentCache.clear();
    fragmentCacheLanguage = activeLanguage;
  }
  let translated = fragmentCache.get(text);
  if (translated === undefined) {
    translated = text;
    for (const fragment of getFragmentMatchers()) {
      if (!translated.includes(fragment.first)) continue;
      translated = translated.replace(fragment.pattern, () => fragment.translated);
    }
    fragmentCache.set(text, translated);
  }
  return translated;
}

function translateTextNode(node) {
  const previous = textSources.get(node);
  const source =
    previous && node.nodeValue === previous.rendered
      ? previous.source
      : node.nodeValue;
  const trimmed = source.trim();
  const key = normalizeText(trimmed);
  const active = catalogFor(activeLanguage);
  let translated = active.source[key] ?? active.messages[key] ?? trimmed;
  if (translated === trimmed) translated = translateFragments(trimmed);
  const start = source.indexOf(trimmed);
  const rendered = `${source.slice(0, start)}${translated}${source.slice(start + trimmed.length)}`;
  textSources.set(node, { source, rendered });
  if (node.nodeValue !== rendered) node.nodeValue = rendered;
}

function translateElement(element) {
  const attrs = attributeSources.get(element) ?? new Map();
  for (const name of ATTRIBUTES) {
    if (!element.hasAttribute(name)) continue;
    const current = element.getAttribute(name);
    const previous = attrs.get(name);
    const source =
      previous && current === previous.rendered ? previous.source : current;
    const trimmed = source.trim();
    const key = normalizeText(trimmed);
    const active = catalogFor(activeLanguage);
    const translated = active.source[key] ?? active.messages[key] ?? trimmed;
    const start = source.indexOf(trimmed);
    const rendered = `${source.slice(0, start)}${translated}${source.slice(start + trimmed.length)}`;
    attrs.set(name, { source, rendered });
    if (current !== rendered) element.setAttribute(name, rendered);
  }
  attributeSources.set(element, attrs);
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) translateTextNode(walker.currentNode);
}

function translateDocument(root = document.body) {
  if (!root) return;
  if (root.nodeType === Node.ELEMENT_NODE) translateElement(root);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  while (walker.nextNode()) translateElement(walker.currentNode);
}

function installObserver() {
  if (observer || !document.body) return;
  observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === "childList") {
        record.addedNodes.forEach((node) => {
          if (node.nodeType === Node.TEXT_NODE) translateTextNode(node);
          else if (node.nodeType === Node.ELEMENT_NODE) translateDocument(node);
        });
      } else if (record.type === "attributes") {
        translateElement(record.target);
      }
    }
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ATTRIBUTES,
  });
  observer.observe(document.head, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ATTRIBUTES,
  });
}

// Extra sources of text (the EIC experiences keep theirs in i18n/eicText.js): each resolver gets
// the key and the language and answers a string or undefined.
const resolvers = [];
export const registerResolver = (fn) => resolvers.push(fn);

export function t(key, variables = {}) {
  const active = catalogFor(activeLanguage);
  let value =
    active.messages[key] ?? active.source[key] ?? LOCALES["pt-BR"].messages[key] ?? key;
  if (value === key) {
    for (const resolve of resolvers) {
      const found = resolve(key, activeLanguage);
      if (found != null) {
        value = found;
        break;
      }
    }
  }
  if (value === key && activeLanguage !== "pt-BR") {
    const note = /^(Dó|Ré|Mi|Fá|Sol|Lá|Si)([#b]?)(-?\d+)?$/.exec(key);
    if (note) {
      const names =
        activeLanguage === "en"
          ? { Dó: "C", Ré: "D", Mi: "E", Fá: "F", Sol: "G", Lá: "A", Si: "B" }
          : {
              Dó: "Do",
              Ré: "Re",
              Mi: "Mi",
              Fá: "Fa",
              Sol: "Sol",
              Lá: "La",
              Si: "Si",
            };
      value = `${names[note[1]]}${note[2]}${note[3] ?? ""}`;
    }
  }
  for (const [name, replacement] of Object.entries(variables)) {
    value = value.replaceAll(`{${name}}`, String(replacement));
  }
  return value;
}

export function getLanguage() {
  return activeLanguage;
}

export async function setLanguage(language) {
  const chosen = (activeLanguage = supportedLanguage(language));
  document.documentElement.lang = activeLanguage;
  try {
    localStorage.setItem(STORAGE_KEY, activeLanguage);
  } catch {
    // The preference remains active for the current page if storage is unavailable.
  }
  const selector = document.querySelector("#language-select");
  if (selector) selector.value = activeLanguage;
  // Portuguese (and a language already fetched once) translates immediately; the first switch
  // to English or Spanish shows Portuguese for a moment while its catalogue is fetched, then
  // re-translates the instant it lands, instead of blocking the switch on the network.
  translateDocument();
  translateDocument(document.head);
  listeners.forEach((listener) => listener(activeLanguage));
  await ensureLocale(chosen);
  if (activeLanguage !== chosen) return; // a newer choice arrived while this one was loading
  translateDocument();
  translateDocument(document.head);
  listeners.forEach((listener) => listener(activeLanguage));
}

export function onLanguageChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function initI18n() {
  let storedLanguage = DEFAULT_LANGUAGE;
  try {
    storedLanguage = localStorage.getItem(STORAGE_KEY) ?? DEFAULT_LANGUAGE;
  } catch {
    // Continue with the default language when storage is unavailable.
  }
  activeLanguage = supportedLanguage(storedLanguage, DEFAULT_LANGUAGE);
  document.documentElement.lang = activeLanguage;
  translateDocument();
  translateDocument(document.head);
  installObserver();
  // A returning visitor who had picked English or Spanish sees Portuguese for a moment while
  // that catalogue is fetched (it is not bundled), then the page re-translates once it lands.
  if (activeLanguage !== "pt-BR") {
    const language = activeLanguage;
    ensureLocale(language).then(() => {
      if (activeLanguage !== language) return;
      translateDocument();
      translateDocument(document.head);
      // Whatever was written with t() before the catalogue landed came out in Portuguese (the
      // panels, the band, the back link): the views are told, as on a change of language, so
      // they write it again. Once per language: initI18n runs from more than one module.
      if (announcedLanguage === language || !LOCALES[language]) return;
      announcedLanguage = language;
      listeners.forEach((listener) => listener(language));
    });
  }
}

initI18n();
