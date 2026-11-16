import { onLanguageChange, t } from "../../i18n/index.js";

const statuses = new Map();
onLanguageChange(() =>
  statuses.forEach(([state, detail], el) => renderStatus(el, state, detail)),
);

const LABELS = {
  loading: "common.checking",
  live: "common.live",
  snapshot: "common.localCopy",
  estimate: "common.estimate",
  error: "common.failed",
};

const HINTS = {
  live: "common.liveHint",
  snapshot: "common.localCopyHint",
  estimate: "common.estimateHint",
};

export function renderStatus(el, state, detail) {
  statuses.set(el, [state, detail]);
  el.classList.add("status");
  el.dataset.state = state;
  el.textContent = detail
    ? `${t(LABELS[state])} · ${detail}`
    : t(LABELS[state]);
  el.title = HINTS[state] ? t(HINTS[state]) : "";
}
