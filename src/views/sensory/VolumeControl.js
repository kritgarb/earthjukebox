import { onLanguageChange, t } from "../../i18n/index.js";

const STEP = 10;
let counter = 0;

// Volume for the transport dock: a "lower" and a "raise" button with the level between them.
// `anchor` is the sound button; the group goes right after it.
export function mountVolumeControl(audio, anchor) {
  if (!anchor || anchor.parentElement.querySelector(".volume")) return;
  const id = `volume-value-${++counter}`;

  const root = document.createElement("div");
  root.className = "volume";
  root.setAttribute("role", "group");
  root.innerHTML = `
    <button class="btn volume__step" type="button" data-step="-1">
      <span class="icon icon--volume-down" aria-hidden="true"></span>
    </button>
    <output class="volume__value" id="${id}"></output>
    <button class="btn volume__step" type="button" data-step="1">
      <span class="icon icon--volume-up" aria-hidden="true"></span>
    </button>`;
  anchor.after(root);

  const valueLabel = root.querySelector("output");
  const [minus, plus] = root.querySelectorAll(".volume__step");

  const render = (v = audio.volume) => {
    valueLabel.textContent = `${v}%`;
    root.setAttribute("aria-label", `${t("volume.label")}: ${t("volume.value", { percent: v })}`);
    minus.setAttribute("aria-label", t("volume.down"));
    plus.setAttribute("aria-label", t("volume.up"));
    minus.disabled = v <= 0;
    plus.disabled = v >= 100;
    root.classList.toggle("is-muted", v === 0);
  };

  root.querySelectorAll(".volume__step").forEach((b) =>
    b.addEventListener("click", () => audio.setVolume(audio.volume + Number(b.dataset.step) * STEP)),
  );

  audio.onVolumeChange(render);
  onLanguageChange(() => render());
  render();
}
