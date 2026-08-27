## Context

The current web UI (`src/server/public/`) is a single `<main>` element whose entire content gets replaced per route (`app.js`'s `renderRoute`), with a plain pill-style stepper and no live progress except for crawl (added in `crawl-auth-and-live-progress`). See proposal.md for why that's no longer enough now that the web UI is the primary interface. This design covers the layout restructure and the progress-bus generalization it depends on; it does not touch the evidence store, gates, or CLI.

## Goals / Non-Goals

**Goals:**
- A status strip that's readable at a glance: which steps are done, which is active, and which needs attention (the warning state didn't have a home before this).
- A layout where reviewing a step's detail and watching live/summary progress are never mutually exclusive.
- One progress-event mechanism used by every stage, not a crawl-only special case.

**Non-Goals:**
- Durable task-history persistence. The History panel is a UI slot with an empty state; wiring it to real data is a separate change.
- Resolving what "complete" means for Select. See Open Questions.
- Any change to gate semantics, evidence schemas, or the CLI - this is presentation and progress-reporting only.

## Decisions

### Two-column layout, not a modal, for step detail

The left column toggles in place between a compact step list and a step's full detail view; the right column (console + history) stays fixed regardless. A modal for detail view was considered and rejected: the moment a reviewer opens a step's detail is to decide whether to approve/reject its gate, which is exactly when they also want the console's summary of what just happened - a modal that covers the console works against the one interaction it needs to support.

### Five states, not a binary done/not-done

Complete / active / error / warning / pending. The warning state is the one addition beyond an obvious done-or-not model, and it maps directly onto crawl's existing "paused, awaiting re-authentication" state, which today only surfaces as an undifferentiated part of the gate status with no distinct visual treatment. No new backend state is needed - `warning` is a UI-level classification derived from existing data (crawl's pending-routes marker / pause condition from the auth change), not a new persisted status.

### Progress bus generalized, but not made uniform

Crawl keeps its existing per-page event granularity (`visiting`/`captured`/`paused`/`complete`) because crawl is genuinely slow enough that per-item feedback matters. Scan, Requirements, and Slices get only `started` and one final summary event - they're synchronous and typically fast, and inventing per-file progress for them (e.g. "scanned 40/120 files") isn't justified by anything observed yet. If a real run against a large app shows Scan taking long enough that a single "started...done" pair feels like it's hung, add finer granularity then rather than now.

**Alternative considered:** give every stage the same per-item event granularity as crawl, for a uniform console. Rejected as unnecessary complexity for stages that already return in well under a second in every case tested so far - the summary event carries the same counts the CLI's `printScanSummary`/etc. already produce, so there's no new computation, just a new place it gets emitted.

### `src/crawler/progress.ts` becomes stage-agnostic

The existing `crawlProgress` EventEmitter and `CrawlProgressEvent` type are crawl-specific. This change generalizes them (likely relocating to something like `src/pipeline/progress.ts`) to carry a `stage` field and a shared `started`/`summary` shape, with crawl's existing per-page event kinds layered on top rather than replaced. The SSE endpoint on the server generalizes similarly so the Console can subscribe regardless of which stage is active.

## Risks / Trade-offs

- **[Risk]** Refactoring every existing view (`scan.js`, `crawl.js`, `requirements.js`, `slices.js`, `select.js`) to fit the list/detail-toggle pattern touches a lot of UI surface at once → **Mitigation:** the underlying render functions and API calls don't change, only how/where they're mounted - this is a container-level refactor, not a rewrite of each view's logic.
- **[Risk]** Generalizing the progress bus could regress crawl's existing, already-tested live feed if not done carefully → **Mitigation:** treat crawl's current event kinds as the ones to preserve unmodified; the generalization only needs to add `started`/`summary` handling for the other three stages alongside them, not restructure what crawl already emits.

## Open Questions

- What makes Select "complete" for the headline count? Deferred until the AI conversion stage is designed - selection can run many rounds and doesn't have a terminal state yet. For now, Select still renders a card (present, clickable, navigable like the others) but is excluded from the "X of Y" numerator and denominator, which is scoped to the four gated stages only. Revisit once conversion's slice-completion lifecycle (`selected → done`) is designed.
