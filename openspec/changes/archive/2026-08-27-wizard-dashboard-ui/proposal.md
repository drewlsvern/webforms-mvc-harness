## Why

The current web UI is a bare single column that fully replaces its content on every navigation, with live progress only for crawl and no way to glance at overall migration progress. As the primary interface for running a migration (per the wizard-shell design), it needs to actually read like a dashboard: where am I, what's running right now, what happened before — at a glance, without losing context every time you drill into a step's detail.

## What Changes

- Replace the plain stepper nav with a horizontal status strip of numbered cards (Scan, Crawl, Requirements, Slices, Select), each showing a title, a one-line status/summary detail, and a five-state border/icon (complete, active, error, warning, pending) — including a proper visual home for crawl's existing "paused, awaiting re-authentication" state, which the current stepper only shows as an undifferentiated gate status. A headline "X of Y steps complete" indicator accompanies the strip.
- Add click-to-navigate on step cards: clicking a card jumps the left column to that step.
- Restructure the main content area into two columns: a left column showing a compact step list with inline actions (approve/reject/run/select) that toggles in place into that step's full detail view (the existing scan/crawl/requirements/slices/select content) with a way back — not a modal, not full-page navigation — and a right column stacking a live Console above a History panel.
- Generalize the crawl-only live-progress mechanism (`src/crawler/progress.ts`) so Scan, Requirements, and Slices also report a `started` event and a final summary event (matching the counts the CLI already prints), while crawl's existing per-page live feed is unchanged. The Console panel renders whichever is currently relevant.
- Add the History panel as a UI slot only — an explicit placeholder/empty state, since durable task-history persistence is a separate, deferred change.

Out of scope: durable JSON-based task-history persistence (a follow-up change), and Select's step-completion criteria for the "X of Y" count (depends on the not-yet-designed AI conversion stage — captured as an open question in design.md, not decided here).

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `migration-wizard-shell`: the stepper requirement is reworked into the card-based status strip (five-state visual system, click-to-navigate); new requirements cover the left-column list/detail toggle and the Console/History panel slots in the right column.
- `migration-live-progress`: new requirements cover the `started`/summary events for Scan, Requirements, and Slices, explicit that crawl's existing per-page behavior is unaffected.

## Impact

- Reworks `src/server/public/app.js`, `index.html`, `styles.css`, and every view under `src/server/public/views/` to fit the two-column, list/detail-toggle layout.
- Generalizes `src/crawler/progress.ts` (crawl-specific today) into a stage-agnostic progress bus; `src/scanner/scan.ts`, `src/requirements/synthesize.ts`, and `src/slices/detectSlices.ts` each emit `started`/summary events.
- Extends the SSE surface on the server (`src/server/app.ts`) so the Console can subscribe to progress for any stage, not just crawl.
- No changes to evidence store schemas, gate mechanics, or CLI behavior — this is a UI/observability layer change.
