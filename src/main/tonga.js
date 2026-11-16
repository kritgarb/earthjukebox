import { initI18n } from "../i18n/index.js";
import { EruptionModel } from "../models/EruptionModel.js";
import { AudioEngine } from "../views/sensory/AudioEngine.js";
import { EruptionView } from "../views/pages/EruptionView.js";
import { EruptionController } from "../controllers/EruptionController.js";

const audio = new AudioEngine();

initI18n();

new EruptionController({
  view: new EruptionView({ audio }),
  eruption: new EruptionModel(),
  audio,
}).init();
