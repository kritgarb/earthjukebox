import { ht } from "../i18n/eicHomeText.js";

// Turns a list of cards into a carousel: the list becomes a scroll-snap track and prev/next
// buttons plus a "1–2 of 9" counter are added to the controls slot. Without JS the list stays a
// plain grid. Call update() after the cards change (a language switch rebuilds them).
//   list:     the <ul> of cards; labelledBy: id of the heading that names the carousel.
//   autoplay: milliseconds between automatic moves (0 = off). It loops forever, pauses while the
//             pointer or focus is inside, while the tab or the carousel is out of view, and
//             starts paused for people who asked for reduced motion; a button pauses it for good.
export function createCarousel(list, { labelledBy, autoplay = 0 }) {
  const group = document.getElementById(labelledBy).closest("div").parentElement;
  const slot = group.querySelector("[data-carousel-controls]");

  list.className = "carousel";
  const region = document.createElement("div");
  // flow-root: the track's negative margin must not leak out and shrink the gap below.
  region.className = "flow-root";
  region.setAttribute("role", "group");
  region.setAttribute("aria-labelledby", labelledBy);
  list.replaceWith(region);
  region.append(list);

  const button = (dir, glyph) => {
    const b = document.createElement("button");
    b.type = "button";
    b.setAttribute("aria-controls", list.id);
    b.className =
      "inline-flex h-12 w-12 items-center justify-center rounded-full border border-fog text-xl font-bold text-white transition hover:border-brand-yellow hover:text-brand-yellow focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#ffd23f] aria-disabled:cursor-default aria-disabled:opacity-35 aria-disabled:hover:border-fog aria-disabled:hover:text-white";
    b.innerHTML = `<span aria-hidden="true">${glyph}</span>`;
    b.addEventListener("click", () => {
      if (b.getAttribute("aria-disabled") === "true") return;
      go(dir);
    });
    return b;
  };
  const prev = button(-1, "←");
  const next = button(1, "→");
  const status = document.createElement("span");
  status.className = "min-w-[5ch] text-center font-mono text-sm text-fog";
  status.setAttribute("aria-live", "polite");
  const bar = document.createElement("div");
  bar.className = "flex items-center gap-3";
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = button(0, "").className;
  if (autoplay) bar.append(prev, status, next, toggle);
  else bar.append(prev, status, next);
  slot.replaceChildren(bar);

  const cards = () => [...list.children];
  const reduced = () =>
    document.documentElement.dataset.reducedMotion === "true" ||
    matchMedia("(prefers-reduced-motion: reduce)").matches;

  // One click moves by the number of cards in view.
  function go(dir) {
    const [first, second] = cards();
    const step = second ? second.offsetLeft - first.offsetLeft : first.offsetWidth;
    const perPage = Math.max(1, Math.round(list.clientWidth / step));
    const behavior = reduced() ? "auto" : "smooth";
    const atEnd = list.scrollLeft + list.clientWidth >= list.scrollWidth - 1;
    // Past either end the carousel wraps around instead of stopping.
    if (dir > 0 && atEnd) list.scrollTo({ left: 0, behavior });
    else if (dir < 0 && list.scrollLeft <= 1) list.scrollTo({ left: list.scrollWidth, behavior });
    else list.scrollBy({ left: dir * perPage * step, behavior });
  }

  // Automatic rotation.
  let userPaused = reduced();
  let hovering = false;
  let focusing = false;
  let offscreen = true;
  let timer = null;
  let touchHold;
  function schedule() {
    clearInterval(timer);
    timer = null;
    const overflow = list.scrollWidth > list.clientWidth + 1;
    const run =
      autoplay && overflow && !userPaused && !hovering && !focusing && !offscreen && !document.hidden;
    if (run) timer = setInterval(() => go(1), autoplay);
    // A rotating carousel must not announce every move to a screen reader.
    status.setAttribute("aria-live", run ? "off" : "polite");
  }
  toggle.addEventListener("click", () => {
    userPaused = !userPaused;
    update();
    schedule();
  });
  region.addEventListener("pointerenter", (e) => {
    if (e.pointerType === "mouse") {
      hovering = true;
      schedule();
    }
  });
  region.addEventListener("pointerleave", (e) => {
    if (e.pointerType === "mouse") {
      hovering = false;
      schedule();
    }
  });
  region.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "touch") return;
    // After a swipe the carousel waits a while before rotating again.
    hovering = true;
    clearTimeout(touchHold);
    touchHold = setTimeout(() => {
      hovering = false;
      schedule();
    }, 8000);
    schedule();
  });
  region.addEventListener("focusin", () => {
    focusing = true;
    schedule();
  });
  region.addEventListener("focusout", (e) => {
    if (region.contains(e.relatedTarget) || slot.contains(e.relatedTarget)) return;
    focusing = false;
    schedule();
  });
  slot.addEventListener("focusin", () => {
    focusing = true;
    schedule();
  });
  new IntersectionObserver(([entry]) => {
    offscreen = !entry.isIntersecting;
    schedule();
  }).observe(region);
  document.addEventListener("visibilitychange", schedule);

  let said;
  function update() {
    const items = cards();
    const overflow = list.scrollWidth > list.clientWidth + 1;
    slot.hidden = !overflow;
    region.setAttribute("aria-roledescription", ht("_").carousel);
    prev.setAttribute("aria-label", ht("_").prev);
    next.setAttribute("aria-label", ht("_").next);
    toggle.setAttribute("aria-label", ht("_")[userPaused ? "play" : "pause"]);
    toggle.setAttribute("aria-pressed", String(!userPaused));
    toggle.innerHTML = `<span aria-hidden="true">${userPaused ? "▶" : "❚❚"}</span>`;
    const box = list.getBoundingClientRect();
    const visible = items
      .map((el, i) => ({ i, r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.left >= box.left - 4 && r.right <= box.right + 4)
      .map(({ i }) => i + 1);
    if (!visible.length) return;
    const range = visible.length > 1 ? `${visible[0]}–${visible.at(-1)}` : `${visible[0]}`;
    const text = `${range} ${ht("_").of} ${items.length}`;
    // Announced only once scrolling settles, so a swipe is not read card by card.
    if (status.textContent !== text) {
      clearTimeout(said);
      said = setTimeout(() => (status.textContent = text), status.textContent ? 250 : 0);
    }
  }

  list.addEventListener("scroll", update, { passive: true });
  new ResizeObserver(() => (update(), schedule())).observe(list);
  new MutationObserver(() => {
    // The reduced-motion switch of the accessibility bar stops (or lets one start) the rotation.
    if (reduced()) userPaused = true;
    update();
    schedule();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-reduced-motion"] });
  update();
  schedule();
  return { update: () => (update(), schedule()) };
}
