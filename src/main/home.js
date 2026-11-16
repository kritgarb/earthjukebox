import { initI18n, onLanguageChange } from "../i18n/index.js";
import { EIC } from "../config/eic.js";
import { et } from "../i18n/eicText.js";
import { ht } from "../i18n/eicHomeText.js";
import { createCarousel } from "../components/carousel.js";

initI18n();

// The cards of the experiences made of NASA EIC frames, built from the same texts the pages use.
// Class names are written out in full so Tailwind finds them.
const LOOK = {
  lightning: { card: "bg-brand-yellow", tag: "text-brand-yellow" },
  co2: { card: "bg-brand-blue-100", tag: "text-brand-blue-100" },
  gedi: { card: "bg-brand-green", tag: "text-brand-green" },
  aerosols: { card: "bg-brand-yellow", tag: "text-brand-yellow" },
  sst: { card: "bg-brand-green", tag: "text-brand-green" },
  airquality: { card: "bg-brand-blue-100", tag: "text-brand-blue-100" },
  ocean: { card: "bg-brand-yellow", tag: "text-brand-yellow" },
  river: { card: "bg-brand-green", tag: "text-brand-green" },
};
const esc = (v) => String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

function card(id) {
  const h = ht(id);
  const look = LOOK[id];
  return `<li data-eic>
    <a
      class="flex h-full flex-col font-prose min-[1181px]:min-h-[655px] rounded-card ${look.card} p-[10px] text-night-ink no-underline transition [transition-property:transform,box-shadow] hover:-translate-y-1 hover:shadow-[0_12px_32px_#0005] focus-visible:-translate-y-1 focus-visible:shadow-[0_12px_32px_#0005] max-[640px]:min-h-0"
      href="/eic.html?e=${id}"
    >
      <span class="mb-[10px] block aspect-[1.45] overflow-hidden rounded-card-media bg-navy-900 max-[640px]:aspect-[1.8]">
        <img class="block h-full w-full object-cover" src="/img/cards/${id}.webp" alt="${esc(h.alt)}" loading="lazy" />
      </span>
      <span class="mt-4 mb-[7px] inline-block self-start rounded-full bg-navy-900 px-3 py-[5px] text-[12.5px] font-bold ${look.tag}">${esc(h.tag)}</span>
      <span class="font-head text-[36px] font-bold leading-[1.1] text-deep-space">${esc(et(id, "title"))}</span>
      <span class="mt-[7px] text-sm leading-[1.5] text-deep-space">${esc(h.meta)}</span>
      <span class="mt-[7px] border-b border-dashed border-[#10172970] py-[7px] text-sm leading-[1.5] text-deep-space">${esc(h.desc)}</span>
      <span class="mt-[7px] text-sm leading-[1.5] text-deep-space">${h.accent}</span>
      <span class="mb-4 mt-[7px] text-sm leading-[1.5] text-deep-space">${esc(h.source)}</span>
      <span class="mt-auto flex w-fit items-center justify-between gap-4 self-start rounded-full bg-navy-900 px-[26px] py-[13px] text-[15px] font-bold text-white">${esc(et("_", "enter"))} <span aria-hidden="true">→</span></span>
    </a>
  </li>`;
}

// Which experiences are a 3D scene (Three.js) and which are 2D frames read pixel by pixel.
const KIND = { "/helene.html": "3d", "/tonga.html": "3d", "/nightlights.html": "2d" };
const kindOf = (a) => KIND[a.getAttribute("href")] ?? (a.getAttribute("href").startsWith("/eic.html") ? "2d" : null);

function badges() {
  document.querySelectorAll("#fenomenos li > a").forEach((a) => {
    const kind = kindOf(a);
    const media = a.querySelector("span.block");
    if (!kind || !media) return;
    media.classList.add("relative");
    media.querySelector("[data-badge]")?.remove();
    const text = ht("_")[kind === "3d" ? "badge3d" : "badge2d"];
    media.insertAdjacentHTML(
      "beforeend",
      `<span data-badge="${kind}" class="absolute left-3 top-3 rounded-full bg-navy-900 px-3 py-[5px] font-mono text-[12px] font-bold text-white">${esc(text)}</span>`,
    );
  });
}

function render() {
  const list = document.getElementById("eic-cards");
  list.querySelectorAll("li[data-eic]").forEach((li) => li.remove());
  list.insertAdjacentHTML("beforeend", Object.keys(LOOK).map(card).join(""));
  document.getElementById("eic-home-legend").textContent = ht("_").legend;
  badges();
}

const carousels = [
  createCarousel(document.getElementById("eic-cards"), { labelledBy: "group-eic", autoplay: 5000 }),
  createCarousel(document.getElementById("event-cards"), { labelledBy: "group-events", autoplay: 5000 }),
];

const renderAll = () => {
  render();
  carousels.forEach((c) => c.update());
};
renderAll();
onLanguageChange(renderAll);
