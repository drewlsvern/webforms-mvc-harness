import { api } from "../api.js";
import { esc, renderGatePanel, renderError } from "../dom.js";

function sliceCard(slice, state) {
  const div = document.createElement("div");
  div.className = "card";
  const depends = slice.dependsOn
    .map((d) => `${esc(d.sliceId)} (via ${d.components.map((c) => `${c.kind}:${c.id}`).join(", ")})`)
    .join("; ");
  div.innerHTML = `
    <h3><input type="checkbox" data-role="pick" value="${esc(slice.id)}" /> ${esc(slice.id)} <span class="badge ${esc(state)}">${esc(state)}</span></h3>
    ${slice.pages.length ? `<div>Pages: ${slice.pages.map(esc).join(", ")}</div>` : ""}
    ${slice.componentRefs.length ? `<div>Components: ${slice.componentRefs.map((c) => `${c.kind}:${c.id}`).map(esc).join(", ")}</div>` : ""}
    <div class="muted">Depends on: ${depends || "none"}</div>
    <div class="muted">Requirements: ${slice.requirementRefs.map(esc).join(", ") || "none"}</div>
  `;
  return div;
}

export async function renderSlices(container, refreshShell) {
  container.innerHTML = "<h2>Slices</h2>";

  let data;
  try {
    data = await api.getSlices();
    if (!data.slices.length) data = null;
  } catch {
    data = null;
  }

  if (!data) {
    const form = document.createElement("div");
    form.className = "card";
    form.innerHTML = `<h3>Detect slices</h3><button class="primary" data-action="run">Run slice detection</button>`;
    form.querySelector('[data-action="run"]').addEventListener("click", async () => {
      try {
        await api.runSlices();
        await renderSlices(container, refreshShell);
        await refreshShell();
      } catch (err) {
        form.append(renderError(err));
      }
    });
    container.append(form);
    return;
  }

  const rerender = () => renderSlices(container, refreshShell);
  const stateBySlice = new Map(data.states.map((s) => [s.sliceId, s.state]));

  const list = document.createElement("div");
  for (const slice of data.slices) list.append(sliceCard(slice, stateBySlice.get(slice.id) ?? "?"));
  container.append(list);

  const editor = document.createElement("div");
  editor.className = "card";
  const sliceIds = data.slices.map((s) => s.id);
  editor.innerHTML = `
    <h3>Edit</h3>
    <div class="row">
      <button data-action="merge">Merge checked slices</button>
      <input data-role="merge-id" placeholder="new id (optional)" />
    </div>
    <div class="row">
      <button data-action="split">Split checked slice…</button>
    </div>
    <div class="row">
      <select data-role="move-from"><option value="">from slice</option>${sliceIds.map((id) => `<option>${esc(id)}</option>`).join("")}</select>
      <input data-role="move-pages" placeholder="pages, comma-separated" size="30" />
      <select data-role="move-to"><option value="">to slice</option>${sliceIds.map((id) => `<option>${esc(id)}</option>`).join("")}</select>
      <button data-action="move">Move</button>
    </div>
    <div class="row">
      <select data-role="promote-kind"><option value="userControl">userControl</option><option value="presenter">presenter</option></select>
      <input data-role="promote-id" placeholder="component id" size="20" />
      <select data-role="promote-slice"><option value="">owning slice</option>${sliceIds.map((id) => `<option>${esc(id)}</option>`).join("")}</select>
      <button data-action="promote">Promote</button>
    </div>
    <div class="row">
      <select data-role="demote-kind"><option value="userControl">userControl</option><option value="presenter">presenter</option></select>
      <input data-role="demote-id" placeholder="component id" size="20" />
      <button class="danger" data-action="demote">Demote (not actually shared)</button>
    </div>
  `;

  const checked = () => [...list.querySelectorAll('[data-role="pick"]:checked')].map((c) => c.value);

  editor.querySelector('[data-action="merge"]').addEventListener("click", async () => {
    const ids = checked();
    if (ids.length < 2) return alert("Check at least two slices to merge.");
    const newId = editor.querySelector('[data-role="merge-id"]').value.trim() || undefined;
    try {
      await api.mergeSlices(ids, newId);
      await rerender();
    } catch (err) {
      editor.append(renderError(err));
    }
  });

  editor.querySelector('[data-action="split"]').addEventListener("click", async () => {
    const ids = checked();
    if (ids.length !== 1) return alert("Check exactly one slice to split.");
    const slice = data.slices.find((s) => s.id === ids[0]);
    const groupNames = (prompt("New slice ids, comma-separated:") || "").split(",").map((s) => s.trim()).filter(Boolean);
    if (groupNames.length < 2) return;
    const groups = groupNames.map((id) => ({ id, pages: [] }));
    for (const pageId of slice.pages) {
      const target = prompt(`Which new slice does "${pageId}" belong to? (${groupNames.join(", ")})`, groupNames[0]);
      const group = groups.find((g) => g.id === target) ?? groups[0];
      group.pages.push(pageId);
    }
    try {
      await api.splitSlice(slice.id, groups);
      await rerender();
    } catch (err) {
      editor.append(renderError(err));
    }
  });

  editor.querySelector('[data-action="move"]').addEventListener("click", async () => {
    const from = editor.querySelector('[data-role="move-from"]').value;
    const to = editor.querySelector('[data-role="move-to"]').value;
    const pages = editor.querySelector('[data-role="move-pages"]').value.split(",").map((p) => p.trim()).filter(Boolean);
    if (!from || !to || pages.length === 0) return alert("Fill in from slice, to slice, and at least one page.");
    try {
      await api.movePages(pages, from, to);
      await rerender();
    } catch (err) {
      editor.append(renderError(err));
    }
  });

  editor.querySelector('[data-action="promote"]').addEventListener("click", async () => {
    const kind = editor.querySelector('[data-role="promote-kind"]').value;
    const id = editor.querySelector('[data-role="promote-id"]').value.trim();
    const sliceId = editor.querySelector('[data-role="promote-slice"]').value;
    if (!id || !sliceId) return alert("Fill in the component id and owning slice.");
    try {
      await api.promoteComponent(kind, id, sliceId);
      await rerender();
    } catch (err) {
      editor.append(renderError(err));
    }
  });

  editor.querySelector('[data-action="demote"]').addEventListener("click", async () => {
    const kind = editor.querySelector('[data-role="demote-kind"]').value;
    const id = editor.querySelector('[data-role="demote-id"]').value.trim();
    if (!id) return alert("Fill in the component id.");
    try {
      await api.demoteComponent(kind, id);
      await rerender();
    } catch (err) {
      editor.append(renderError(err));
    }
  });

  container.append(editor);

  const gate = await api.getGate("slices").catch(() => null);
  container.append(
    renderGatePanel(
      "slices",
      gate,
      async () => {
        await api.approveGate("slices", "web");
        await refreshShell();
        await rerender();
      },
      async (comment) => {
        await api.rejectGate("slices", "web", comment);
        await refreshShell();
        await rerender();
      },
    ),
  );
}
