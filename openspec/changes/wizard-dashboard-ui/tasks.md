## 1. Generalize the progress bus

- [x] 1.1 Relocate/generalize `src/crawler/progress.ts` into a stage-agnostic module (e.g. `src/pipeline/progress.ts`) carrying a `stage` field on every event; keep crawl's existing `visiting`/`captured`/`paused`/`complete` event kinds unchanged
- [x] 1.2 Add `started` and `summary` event kinds to the shared type
- [x] 1.3 Update `src/crawler/crawl.ts` and all its callers/imports to the relocated module
- [x] 1.4 Update the server's SSE endpoint (`src/server/app.ts`) to stream events for any stage, not just crawl (rename `/api/crawl/progress` or add a general endpoint - keep crawl's existing consumers working)

## 2. Emit started/summary events from the other stages

- [x] 2.1 `src/scanner/scan.ts`: emit `started` on entry, `summary` on completion with page/control/presenter counts
- [x] 2.2 `src/requirements/synthesize.ts`: emit `started`/`summary` with functional/non-functional counts
- [x] 2.3 `src/slices/detectSlices.ts`: emit `started`/`summary` with slice count and shared-slice presence
- [x] 2.4 Unit test: each stage's summary event carries the same counts as its CLI summary output

## 3. Status strip

- [x] 3.1 Build the card component: number, title, one-line detail, five-state border/icon (complete/active/error/warning/pending)
- [x] 3.2 Compute each gated stage's state from its gate status; compute crawl's warning state from its pause condition
- [x] 3.3 Compute the headline "X of Y" count from the four gated stages only (Select excluded per design.md Open Questions)
- [x] 3.4 Wire card click to navigate the left column to that step

## 4. Two-column layout shell

- [x] 4.1 Replace the single `<main>` content area with the two-column layout (left/right) in `index.html` and `styles.css`
- [x] 4.2 Left column: compact step list with inline actions (approve/reject/run/select) per step, driven by existing gate/state data
- [x] 4.3 Left column: toggle from list to a step's full detail view in place (mount the existing `renderScan`/`renderCrawl`/`renderRequirements`/`renderSlices`/`renderSelect` functions here, unchanged), with a back control to return to the list
- [x] 4.4 Confirm the right column (console + history) stays visible and unaffected while the left column is in detail mode

## 5. Console panel

- [x] 5.1 Build a console component subscribing to the generalized SSE endpoint, tracking whichever stage is currently active or was most recently run
- [x] 5.2 Render crawl's per-page events as today's live feed (reuse existing rendering)
- [x] 5.3 Render `started`/`summary` events for Scan/Requirements/Slices as a compact summary block
- [x] 5.4 Mount the console in the right column, independent of what the left column is showing

## 6. History panel

- [x] 6.1 Build the history panel UI slot, stacked below the console in the right column
- [x] 6.2 Render an explicit empty state ("no history yet") - no backend history log in this change

## 7. Styling

- [x] 7.1 Card and status-strip styling (five-state colors/borders, numbering, connecting line)
- [x] 7.2 Two-column layout styling (responsive down to a reasonable minimum width)
- [x] 7.3 Console and history panel styling

## 8. Tests

- [x] 8.1 Browser-driven test: card states render correctly for each of the five states (use fixture gate data for complete/active/error/pending; simulate a paused crawl for warning)
- [x] 8.2 Browser-driven test: clicking a card navigates the left column to that step
- [x] 8.3 Browser-driven test: left column toggles list → detail → back without losing the console/history panels
- [x] 8.4 Browser-driven test: console shows live per-page updates during a crawl and a start/summary pair during a scan
