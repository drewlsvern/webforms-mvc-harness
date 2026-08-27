import { esc } from "./dom.js";
import { countComplete } from "./stepState.js";

const ICONS = { complete: "✓", active: "●", error: "!", warning: "⚠", pending: "○" };

export function renderStatusStrip(container, headlineEl, states, currentStepId, onSelect) {
  container.innerHTML = "";
  states.forEach((step, index) => {
    const card = document.createElement("button");
    card.className = `step-card state-${step.state}` + (step.id === currentStepId ? " current" : "");
    card.innerHTML = `
      <div class="step-card-number">${index + 1}</div>
      <div class="step-card-icon">${ICONS[step.state] ?? "?"}</div>
      <div class="step-card-title">${esc(step.label)}</div>
      <div class="step-card-detail">${esc(step.detail)}</div>
    `;
    card.addEventListener("click", () => onSelect(step.id));
    container.append(card);
  });

  const { complete, total } = countComplete(states);
  headlineEl.textContent = `${complete} of ${total} steps complete`;
}
