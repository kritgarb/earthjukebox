import { initI18n } from "../i18n/index.js";
import { HurricaneModel } from "../models/HurricaneModel.js";
import { StormImageryModel } from "../models/StormImageryModel.js";
import { AudioEngine } from "../views/sensory/AudioEngine.js";
import { SintonizeView } from "../views/pages/SintonizeView.js";
import { SintonizeController } from "../controllers/SintonizeController.js";

const audio = new AudioEngine();

initI18n();

new SintonizeController({
  view: new SintonizeView({ audio }),
  hurricane: new HurricaneModel(),
  imagery: new StormImageryModel(),
  audio,
}).init();
