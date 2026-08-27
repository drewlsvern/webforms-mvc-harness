import { renderScan } from "./views/scan.js";
import { renderCrawl } from "./views/crawl.js";
import { renderRequirements } from "./views/requirements.js";
import { renderSlices } from "./views/slices.js";
import { renderSelect } from "./views/select.js";
import { renderLeftList } from "./views/leftList.js";
import { renderStatusStrip } from "./statusStrip.js";
import { mountConsole } from "./console.js";
import { mountHistory } from "./history.js";
import { computeStepStates } from "./stepState.js";

const DETAIL_RENDERERS = {
  scan: renderScan,
  crawl: renderCrawl,
  requirements: renderRequirements,
  slices: renderSlices,
  select: renderSelect,
};

const stripEl = document.getElementById("status-strip");
const headlineEl = document.getElementById("headline");
const leftColumnEl = document.getElementById("left-column");

function currentStepId() {
  return location.hash.replace("#", "") || null; // null = compact list view
}

/**
 * Updates the status strip only - this is the callback contract the detail
 * views (renderScan/renderCrawl/etc.) already expect from before this change
 * (they call it after an action, then re-render their own content
 * themselves), so it's kept separate from renderLeftColumn below rather than
 * also swapping content out from under them.
 */
async function refreshStrip() {
  const states = await computeStepStates();
  renderStatusStrip(stripEl, headlineEl, states, currentStepId(), (stepId) => {
    location.hash = stepId;
  });
  return states;
}

async function renderLeftColumn() {
  const states = await refreshStrip();
  const current = currentStepId();
  leftColumnEl.innerHTML = "";

  if (!current) {
    await renderLeftList(leftColumnEl, states, {
      onOpenDetail: (stepId) => {
        location.hash = stepId;
      },
      onRefresh: renderLeftColumn,
    });
    return;
  }

  const back = document.createElement("a");
  back.textContent = "← Back to steps";
  back.className = "back-link";
  back.addEventListener("click", () => {
    location.hash = "";
  });
  leftColumnEl.append(back);

  const detailContainer = document.createElement("div");
  leftColumnEl.append(detailContainer);

  const render = DETAIL_RENDERERS[current];
  if (!render) {
    detailContainer.textContent = `Unknown step "${current}"`;
    return;
  }
  await render(detailContainer, refreshStrip);
}

window.addEventListener("hashchange", renderLeftColumn);

mountConsole(document.getElementById("console"));
mountHistory(document.getElementById("history"));
renderLeftColumn();
