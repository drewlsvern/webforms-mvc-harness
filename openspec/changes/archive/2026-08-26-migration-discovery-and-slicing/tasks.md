## 1. Evidence store foundation

- [x] 1.1 Define JSON schemas for `run.json` and each gate record (`{ stage, status, artifactHash, reviewedBy, comment, reviewedAt }`)
- [x] 1.2 Implement the `.migration/` directory scaffolding (scan/, crawl/, requirements/, slices/, gates/)
- [x] 1.3 Implement Markdown regeneration from JSON (one renderer per artifact type: scan page, crawl page, requirements, slice)
- [x] 1.4 Implement the gate lifecycle: create pending gate, approve, reject+comment, structured field edit re-hashing the artifact
- [x] 1.5 Implement content hashing for evidence artifacts, stored on gate approval

## 2. Static scanner

- [x] 2.1 Implement `.aspx`/`.master` markup parser: extract Master Page reference, controls used, `<asp:Content>` block boundaries
- [x] 2.2 Implement code-behind parser: extract event handlers, `PostBackUrl` targets, `Response.Redirect`/`Server.Transfer` calls inside postback handlers
- [x] 2.3 Implement content-area hyperlink extraction, explicitly excluding links sourced from a Master Page
- [x] 2.4 Implement Presenter/Model/UserControl reference extraction per page
- [x] 2.5 Implement scan evidence writer (`scan/pages/*.json`, `scan/controls/*.json`, `scan/presenters/*.json`, `scan/index.json`)
- [x] 2.6 Wire scan completion to create the `scan.gate.json` pending gate

## 3. Runtime crawler

- [x] 3.1 Set up Playwright driver and configuration (target app URL, auth fixture/session handling)
- [x] 3.2 Implement route seeding from `scan/index.json`
- [x] 3.3 Implement per-page capture: DOM snapshot, screenshot, network activity log, interaction log
- [x] 3.4 Implement crawl evidence writer (`crawl/pages/<Page>/run-<ts>/*`, `crawl/index.json`)
- [x] 3.5 Wire crawl completion to create the `crawl.gate.json` pending gate

## 4. Requirements synthesis

- [x] 4.1 Define functional requirement record shape and its evidence-reference field(s)
- [x] 4.2 Define non-functional requirement record shape and its evidence-reference field(s)
- [x] 4.3 Implement templated functional-requirement generation from scan + crawl evidence
- [x] 4.4 Implement templated non-functional-requirement generation from crawl evidence
- [x] 4.5 Implement requirements evidence writer (`requirements/functional.json`/`.md`, `requirements/nonfunctional.json`/`.md`)
- [x] 4.6 Wire requirements completion to create the `requirements.gate.json` pending gate

## 5. Slice detection

- [x] 5.1 Implement page graph construction from scan evidence navigation edges (PostBackUrl, Redirect/Transfer, content-area hyperlinks)
- [x] 5.2 Implement connected-component computation over the page graph (undirected)
- [x] 5.3 Implement shared-component promotion pass: detect UserControls/Presenters referenced across >1 slice, promote to shared/common layer, record `dependsOn` on referencing slices
- [x] 5.4 Implement slice evidence writer (`slices/<slice-name>/slice.json`/`.md`)
- [x] 5.5 Implement gate-driven merge/split/promote/demote operations on the proposed slice list
- [x] 5.6 Wire slice list completion to create the `slices.gate.json` pending gate

## 6. Pipeline wiring

- [x] 6.1 Implement `run.json` state tracking (current stage, gate statuses) across stages 1-6
- [x] 6.2 Enforce stage ordering: a stage only runs once its predecessor's gate is approved
- [x] 6.3 Write integration test(s) covering a small fixture WebForms app through scan → crawl → requirements → slices, verifying gates block/unblock correctly
