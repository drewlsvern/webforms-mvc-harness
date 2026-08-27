import { api } from "../api.js";
import { esc, renderError } from "../dom.js";

export async function renderSelect(container, refreshShell) {
  container.innerHTML = "<h2>Select</h2>";

  let data;
  try {
    data = await api.getSlices();
  } catch (err) {
    container.append(renderError(err));
    return;
  }
  if (!data.slices.length) {
    container.append(document.createTextNode("No slices yet - approve the Slices gate first."));
    return;
  }

  const stateBySlice = new Map(data.states.map((s) => [s.sliceId, s.state]));
  const alreadySelected = data.states.find((s) => s.state === "selected");

  for (const slice of data.slices) {
    const state = stateBySlice.get(slice.id) ?? "?";
    const card = document.createElement("div");
    card.className = "card";
    const label = slice.pages.length > 0 ? `${slice.pages.length} page(s)` : `${slice.componentRefs.length} shared component(s)`;
    card.innerHTML = `
      <h3>${esc(slice.id)} <span class="badge ${esc(state)}">${esc(state)}</span></h3>
      <div class="muted">${label}</div>
      <div class="row"><button class="primary" data-action="select" ${state === "ready" ? "" : "disabled"}>Select</button></div>
    `;
    card.querySelector('[data-action="select"]').addEventListener("click", async () => {
      try {
        await api.selectSlice(slice.id);
        await renderSelect(container, refreshShell);
        await refreshShell();
      } catch (err) {
        card.append(renderError(err));
      }
    });
    container.append(card);
  }

  if (alreadySelected) {
    const note = document.createElement("div");
    note.className = "muted";
    note.textContent = `"${alreadySelected.sliceId}" is currently selected. Conversion isn't built yet - a future change will mark it done and unlock the next round.`;
    container.append(note);
  }
}
