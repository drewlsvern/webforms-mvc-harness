import { api } from "../api.js";
import { esc, renderGatePanel, renderError } from "../dom.js";

export async function renderScan(container, refreshShell) {
  container.innerHTML = "<h2>Scan</h2>";

  let index;
  try {
    index = await api.getScanIndex();
  } catch {
    index = null;
  }

  if (!index) {
    const form = document.createElement("div");
    form.className = "card";
    form.innerHTML = `
      <h3>Run scan</h3>
      <div class="row">
        <input data-role="source-root" placeholder="Path to WebForms source root" size="50" />
        <button class="primary" data-action="run">Run scan</button>
      </div>
    `;
    form.querySelector('[data-action="run"]').addEventListener("click", async () => {
      const sourceRoot = form.querySelector('[data-role="source-root"]').value.trim();
      if (!sourceRoot) return;
      try {
        await api.runScan(sourceRoot);
        await renderScan(container, refreshShell);
        await refreshShell();
      } catch (err) {
        form.append(renderError(err));
      }
    });
    container.append(form);
    return;
  }

  const summary = document.createElement("div");
  summary.className = "card";
  summary.innerHTML = `<div>${index.pages.length} page(s), ${index.controls.length} control(s), ${index.presenters.length} presenter(s)</div>`;
  container.append(summary);

  const list = document.createElement("div");
  list.className = "card";
  list.innerHTML = `<h3>Pages</h3><ul>${index.pages.map((p) => `<li><a data-page="${esc(p)}">${esc(p)}</a></li>`).join("")}</ul>`;
  const detail = document.createElement("div");
  detail.className = "card";
  detail.textContent = "Select a page to view its scan evidence.";
  list.querySelectorAll("[data-page]").forEach((a) => {
    a.addEventListener("click", async () => {
      const page = await api.getScanPage(a.dataset.page);
      detail.innerHTML = `
        <h3>${esc(page.pageId)}</h3>
        <div>Master page: ${esc(page.masterPage ?? "none")}</div>
        <div>Presenter: ${esc(page.presenterRef ?? "none")}</div>
        <div>Models: ${page.modelRefs.map(esc).join(", ") || "none"}</div>
        <div>UserControls: ${page.userControlRefs.map(esc).join(", ") || "none"}</div>
        <h4>Controls</h4>
        <table><tr><th>id</th><th>type</th></tr>${page.controls
          .map((c) => `<tr><td>${esc(c.id)}</td><td>${esc(c.type)}</td></tr>`)
          .join("")}</table>
        <h4>Navigation edges</h4>
        <table><tr><th>kind</th><th>target</th></tr>${page.navigationEdges
          .map((e) => `<tr><td>${esc(e.kind)}</td><td>${esc(e.targetPage)}</td></tr>`)
          .join("")}</table>
      `;
    });
  });
  container.append(list, detail);

  const gate = await api.getGate("scan").catch(() => null);
  container.append(
    renderGatePanel(
      "scan",
      gate,
      async () => {
        try {
          await api.approveGate("scan", "web");
          await refreshShell();
          await renderScan(container, refreshShell);
        } catch (err) {
          container.append(renderError(err));
        }
      },
      async (comment) => {
        await api.rejectGate("scan", "web", comment);
        await refreshShell();
        await renderScan(container, refreshShell);
      },
    ),
  );
}
