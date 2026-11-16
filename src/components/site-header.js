import { getLanguage, setLanguage } from "../i18n/index.js";
import { createScrollNarrator } from "./scroll-narrator.js";

const HEADER = `
  <div class="grid gap-3">
    <div
      class="flex flex-wrap items-center justify-start gap-x-3 gap-y-2 px-[clamp(16px,3vw,40px)]"
      role="group"
      aria-labelledby="a11y-bar-label"
      data-ej-a11y-bar
      id="a11y-bar"
    >
      <span class="mr-1 text-base font-medium text-white after:content-[':']" id="a11y-bar-label">Acessibilidade</span>

      <button
        class="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-fog px-4 text-[13px] font-bold leading-normal text-white hover:border-brand-yellow hover:text-brand-yellow focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#ffd23f]"
        type="button"
        data-font-step="-1"
        aria-label="Diminuir fonte"
      >A−</button>

        <button
        class="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-fog px-4 text-[13px] font-bold leading-normal text-white hover:border-brand-yellow hover:text-brand-yellow focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#ffd23f]"
        type="button"
        data-font-step="0"
        id="font-size-value"
        aria-label="Restaurar tamanho normal da fonte"
        title="Restaurar tamanho normal"
        >A</button>

    <button
        class="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-fog px-4 text-[13px] font-bold leading-normal text-white hover:border-brand-yellow hover:text-brand-yellow focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#ffd23f]"
        type="button"
        data-font-step="1"
        aria-label="Aumentar fonte"
      >A+</button>

      <button
        class="inline-flex min-h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border border-fog px-4 text-[13px] font-bold leading-normal text-white hover:border-brand-yellow hover:text-brand-yellow focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#ffd23f] aria-pressed:border-brand-yellow aria-pressed:text-brand-yellow"
        id="motion-toggle"
        type="button"
        aria-pressed="false"
      ><span>Reduzir movimento</span><span aria-hidden="true">·</span><span id="motion-state">OFF</span></button>

      <button
        class="inline-flex min-h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border px-4 text-[13px] font-bold leading-normal focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#ffd23f] !border-brand-yellow !bg-brand-yellow !text-deep-space hover:brightness-110"
        id="narrator-toggle"
        type="button"
        aria-pressed="false"
      ><span>Narração em voz</span><span aria-hidden="true">·</span><span id="narrator-state">OFF</span></button>
    </div>

    <header
      data-ej-header
      class="flex flex-wrap items-center justify-between gap-x-8 gap-y-4 rounded-[56px] border border-[rgba(185,197,225,0.35)] px-[clamp(16px,3vw,40px)] py-4 max-[1180px]:rounded-[24px]"
    >
      <a
        class="flex shrink-0 items-center gap-4 whitespace-nowrap text-xl font-bold tracking-[0.04em] text-white no-underline focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#ffd23f]"
        href="/"
        aria-label="Earth Jukebox — início"
      >
        <img
          class="h-12 w-auto object-contain"
          src="/img/logo/complete_logo.webp"
          alt=""
        />
        <span class="ej-wordmark">EARTH JUKEBOX</span>
      </a>

      <div class="ej-actions hidden items-center gap-3">
      <button
        class="ej-a11y-toggle inline-flex h-12 w-12 items-center justify-center rounded-full border border-fog text-white hover:border-brand-yellow hover:text-brand-yellow focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#ffd23f]"
        id="a11y-toggle"
        type="button"
        aria-expanded="false"
        aria-controls="a11y-bar"
        aria-label="Acessibilidade"
      >
        <svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="4.5" r="1.8"/>
          <path d="M5 8.5c4.5 1.4 9.5 1.4 14 0M12 9v5M12 14l-3.5 6M12 14l3.5 6"/>
        </svg>
      </button>
      <button
        class="ej-menu-toggle min-h-12 min-w-12 items-center justify-center rounded-full border border-fog text-white hover:border-brand-yellow hover:text-brand-yellow focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#ffd23f]"
        id="menu-toggle"
        type="button"
        aria-expanded="false"
        aria-controls="site-nav"
        aria-label="Menu"
      >
        <svg class="h-5 w-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
          <path class="ej-menu-icon-open" d="M3 5h14M3 10h14M3 15h14"/>
          <path class="ej-menu-icon-close" d="M4 4l12 12M16 4 4 16"/>
        </svg>
      </button>
      </div>

      <nav
        class="ej-nav flex flex-1 flex-wrap items-center justify-end gap-x-[clamp(12px,2vw,28px)] gap-y-3 max-[1180px]:w-full max-[1180px]:justify-between"
        id="site-nav"
        aria-label="Navegação principal"
      >
        <a class="inline-flex min-h-11 items-center whitespace-nowrap text-[clamp(14px,1.2vw,18px)] font-bold text-white no-underline hover:text-brand-yellow focus-visible:text-brand-yellow focus-visible:underline focus-visible:underline-offset-4 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#ffd23f]" href="/#sobre">
          Sobre o projeto
        </a>
        <a class="inline-flex min-h-11 items-center whitespace-nowrap text-[clamp(14px,1.2vw,18px)] font-bold text-white no-underline hover:text-brand-yellow focus-visible:text-brand-yellow focus-visible:underline focus-visible:underline-offset-4 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#ffd23f]" href="/#como-funciona">
          Como funciona
        </a>
        <a class="inline-flex min-h-11 items-center whitespace-nowrap text-[clamp(14px,1.2vw,18px)] font-bold text-white no-underline hover:text-brand-yellow focus-visible:text-brand-yellow focus-visible:underline focus-visible:underline-offset-4 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#ffd23f]" href="/#fenomenos">
          Fenômenos
        </a>

        <div class="relative shrink-0">
          <label class="sr-only" for="language-select">Idioma</label>
          <select
            class="ej-language min-h-11 min-w-[104px] cursor-pointer appearance-none rounded-full border border-fog bg-transparent py-2 pl-5 pr-10 text-base font-bold text-white hover:border-brand-yellow focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#ffd23f]"
            id="language-select"
            aria-label="Idioma"
          >
            <option class="bg-[#101729] text-white" value="pt-BR">PT</option>
            <option class="bg-[#101729] text-white" value="en">EN</option>
            <option class="bg-[#101729] text-white" value="es">ES</option>
          </select>
          <svg class="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 6 5 5 5-5"/></svg>
        </div>

        <div class="ej-access-menu">
          <button
            class="min-h-11 shrink-0 whitespace-nowrap rounded-full border border-fog px-8 py-2 text-base font-bold leading-normal text-white hover:border-brand-yellow hover:text-brand-yellow focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#ffd23f]"
            id="accessibility-toggle"
            type="button"
            aria-expanded="false"
            aria-controls="accessibility-panel"
          >Atalhos</button>

          <section
            class="ej-access-panel fixed right-4 top-[100px] z-[10000] hidden max-h-[calc(100dvh-24px)] w-[340px] max-w-[calc(100vw-24px)] overflow-y-auto rounded-[18px] border border-[#5d6a8e] bg-[#0b1229] p-6 text-white shadow-[0_12px_32px_#0007]"
            id="accessibility-panel"
            aria-labelledby="shortcuts-title"
            hidden
          >
            <h2 class="mb-4 mt-0 border-b border-[#293450] pb-4 text-[28px] font-bold leading-tight" id="shortcuts-title">Atalhos de teclado</h2>
            <dl class="m-0 grid gap-2">
              <div class="flex items-center gap-3">
                <dt class="grid h-[30px] w-[92px] shrink-0 place-items-center rounded-xl border border-fog bg-navy-800 text-[13px] font-bold text-white">Espaço</dt>
                <dd class="m-0 text-sm text-fog">Tocar ou pausar</dd>
              </div>
              <div class="flex items-center gap-3">
                <dt class="grid h-[30px] w-[92px] shrink-0 place-items-center rounded-xl border border-fog bg-navy-800 text-[13px] font-bold text-white">← / →</dt>
                <dd class="m-0 text-sm text-fog">Voltar / avançar 1 hora</dd>
              </div>
              <div class="flex items-center gap-3">
                <dt class="grid h-[30px] w-[92px] shrink-0 place-items-center rounded-xl border border-fog bg-navy-800 text-[13px] font-bold text-white">1 2 3</dt>
                <dd class="m-0 text-sm text-fog">Alternar câmeras</dd>
              </div>
              <div class="flex items-center gap-3">
                <dt class="grid h-[30px] w-[92px] shrink-0 place-items-center rounded-xl border border-fog bg-navy-800 text-[13px] font-bold text-white">H</dt>
                <dd class="m-0 text-sm text-fog">Mostrar / ocultar painéis</dd>
              </div>
              <div class="flex items-center gap-3">
                <dt class="grid h-[30px] w-[92px] shrink-0 place-items-center rounded-xl border border-fog bg-navy-800 text-[13px] font-bold text-white">M</dt>
                <dd class="m-0 text-sm text-fog">Ligar / desligar som</dd>
              </div>
              <div class="flex items-center gap-3">
                <dt class="grid h-[30px] w-[92px] shrink-0 place-items-center rounded-xl border border-fog bg-navy-800 text-[13px] font-bold text-white">B</dt>
                <dd class="m-0 text-sm text-fog">Alternar sotaque musical</dd>
              </div>
              <div class="flex items-center gap-3">
                <dt class="grid h-[30px] w-[92px] shrink-0 place-items-center rounded-xl border border-fog bg-navy-800 text-[13px] font-bold text-white">N</dt>
                <dd class="m-0 text-sm text-fog">Ligar / desligar narração</dd>
              </div>
            </dl>
            <p class="mb-0 mt-4 text-sm leading-normal text-fog">Tab: navegar · Enter: ativar<br />Use os atalhos com o foco na experiência.</p>
          </section>
        </div>
      </nav>
    </header>
  </div>
`;

const STORAGE = {
  language: "earth-jukebox:language",
  fontScale: "earth-jukebox:font-scale",
  reducedMotion: "earth-jukebox:reduced-motion",
  narrator: "earth-jukebox:narrator",
};

const FONT_SCALES = [0.9, 1, 1.1, 1.2, 1.3];

function getPreference(key, fallback) {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function savePreference(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Mantém a preferência ativa até sair desta página.
  }
}

function loadVlibras() {
  if (document.querySelector("[data-vlibras-script]")) return;

  const script = document.createElement("script");
  script.src = "https://vlibras.gov.br/app/vlibras-plugin.js";
  script.async = true;
  script.dataset.vlibrasScript = "true";
  document.body.append(script);
}

function setupAccessibility(header) {
  const panel = header.querySelector("#accessibility-panel");
  const menuButton = header.querySelector("#accessibility-toggle");
  const languageSelect = header.querySelector("#language-select");
  const motionButton = header.querySelector("#motion-toggle");
  const fontOutput = header.querySelector("#font-size-value");
  const navToggle = header.querySelector("#menu-toggle");
  const nav = header.querySelector("#site-nav");
  const a11yToggle = header.querySelector("#a11y-toggle");
  const a11yBar = header.querySelector("#a11y-bar");

  // Telas estreitas: a barra de acessibilidade fica recolhida e abre pelo ícone do header.
  function setA11yBarOpen(open, returnFocus = false) {
    a11yBar.classList.toggle("is-open", open);
    a11yToggle.setAttribute("aria-expanded", String(open));
    if (!open && returnFocus) a11yToggle.focus();
  }
  a11yToggle.addEventListener("click", () =>
    setA11yBarOpen(a11yToggle.getAttribute("aria-expanded") !== "true"),
  );

  // Menu hambúrguer (só aparece em telas estreitas; o CSS esconde a nav enquanto fechado).
  function setNavOpen(open, returnFocus = false) {
    nav.classList.toggle("is-open", open);
    navToggle.setAttribute("aria-expanded", String(open));
    if (!open && returnFocus) navToggle.focus();
  }
  navToggle.addEventListener("click", () =>
    setNavOpen(navToggle.getAttribute("aria-expanded") !== "true"),
  );
  nav.addEventListener("click", (event) => {
    if (event.target.closest("a")) setNavOpen(false);
  });

  let fontScale = Number(getPreference(STORAGE.fontScale, "1"));
  if (!FONT_SCALES.includes(fontScale)) fontScale = 1;

  function updateFontSize() {
    document.body.style.zoom = String(fontScale);
    // Viewport units are measured in zoomed pixels, so full-height layouts divide by this.
    document.documentElement.style.setProperty("--ui-zoom", String(fontScale));
  }

  function positionPanel() {
    if (panel.hidden) return;

    const buttonRect = menuButton.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const maxRight = window.innerWidth - panelRect.width - 12;
    const right = Math.min(
      Math.max(12, window.innerWidth - buttonRect.right),
      maxRight,
    );
    const maxTop = window.innerHeight - panelRect.height - 12;
    const top = Math.max(12, Math.min(buttonRect.bottom + 10, maxTop));

    panel.style.top = `${top}px`;
    panel.style.right = `${right}px`;
    panel.style.left = "auto";
  }

  function setPanelOpen(open) {
    panel.hidden = !open;
    panel.classList.toggle("hidden", !open);
    menuButton.setAttribute("aria-expanded", String(open));

    if (open) {
      requestAnimationFrame(() => {
        positionPanel();
        panel.querySelector("button")?.focus();
      });
    }
  }

  function updateReducedMotion(enabled) {
    document.documentElement.dataset.reducedMotion = String(enabled);
    header.querySelector("#motion-state").textContent = enabled ? "ON" : "OFF";
    motionButton.setAttribute("aria-pressed", String(enabled));
    savePreference(STORAGE.reducedMotion, String(enabled));
  }

  // Narração: nas páginas de experiência o controlador é dono do estado: o clique vira o evento
  // "earth-jukebox:narrator-toggle" e o estado volta por "earth-jukebox:narrator-state". Nas demais
  // páginas (Home, docs) guardamos a preferência, que a experiência lê ao abrir.
  const narratorButton = header.querySelector("#narrator-toggle");
  const isExperience = document.body.classList.contains("page-sintonize");

  function showNarrator(on) {
    narratorButton.setAttribute("aria-pressed", String(on));
    header.querySelector("#narrator-state").textContent = on ? "ON" : "OFF";
  }

  showNarrator(
    isExperience
      ? document.documentElement.dataset.narrator === "on"
      : getPreference(STORAGE.narrator, "off") === "on",
  );
  addEventListener("earth-jukebox:narrator-state", (e) =>
    showNarrator(e.detail),
  );

  // Fora das experiências (Home, docs) a narração acompanha a rolagem da página.
  const scrollNarrator = isExperience ? null : createScrollNarrator();
  if (scrollNarrator && getPreference(STORAGE.narrator, "off") === "on") {
    // O navegador só deixa uma página nova falar depois de um gesto do usuário.
    const arm = () => {
      removeEventListener("pointerdown", arm);
      removeEventListener("keydown", arm);
      removeEventListener("touchend", arm);
      if (narratorButton.getAttribute("aria-pressed") === "true")
        scrollNarrator.start();
    };
    addEventListener("pointerdown", arm);
    addEventListener("keydown", arm);
    addEventListener("touchend", arm);
  }

  narratorButton.addEventListener("click", () => {
    if (isExperience) {
      dispatchEvent(new CustomEvent("earth-jukebox:narrator-toggle"));
      return;
    }
    const on = narratorButton.getAttribute("aria-pressed") !== "true";
    savePreference(STORAGE.narrator, on ? "on" : "off");
    showNarrator(on);
    if (on) scrollNarrator?.start();
    else scrollNarrator?.stop();
  });

  languageSelect.value = getLanguage();
  updateFontSize();
  // O modo de contraste claro foi retirado (só vale a paleta do Figma): limpa a preferência antiga.
  try {
    localStorage.removeItem("earth-jukebox:contrast");
  } catch {
    // sem localStorage, nada a limpar
  }
  delete document.documentElement.dataset.contrast;
  updateReducedMotion(getPreference(STORAGE.reducedMotion, "false") === "true");

  menuButton.addEventListener("click", () => {
    setPanelOpen(panel.hidden);
  });

  window.addEventListener("resize", positionPanel);
  window.addEventListener("scroll", positionPanel, true);

  document.addEventListener("click", (event) => {
    if (!header.contains(event.target)) {
      setPanelOpen(false);
      setNavOpen(false);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (!panel.hidden) {
      setPanelOpen(false);
      menuButton.focus();
    } else if (nav.classList.contains("is-open")) {
      setNavOpen(false, true);
    } else if (a11yBar.classList.contains("is-open")) {
      setA11yBarOpen(false, true);
    }
  });

  languageSelect.addEventListener("change", () => {
    savePreference(STORAGE.language, languageSelect.value);
    setLanguage(languageSelect.value);
  });

  header.querySelectorAll("[data-font-step]").forEach((button) => {
    button.addEventListener("click", () => {
      const step = Number(button.dataset.fontStep);

      if (step === 0) {
        fontScale = 1;
      } else {
        const index = FONT_SCALES.indexOf(fontScale);
        fontScale =
          FONT_SCALES[
            Math.max(0, Math.min(FONT_SCALES.length - 1, index + step))
          ];
      }

      updateFontSize();
      savePreference(STORAGE.fontScale, String(fontScale));
    });
  });

  motionButton.addEventListener("click", () => {
    updateReducedMotion(
      document.documentElement.dataset.reducedMotion !== "true",
    );
  });
}

export function mountSiteHeader() {
  const mount = document.querySelector("[data-site-header]");
  if (!mount || mount.dataset.mounted === "true") return;

  mount.innerHTML = HEADER;
  mount.dataset.mounted = "true";

  // A barra de acessibilidade fica fora do <header>, então o escopo é o wrapper inteiro.
  setupAccessibility(mount);
  loadVlibras();
}

mountSiteHeader();

// Offline copy of the heavy files after the first visit (see public/sw.js). Only in the built site:
// in development a service worker would serve stale files.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  addEventListener("load", () =>
    navigator.serviceWorker.register("/sw.js").catch(() => {}),
  );
}
