import { initI18n } from "../i18n/index.js";
import { NightLightsModel } from "../models/NightLightsModel.js";
import { AudioEngine } from "../views/sensory/AudioEngine.js";
import { NightLightsView } from "../views/pages/NightLightsView.js";
import { NightLightsController } from "../controllers/NightLightsController.js";

const audio = new AudioEngine();

initI18n();

new NightLightsController({
  view: new NightLightsView({ audio }),
  lights: new NightLightsModel(),
  audio,
}).init();
