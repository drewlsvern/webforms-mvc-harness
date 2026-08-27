const STAGE_LABELS = { scan: "Scan", crawl: "Crawl", requirements: "Requirements", slices: "Slices" };

function describe(event) {
  switch (event.type) {
    case "visiting":
      return `● ${event.pageId} — navigating… (${event.visited}/${event.total})`;
    case "captured":
      return event.redirectedTo
        ? `⚠ ${event.pageId} → redirected to ${event.redirectedTo} (${event.visited}/${event.total})`
        : `✓ ${event.pageId} — captured, ${event.requestCount} request(s) (${event.visited}/${event.total})`;
    case "paused":
      return `⛔ Paused at ${event.pageId} — session appears to have expired.`;
    case "complete":
      return `Crawl complete (${event.visited}/${event.total}).`;
    case "summary":
      return summaryText(event);
    default:
      return "";
  }
}

function summaryText(event) {
  switch (event.stage) {
    case "scan":
      return `Done — ${event.pages} page(s), ${event.controls} control(s), ${event.presenters} presenter(s).`;
    case "requirements":
      return `Done — ${event.functional} functional, ${event.nonfunctional} non-functional.`;
    case "slices":
      return `Done — ${event.slices} slice(s), shared slice: ${event.sharedSlice ? "yes" : "no"}.`;
    default:
      return "Done.";
  }
}

/**
 * Mounted once and left running for the app's lifetime, independent of
 * whatever the left column is showing - shows whichever stage most recently
 * emitted a "started" event, or an idle message if nothing has run yet.
 */
export function mountConsole(container) {
  container.innerHTML = `
    <h3>Console</h3>
    <div class="console-status muted" data-role="console-status">Nothing has run yet.</div>
    <div class="console-body" data-role="console-body"></div>
  `;
  const status = container.querySelector('[data-role="console-status"]');
  const body = container.querySelector('[data-role="console-body"]');

  const source = new EventSource("/api/progress");
  source.onmessage = (evt) => {
    const event = JSON.parse(evt.data);
    if (event.type === "started") {
      status.textContent = `${STAGE_LABELS[event.stage] ?? event.stage} — running…`;
      body.innerHTML = "";
      return;
    }

    const text = describe(event);
    if (!text) return;
    const line = document.createElement("div");
    line.className = "console-line";
    line.textContent = text;
    body.append(line);

    if (event.type === "summary" || event.type === "complete" || event.type === "paused") {
      status.textContent = `${STAGE_LABELS[event.stage] ?? event.stage} — ${event.type === "paused" ? "paused" : "done"}`;
    }
  };
  source.onerror = () => {
    // Live output is best-effort; the underlying task keeps running server-side regardless.
  };
  return () => source.close();
}
