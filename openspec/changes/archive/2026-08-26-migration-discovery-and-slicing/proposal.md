## Why

Converting a large ASP.NET WebForms frontend to .NET 10 MVC by hand is slow and error-prone: WebForms encodes behavior across markup, code-behind, and postback wiring in ways that are easy to miss. Before any AI-assisted conversion happens, the team needs a trustworthy, reviewable picture of what the WebForms app actually does and how its pages group into convertible units of work. That picture has to come from deterministic, local analysis — not from an LLM guessing at behavior — so that the eventual AI conversion step has a grounded, human-approved brief to work from instead of raw source code.

## What Changes

- Introduce a local, file-based evidence store (JSON as source of truth, Markdown as a regenerated human-readable view) that every discovery stage reads from and writes to.
- Add a static scanner that parses `.aspx` / `.ascx` / `.master` markup and code-behind to produce structured scan evidence per page: controls used, postback/event wiring, Presenter and Model references, Master Page inheritance, ViewState usage.
- Add a Playwright-based runtime crawler that drives the live WebForms app to capture DOM snapshots, screenshots, network activity, and observed interactions per page, as a check against and supplement to static evidence.
- Add a requirements synthesis step that derives functional and non-functional requirements from the combined static + runtime evidence.
- Add a slice detection algorithm that groups pages into convertible feature units (View + Presenter + Model) using a locally-computed page graph, and separately identifies shared/common components (UserControls, reused Presenters) that don't belong to any single slice.
- Add a gate mechanism that pauses the pipeline after each stage (scan, crawl, requirements, slices) for human review, with approve / reject+comment / structured-field-edit as the only ways to modify an artifact.
- **BREAKING**: None — this is new tooling with no prior version.

Out of scope for this change: the AI-driven conversion step itself, slice-selection UX, where converted output lands relative to the WebForms/MVC repos, staleness/drift detection on re-scan, and the CLI/web UI wizard shell. These are deferred to later changes.

## Capabilities

### New Capabilities
- `migration-evidence-store`: the JSON-as-source-of-truth / Markdown-as-view artifact store, plus the gate mechanism (approve, reject+comment, structured edit) that governs every stage transition.
- `webforms-static-scanner`: local static analysis of WebForms markup and code-behind, producing per-page and per-component scan evidence.
- `webforms-runtime-crawler`: local Playwright-driven crawl of the running WebForms app, producing runtime evidence (DOM, screenshots, network, interactions) per page.
- `migration-requirements-synthesis`: derives functional and non-functional requirements from combined static and runtime evidence.
- `webforms-slice-detection`: builds a page-level graph from postback/redirect/content-link edges, computes slices as connected components, and promotes cross-slice-referenced UserControls/Presenters into a shared/common layer.

### Modified Capabilities
(none — no existing specs in this project yet)

## Impact

- New `.migration/` evidence store directory structure (scan/, crawl/, requirements/, slices/, gates/, run.json) written alongside the WebForms source and/or MVC target repos.
- New local tooling: a WebForms markup/code-behind parser, a Playwright crawl driver, a requirements templating engine, and a graph-based slicing algorithm — all deterministic, no AI/LLM calls in this change's scope.
- Establishes the artifact contract (JSON schema shapes for scan/crawl/requirements/slice evidence) that the future AI conversion step and CLI/web UI wizard will both depend on.
