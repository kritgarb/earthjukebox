import { Narrator } from "../views/sensory/Narrator.js";
import { t } from "../i18n/index.js";

// Narrates a page as it is scrolled, for people who browse by listening. Whatever crosses the
// reading band (the middle of the screen) is read once, in page order: headings, paragraphs and
// the cards of a list. Content that scrolls past before its turn is skipped, since saying it
// late would describe something no longer on screen. Scrolling back reads it again.

const UNITS = "h1, h2, h3, p, li";
const BAND = "-30% 0px -40% 0px";

const clean = (text) =>
  text
    .replace(/\s+/g, " ")
    .replaceAll(" · ", ". ")
    .replaceAll("→", " para ")
    .trim();

function isNarratable(el) {
  if (el.closest("[aria-hidden='true'], [data-site-header], [hidden], .skip, footer")) return false;
  // Headings and paragraphs inside a list item or a link are read as part of it.
  if (el.matches("h1, h2, h3, p") && el.closest("li, a")) return false;
  return true;
}

function textOf(el) {
  const alts = [...el.querySelectorAll("img[alt]")].map((img) => img.alt.trim()).filter(Boolean);
  return clean([...alts, el.innerText].join(". ")).replace(/^\. /, "");
}

export function createScrollNarrator(root = document.querySelector("main")) {
  const narrator = new Narrator();
  const inBand = new Set();
  const spoken = new Set();
  let observer = null;
  let pumping = false;

  const byPageOrder = (a, b) =>
    a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;

  async function pump() {
    if (pumping) return;
    pumping = true;
    while (observer) {
      const next = [...inBand].sort(byPageOrder).find((el) => !spoken.has(el));
      if (!next) break;
      spoken.add(next);
      const text = textOf(next);
      if (text) await narrator.say(text, { lang: document.documentElement.lang, volume: 1 });
    }
    pumping = false;
  }

  function observe() {
    observer = new IntersectionObserver(
      (entries) => {
        for (const { target, isIntersecting } of entries) {
          if (isIntersecting) inBand.add(target);
          else {
            inBand.delete(target);
            spoken.delete(target);
          }
        }
        pump();
      },
      { rootMargin: BAND },
    );
    [...root.querySelectorAll(UNITS)].filter(isNarratable).forEach((el) => observer.observe(el));
  }

  return {
    start() {
      if (observer) return;
      narrator.say(t("common.narrationOn"), { lang: document.documentElement.lang, volume: 1 });
      observe();
    },
    stop() {
      observer?.disconnect();
      observer = null;
      inBand.clear();
      spoken.clear();
      narrator.cancel();
      pumping = false;
    },
  };
}
