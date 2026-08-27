import { api } from "../api.js";
import { esc, renderGatePanel, renderError } from "../dom.js";

function renderAuthPanel(authStatus, onChange) {
  const panel = document.createElement("div");
  panel.className = "card";
  panel.innerHTML = `
    <h3>Authentication</h3>
    <div>${authStatus.hasSession ? `Authenticated <span class="muted">(login page: ${esc(authStatus.loginUrl)})</span>` : "Not authenticated"}</div>
    <div class="row">
      <input data-role="auth-base-url" placeholder="https://localhost:44300" size="35" />
      <button data-action="authenticate">Authenticate…</button>
    </div>
    <div class="row" data-role="confirm-row" style="display:none">
      <span class="muted">Log in in the browser window that opened, then:</span>
      <button class="primary" data-action="confirm">I'm logged in</button>
      <button class="danger" data-action="cancel">Cancel</button>
    </div>
  `;
  panel.querySelector('[data-action="authenticate"]').addEventListener("click", async () => {
    const baseUrl = panel.querySelector('[data-role="auth-base-url"]').value.trim();
    if (!baseUrl) return;
    try {
      await api.startAuth(baseUrl);
      panel.querySelector('[data-role="confirm-row"]').style.display = "";
    } catch (err) {
      panel.append(renderError(err));
    }
  });
  panel.querySelector('[data-action="confirm"]').addEventListener("click", async () => {
    try {
      await api.confirmAuth();
      await onChange();
    } catch (err) {
      panel.append(renderError(err));
    }
  });
  panel.querySelector('[data-action="cancel"]').addEventListener("click", async () => {
    await api.cancelAuth();
    panel.querySelector('[data-role="confirm-row"]').style.display = "none";
  });
  return panel;
}

export async function renderCrawl(container, refreshShell) {
  container.innerHTML = "<h2>Crawl</h2>";

  const authStatus = await api.getAuthStatus().catch(() => ({ hasSession: false, loginUrl: null }));
  container.append(renderAuthPanel(authStatus, () => renderCrawl(container, refreshShell)));

  let index;
  try {
    index = await api.getCrawlIndex();
  } catch {
    index = null;
  }

  if (!index) {
    const form = document.createElement("div");
    form.className = "card";
    form.innerHTML = `
      <h3>Run crawl</h3>
      <div class="row">
        <input data-role="base-url" placeholder="https://localhost:44300" size="40" />
        <label><input type="checkbox" data-role="resume" /> resume a paused crawl</label>
        <button class="primary" data-action="run" ${authStatus.hasSession ? "" : "disabled"}>Run crawl</button>
      </div>
      ${authStatus.hasSession ? "" : '<div class="muted">Authenticate above before crawling.</div>'}
      <div class="muted">Live progress appears in the Console panel.</div>
    `;
    form.querySelector('[data-action="run"]').addEventListener("click", async () => {
      const baseUrl = form.querySelector('[data-role="base-url"]').value.trim();
      const resume = form.querySelector('[data-role="resume"]').checked;
      if (!baseUrl) return;
      try {
        await api.runCrawl(baseUrl, resume);
        await refreshShell();
        await renderCrawl(container, refreshShell);
      } catch (err) {
        form.append(renderError(err));
      }
    });
    container.append(form);
    return;
  }

  const pageIds = Object.keys(index.pages);
  const list = document.createElement("div");
  list.className = "card";
  list.innerHTML = `<h3>Pages (${pageIds.length})</h3><ul>${pageIds
    .map((p) => `<li><a data-page="${esc(p)}">${esc(p)}</a> (${index.pages[p].length} run(s))</li>`)
    .join("")}</ul>`;
  const detail = document.createElement("div");
  detail.className = "card";
  detail.textContent = "Select a page to view its latest crawl run.";
  list.querySelectorAll("[data-page]").forEach((a) => {
    a.addEventListener("click", async () => {
      const pageId = a.dataset.page;
      const runId = index.pages[pageId].at(-1);
      const run = await api.getCrawlRun(pageId, runId);
      detail.innerHTML = `
        <h3>${esc(pageId)} / ${esc(runId)}</h3>
        ${run.redirectedTo ? `<div class="muted">Redirected to: ${esc(run.redirectedTo)}</div>` : ""}
        <img src="${api.crawlFileUrl(pageId, runId, "screenshot.png")}" style="max-width:100%;border:1px solid var(--border)" />
        <h4>Network (${run.network.length})</h4>
        <table><tr><th>method</th><th>url</th><th>status</th></tr>${run.network
          .map((n) => `<tr><td>${esc(n.method)}</td><td>${esc(n.url)}</td><td>${esc(n.status)}</td></tr>`)
          .join("")}</table>
        <h4>Interactive elements (${run.interactions.length})</h4>
        <table><tr><th>type</th><th>selector</th><th>description</th></tr>${run.interactions
          .map((i) => `<tr><td>${esc(i.type)}</td><td>${esc(i.selector)}</td><td>${esc(i.description)}</td></tr>`)
          .join("")}</table>
      `;
    });
  });
  container.append(list, detail);

  const gate = await api.getGate("crawl").catch(() => null);
  container.append(
    renderGatePanel(
      "crawl",
      gate,
      async () => {
        await api.approveGate("crawl", "web");
        await refreshShell();
        await renderCrawl(container, refreshShell);
      },
      async (comment) => {
        await api.rejectGate("crawl", "web", comment);
        await refreshShell();
        await renderCrawl(container, refreshShell);
      },
    ),
  );
}
