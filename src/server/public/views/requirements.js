import { api } from "../api.js";
import { esc, renderGatePanel, renderError } from "../dom.js";

function renderList(title, requirements) {
  const div = document.createElement("div");
  div.className = "card";
  div.innerHTML = `<h3>${esc(title)} (${requirements.length})</h3>` +
    requirements
      .map(
        (r) => `
      <div style="margin-bottom:0.6rem">
        <strong>${esc(r.id)}</strong> <span class="muted">(${esc(r.pageId)})</span>
        <div>${esc(r.description)}</div>
        <div class="muted">Evidence: ${r.evidenceRefs.map((e) => `${esc(e.kind)}:${esc(e.path)}`).join(", ") || "none"}</div>
      </div>`,
      )
      .join("");
  return div;
}

export async function renderRequirements(container, refreshShell) {
  container.innerHTML = "<h2>Requirements</h2>";

  let data;
  try {
    data = await api.getRequirements();
  } catch {
    data = null;
  }

  if (!data) {
    const form = document.createElement("div");
    form.className = "card";
    form.innerHTML = `<h3>Generate requirements</h3><button class="primary" data-action="run">Run requirements synthesis</button>`;
    form.querySelector('[data-action="run"]').addEventListener("click", async () => {
      try {
        await api.runRequirements();
        await renderRequirements(container, refreshShell);
        await refreshShell();
      } catch (err) {
        form.append(renderError(err));
      }
    });
    container.append(form);
    return;
  }

  container.append(renderList("Functional", data.functional.requirements));
  container.append(renderList("Non-functional", data.nonfunctional.requirements));

  const gate = await api.getGate("requirements").catch(() => null);
  container.append(
    renderGatePanel(
      "requirements",
      gate,
      async () => {
        await api.approveGate("requirements", "web");
        await refreshShell();
        await renderRequirements(container, refreshShell);
      },
      async (comment) => {
        await api.rejectGate("requirements", "web", comment);
        await refreshShell();
        await renderRequirements(container, refreshShell);
      },
    ),
  );
}
