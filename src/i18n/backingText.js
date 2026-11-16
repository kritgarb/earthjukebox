// Texts of the background-music choice, in three languages side by side.
import { getLanguage } from "./index.js";

const TEXT = {
  "pt-BR": { label: "Música de fundo", auto: "A do fenômeno", none: "Nenhuma" },
  en: { label: "Background music", auto: "The phenomenon's own", none: "None" },
  es: { label: "Música de fondo", auto: "La del fenómeno", none: "Ninguna" },
};

export const bt = (key) => TEXT[getLanguage()]?.[key] ?? TEXT["pt-BR"][key];
