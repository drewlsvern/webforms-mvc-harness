/**
 * Placeholder only - durable task-history persistence is a separate, deferred
 * change (see wizard-dashboard-ui/design.md Non-Goals). This renders an
 * explicit empty state rather than fabricating history from current evidence.
 */
export function mountHistory(container) {
  container.innerHTML = `
    <h3>History</h3>
    <div class="muted">No history yet. Task history isn't persisted yet - each run's evidence is available in its step's detail view.</div>
  `;
}
