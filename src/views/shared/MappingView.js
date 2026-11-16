import { esc, setText } from "./dom.js";
import { t } from "../../i18n/index.js";
import { onLanguageChange } from "../../i18n/index.js";

// Where the input of a row comes from. The product's one fixed commitment is that measured,
// calculated and illustrative are never confused, so each row carries the word.
const KINDS = {
  medido: "common.measured",
  calculado: "common.calculated",
  ilustrativo: "common.illustrative",
};

// "Data variable -> sensory parameter" rows, updated in place as the model changes.
// rows: [{ key, from, to, kind }], kind being a key of KINDS (measured by default).
export class MappingView {
  constructor(el, rows) {
    el.classList.add("mapping");
    this.el = el;
    this.sourceRows = rows;
    el.innerHTML = rows
      .map(
        (r) => `
        <li class="mapping__row" data-key="${r.key}">
          <span class="mapping__from">${esc(t(r.fromKey ?? r.from))} <span class="mapping__kind" data-kind="${r.kind ?? "medido"}">${t(KINDS[r.kind ?? "medido"])}</span></span><span class="mapping__value">—</span>
          <span class="mapping__to">${esc(t(r.toKey ?? r.to))}</span><span class="mapping__out">—</span>
          <span class="mapping__bar" aria-hidden="true"><span></span></span>
        </li>`,
      )
      .join("");
    this.rows = new Map(
      [...el.children].map((li) => [
        li.dataset.key,
        {
          from: li.querySelector(".mapping__from").firstChild,
          value: li.querySelector(".mapping__value"),
          out: li.querySelector(".mapping__out"),
          to: li.querySelector(".mapping__to"),
          bar: li.querySelector(".mapping__bar > span"),
        },
      ]),
    );
    onLanguageChange(() =>
      this.sourceRows.forEach((row) => {
        const item = this.el.querySelector(`[data-key="${row.key}"]`);
        if (!item) return;
        item.querySelector(".mapping__from").firstChild.textContent =
          `${t(row.fromKey ?? row.from)} `;
        item.querySelector(".mapping__kind").textContent =
          row.kind === "medido" && this.manual
            ? t("common.manualTest")
            : t(KINDS[row.kind ?? "medido"]);
        item.querySelector(".mapping__to").textContent = t(row.toKey ?? row.to);
      }),
    );
  }

  // While a value is being set by hand (the closed-eyes test), the rows fed by it (`keys`) are
  // not playing a measurement.
  setManual(on, keys) {
    if (on === this.manual) return;
    this.manual = on;
    this.kinds ??= keys
      .map((key) =>
        document.querySelector(
          `.mapping__row[data-key="${key}"] .mapping__kind`,
        ),
      )
      .filter(Boolean);
    this.kinds.forEach((tag) => {
      if (tag.dataset.kind === "medido")
        tag.textContent = on ? t("common.manualTest") : t(KINDS.medido);
      tag.classList.toggle("is-manual", on && tag.dataset.kind === "medido");
    });
  }

  update(values) {
    for (const [key, v] of Object.entries(values)) {
      const row = this.rows.get(key);
      if (!row) continue;
      // Labels are re-read on every update, so a language switch can never leave a stale one.
      const src = this.sourceRows.find((r) => r.key === key);
      if (src) {
        setText(row.from, `${t(src.fromKey ?? src.from)} `);
        setText(row.to, t(src.toKey ?? src.to));
      }
      setText(row.value, v.value);
      setText(row.out, v.out);
      if (v.to) setText(row.to, v.to);
      row.bar.style.width = `${Math.round((v.t ?? 0) * 100)}%`;
    }
  }
}
