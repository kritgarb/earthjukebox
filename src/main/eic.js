import { initI18n, onLanguageChange } from "../i18n/index.js";
import { EIC } from "../config/eic.js";
import { et } from "../i18n/eicText.js";
import { FramesModel } from "../models/FramesModel.js";
import { AudioEngine } from "../views/sensory/AudioEngine.js";
import { FramesView } from "../views/pages/FramesView.js";
import { FramesController } from "../controllers/FramesController.js";

// One page, four experiences made of NASA EIC frames: eic.html?e=lightning|co2|gedi|aerosols.
const exp = EIC[new URLSearchParams(location.search).get("e")];
if (!exp) {
  location.replace("/");
} else {
  const CAMERA = {
    world: "cameraWorld",
    zoom: "cameraZoom",
    americas: "cameraAmericas",
    africa: "cameraAfrica",
    asia: "cameraAsia",
  };
  const keys = Object.keys(exp.views);
  if (exp.theme) document.body.classList.add(exp.theme);
  document.getElementById("cameras").innerHTML = keys
    .map(
      (k, i) =>
        `<button type="button" data-camera="${k}" aria-pressed="false" title="Tecla ${i + 1}"></button>`,
    )
    .join("");
  document.getElementById("key-cameras").innerHTML = keys
    .map((_, i) => `<kbd>${i + 1}</kbd>`)
    .join("");
  document.getElementById("phenomena-back-link").href = `/eic.html?e=${exp.id}`;
  const link = document.getElementById("source-link");
  link.href = `https://svs.gsfc.nasa.gov/${exp.svs}/`;
  document.getElementById("r-unit").textContent =
    exp.unit === "%" ? "%" : ` ${exp.unit}`;

  // Every text of the page that belongs to this experience, in the language in use.
  const fill = () => {
    document
      .querySelectorAll("[data-eic]")
      .forEach((el) => (el.textContent = et(exp.id, el.dataset.eic)));
    document
      .querySelectorAll("[data-eic-shared]")
      .forEach(
        (el) =>
          (el.textContent = et("_", el.dataset.eicShared, { svs: exp.svs })),
      );
    document
      .querySelectorAll("[data-camera]")
      .forEach((el) => (el.textContent = et("_", CAMERA[el.dataset.camera])));
    document.getElementById("r-second-label").textContent = et(
      "_",
      exp.mode === "layers" ? "layersOpen" : "vsMean",
    );
    document.getElementById("intro-rule").dataset.rule = et(exp.id, "rule");
    document.title = `${et(exp.id, "name")} · Earth Jukebox`;
    const introRule = document.getElementById("intro-rule");
    introRule.dataset.rule = et(exp.id, "rule");
    introRule.dataset.ruleLocalized = "true";
  };
  fill();

  const audio = new AudioEngine();
  initI18n();
  const view = new FramesView({ audio, exp });
  const controller = new FramesController({
    view,
    model: new FramesModel(exp),
    audio,
    exp,
  });
  controller.init();
  onLanguageChange(() => {
    fill();
    // The intro's rule is built from the accent chosen and the text above.
    view.renderAccent(controller.accent, controller.brStyle);
  });
}
