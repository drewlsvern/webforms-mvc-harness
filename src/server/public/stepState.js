import { api } from "./api.js";

export const STEP_DEFS = [
  { id: "scan", label: "Scan", gated: true },
  { id: "crawl", label: "Crawl", gated: true },
  { id: "requirements", label: "Requirements", gated: true },
  { id: "slices", label: "Slices", gated: true },
  { id: "select", label: "Select", gated: false },
];

async function safeGet(fn, fallback = null) {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

function detailFor(stageId, data) {
  switch (stageId) {
    case "scan":
      return data.scanIndex ? `${data.scanIndex.pages.length} page(s), ${data.scanIndex.controls.length} control(s)` : "";
    case "crawl":
      return data.crawlIndex ? `${Object.keys(data.crawlIndex.pages).length} page(s) visited` : "";
    case "requirements":
      return data.requirements
        ? `${data.requirements.functional.requirements.length} functional, ${data.requirements.nonfunctional.requirements.length} non-functional`
        : "";
    case "slices":
      return data.slicesData ? `${data.slicesData.slices.length} slice(s)` : "";
    default:
      return "";
  }
}

/**
 * Reads current gate/evidence state and computes each step's five-state
 * status and one-line detail. Select is excluded from gate-based scoring -
 * it doesn't have a defined "complete" criterion yet (see design.md Open
 * Questions in the wizard-dashboard-ui change) - it's just locked/unlocked
 * based on the slices gate.
 */
export async function computeStepStates() {
  const gates = {};
  for (const step of STEP_DEFS) {
    if (!step.gated) continue;
    gates[step.id] = await safeGet(() => api.getGate(step.id));
  }

  const data = {
    scanIndex: await safeGet(() => api.getScanIndex()),
    crawlIndex: await safeGet(() => api.getCrawlIndex()),
    crawlPause: await safeGet(() => api.getCrawlPauseState(), { paused: false }),
    requirements: await safeGet(() => api.getRequirements()),
    slicesData: await safeGet(() => api.getSlices()),
  };

  const results = [];
  let previousApproved = true; // scan has no predecessor
  for (const step of STEP_DEFS.filter((s) => s.gated)) {
    const gate = gates[step.id];
    let state;
    let detail;

    if (gate?.status === "approved") {
      state = "complete";
      detail = detailFor(step.id, data);
    } else if (gate?.status === "rejected") {
      state = "error";
      detail = gate.comment ? `rejected: ${gate.comment}` : "rejected";
    } else if (step.id === "crawl" && data.crawlPause.paused) {
      state = "warning";
      detail = `paused at "${data.crawlPause.pausedAtPageId}" - needs re-authentication`;
    } else if (gate?.status === "pending") {
      state = "active";
      detail = "awaiting review";
    } else if (!previousApproved) {
      state = "pending";
      detail = "locked";
    } else {
      state = "pending";
      detail = "not started";
    }

    results.push({ id: step.id, label: step.label, state, detail });
    previousApproved = gate?.status === "approved";
  }

  const slicesLocked = gates.slices?.status !== "approved";
  results.push({
    id: "select",
    label: "Select",
    state: slicesLocked ? "pending" : "active",
    detail: slicesLocked ? "locked" : "select a slice to work on",
  });

  return results;
}

/** Headline "X of Y" count - scoped to the four gated stages; Select isn't counted (see design.md Open Questions). */
export function countComplete(states) {
  const gated = states.filter((s) => s.id !== "select");
  return { complete: gated.filter((s) => s.state === "complete").length, total: gated.length };
}
