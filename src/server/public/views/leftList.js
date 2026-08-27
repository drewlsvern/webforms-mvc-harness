import { api } from "../api.js";
import { esc, renderError } from "../dom.js";

function button(label, onClick, className = "") {
  const btn = document.createElement("button");
  btn.className = className;
  btn.textContent = label;
  btn.addEventListener("click", onClick);
  return btn;
}

async function runStage(stepId) {
  if (stepId === "requirements") return api.runRequirements();
  if (stepId === "slices") return api.runSlices();
  throw new Error(`No inline run available for "${stepId}" - open it to run with the required inputs.`);
}

async function buildActions(step, actions, onRefresh) {
  const wrap = (fn) => async () => {
    try {
      await fn();
      await onRefresh();
    } catch (err) {
      actions.append(renderError(err));
    }
  };

  if (step.id !== "select" && step.detail === "awaiting review") {
    actions.append(button("Approve", wrap(() => api.approveGate(step.id, "web")), "primary"));
    actions.append(
      button(
        "Reject",
        wrap(() => {
          const comment = prompt(`Reason for rejecting ${step.label}?`);
          if (!comment) throw new Error("Rejection needs a comment");
          return api.rejectGate(step.id, "web", comment);
        }),
        "danger",
      ),
    );
    return;
  }

  if ((step.id === "requirements" || step.id === "slices") && step.detail === "not started") {
    actions.append(button("Run", wrap(() => runStage(step.id)), "primary"));
    return;
  }

  if (step.id === "select" && step.state === "active") {
    let slicesData;
    try {
      slicesData = await api.getSlices();
    } catch {
      return;
    }
    const ready = slicesData.slices.filter((s) => slicesData.states.find((st) => st.sliceId === s.id)?.state === "ready");
    if (ready.length === 0) return;
    const select = document.createElement("select");
    select.innerHTML = ready.map((s) => `<option value="${esc(s.id)}">${esc(s.id)}</option>`).join("");
    actions.append(select);
    actions.append(
      button(
        "Select",
        wrap(() => api.selectSlice(select.value)),
        "primary",
      ),
    );
  }
}

/**
 * The compact step list. Scan and Crawl need inputs (a source path; a base
 * URL plus authentication) that don't fit a one-line row, so their inline
 * action is just opening the detail view - Requirements, Slices, and Select
 * either need no inputs or a trivial one, so they get a real inline action.
 */
export async function renderLeftList(container, states, { onOpenDetail, onRefresh }) {
  container.innerHTML = "";
  for (const step of states) {
    const row = document.createElement("div");
    row.className = "step-row card";
    row.innerHTML = `
      <div class="row" style="justify-content: space-between;">
        <strong>${esc(step.label)}</strong>
        <span class="badge ${esc(step.state)}">${esc(step.state)}</span>
      </div>
      <div class="muted">${esc(step.detail)}</div>
    `;
    const actions = document.createElement("div");
    actions.className = "row";
    row.append(actions);
    await buildActions(step, actions, onRefresh);

    const open = document.createElement("a");
    open.textContent = "Open →";
    open.addEventListener("click", () => onOpenDetail(step.id));
    row.append(open);

    container.append(row);
  }
}
