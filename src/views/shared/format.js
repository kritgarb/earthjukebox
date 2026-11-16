import { getLanguage, t } from "../../i18n/index.js";

const formatters = new Map();
const nf = (digits) => {
  const key = `${getLanguage()}:${digits}`;
  if (!formatters.has(key)) {
    formatters.set(
      key,
      new Intl.NumberFormat(getLanguage(), {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      }),
    );
  }
  return formatters.get(key);
};

export const num = (v, digits = 0) =>
  v == null || Number.isNaN(v) ? "—" : nf(digits).format(v);
export const signed = (v, digits = 2) =>
  v == null
    ? "—"
    : `${v > 0 ? "+" : v < 0 ? "−" : ""}${num(Math.abs(v), digits)}`;
export const lat = (v) => `${num(Math.abs(v), 1)}° ${v >= 0 ? "N" : "S"}`;
export const lon = (v) =>
  `${num(Math.abs(v), 1)}° ${v >= 0 ? t("format.east") : t("format.west")}`;

// Building an Intl.DateTimeFormat is slow and the panels ask for the same ones on every frame.
const dateFormatters = new Map();
const dateFormat = (options) => {
  const key = `${getLanguage()}:${JSON.stringify(options)}`;
  let formatter = dateFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(getLanguage(), { ...options, timeZone: "UTC" });
    dateFormatters.set(key, formatter);
  }
  return (date) => formatter.format(date);
};
const tidy = (value) =>
  getLanguage() === "pt-BR"
    ? value.replace(" de ", " ").replace(".", "")
    : value;

export const dateTimeUTC = (d) =>
  `${tidy(dateFormat({ day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })(d))} UTC`;
export const dayShort = (d) =>
  tidy(dateFormat({ day: "2-digit", month: "short" })(d));
export const powerDay = (yyyymmdd) =>
  dayShort(
    new Date(
      Date.UTC(
        +yyyymmdd.slice(0, 4),
        +yyyymmdd.slice(4, 6) - 1,
        +yyyymmdd.slice(6, 8),
      ),
    ),
  );

export const pan = (p) =>
  Math.abs(p) < 0.05
    ? t("format.center")
    : `${t(p < 0 ? "format.left" : "format.right")} ${num(Math.abs(p), 2)}`;

export const monthYearUTC = (d) =>
  tidy(dateFormat({ month: "short", year: "numeric" })(d));
export const dayUTC = (d) =>
  tidy(dateFormat({ day: "2-digit", month: "short", year: "numeric" })(d));
export const clockUTC = (d) =>
  dateFormat({ hour: "2-digit", minute: "2-digit" })(d);

const FIGURES = {
  "4n": "format.quarterNotes",
  "8n": "format.eighthNotes",
  "16n": "format.sixteenthNotes",
};
export const rhythm = (rate) => (FIGURES[rate] ? t(FIGURES[rate]) : rate);
