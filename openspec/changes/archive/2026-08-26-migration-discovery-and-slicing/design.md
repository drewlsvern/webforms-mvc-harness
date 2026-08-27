## Context

This is the foundation layer of a larger meta framework (see proposal.md - Why) for migrating an ASP.NET WebForms (MVVP-pattern) frontend to an already-scaffolded .NET 10 MVC project. The MVC target's authentication, authorization, and backend service code are treated as a black box and are out of scope entirely. This change covers only pipeline stages 1-6: scan, static evidence, runtime crawl, runtime evidence, requirements synthesis, and slice detection - plus the gate mechanism that governs every transition between them. AI-assisted conversion (stage 8), slice selection UX, and the CLI/web UI wizard shell are separate, later changes; this design treats them only as consumers of the artifact contract established here.

## Goals / Non-Goals

**Goals:**
- Define the on-disk evidence store shape (JSON source of truth, regenerated Markdown views) that stages 1-6 read and write.
- Define the gate mechanism's data shape and lifecycle (pending / approved / rejected, structured-field edits) generically enough that later stages (slice selection, conversion) can reuse it without a redesign.
- Fully specify the slice detection algorithm, since it was the most-debated design decision and needs to be unambiguous for implementation.
- Keep every stage in this change's scope deterministic and local - no AI/LLM calls anywhere in stages 1-6.

**Non-Goals:**
- Deciding where the WebForms source repo and MVC target repo live relative to this tool, or how converted output lands in the target repo. Noted as an open question below; resolve when the conversion-step change is scoped.
- Staleness/drift detection when WebForms source changes after a gate is approved. Assume a single linear pass through the pipeline for this change; re-scanning mid-flight is not handled.
- Conversion-attempt retry/feedback-loop semantics (how a rejected conversion informs a re-prompt). Out of scope until the conversion change.
- CLI vs. web UI specifics. This change defines the artifact contract both would render; it does not build either surface.

## Decisions

### Evidence store layout

```
.migration/
  run.json                        pipeline state: current stage, gate statuses, hashes, timestamps
  scan/
    pages/<Page>.aspx.json + .md  controls, navigation edges, presenter/model refs, master page, viewstate use
    controls/*.json               UserControl inventory
    presenters/*.json             Presenter/view-contract inventory
    index.json                    manifest: all pages, navigation edges, dependency graph
  crawl/
    pages/<Page>/run-<ts>/        dom.html, screenshot.png, network.json, interactions.json
    index.json
  requirements/
    functional.json + .md
    nonfunctional.json + .md
  slices/
    <slice-name>/slice.json + .md pages included, shared-component deps, requirement refs
  gates/
    scan.gate.json
    crawl.gate.json
    requirements.gate.json
    slices.gate.json
```

Each `<artifact>.json` is the sole source of truth; its paired `.md` is always regenerated, never hand-edited (migration-evidence-store spec). This resolves the "which one is real" problem that a bidirectional JSON<->Markdown sync would otherwise create, at the cost of gate edits only being able to touch fields the JSON schema exposes - freeform prose correction is not supported by design, matching the spec's structured-edit-only requirement.

**Alternative considered:** Markdown as source of truth, JSON as a derived index (would let reviewers freely rewrite requirements prose). Rejected because reconciling structured downstream consumption (slice detection, future AI conversion prompts) from freeform-edited prose is fragile, and the artifacts need to stay machine-consumable at every stage.

### Gate mechanism

A gate is a JSON record: `{ stage, status: pending|approved|rejected, artifactHash, reviewedBy, comment, reviewedAt }`. A stage's output is not consumed by the next stage until its gate's status is `approved`. Structured edits made during review are applied directly to the stage's evidence JSON (not to the gate record itself), and the gate then captures the hash of the post-edit artifact at approval time.

This is deliberately generic - the same shape is meant to be reused by the slice-selection gate and per-slice conversion gates in later changes, so this change treats the gate shape as a shared primitive rather than something scan/crawl/requirements/slices each define independently.

### Slice detection algorithm

Nodes = every `.aspx` page in scan evidence. Edges = three navigation signals captured by the static scanner:
1. `PostBackUrl` cross-page posting targets.
2. `Response.Redirect` / `Server.Transfer` calls made from inside a postback/event handler.
3. Hyperlinks found within a page's own `<asp:Content>` block.

Master Page-rendered links (nav menus, breadcrumbs, "home" links) are explicitly excluded from edge detection. This was the key correction made during design discussion: WebForms structurally separates Master Page chrome from page content (`<asp:Content>` regions), so filtering on that boundary is a free, zero-heuristic way to avoid every page collapsing into one giant connected component through a shared nav menu.

A slice is one connected component of this graph, computed treating all edges as undirected - a page that both posts to and is redirected back from another page is one slice regardless of direction.

**Rejected: `Web.sitemap`-based grouping.** The app's sitemap does not reliably reflect feature boundaries in this codebase.

**Rejected: Presenter/Model-sharing as the sole grouping signal.** Presenters can be legitimately reused across otherwise-distinct features (confirmed during design discussion - "shared presenter... it's the latter", meaning reuse, not evidence the two features are actually one). Using Presenter-sharing as a partition key would incorrectly merge unrelated slices.

**Shared/common layer:** any UserControl or Presenter referenced by pages spanning more than one computed slice is promoted out of slice ownership into a shared/common layer, recorded as a `dependsOn` entry on each referencing slice. This is a two-pass computation: first compute tentative slices from the page graph, then scan each slice's pages for UserControl/Presenter references and promote anything crossing a slice boundary.

**Known, accepted imperfection:** an off-convention link (e.g., placed outside `<asp:Content>` by mistake) may be missed by static edge detection. This is intentionally not solved with additional heuristics - it is the job of the human reviewer at the slice gate to merge/split slices and correct mis-attribution, per the migration-evidence-store gate mechanism.

### No-AI boundary for stages 1-6

Scanning, crawling, and slice detection are pure static/graph analysis; requirements synthesis is templated derivation from structured evidence fields. None of these stages call an AI/LLM (webforms-static-scanner, webforms-runtime-crawler, migration-requirements-synthesis, webforms-slice-detection specs). This keeps the expensive, harder-to-audit AI step scoped to exactly one place in the overall pipeline (conversion, out of scope here), and keeps stages 1-6 cheap to re-run and fully deterministic for a given source snapshot.

## Risks / Trade-offs

- **[Risk]** Connected-component slicing can still overshoot on unconventional page structures (e.g., a page that legitimately links to many unrelated pages from its content area, not just chrome) → **Mitigation:** the slice gate's merge/split review exists specifically to correct this; the algorithm is intentionally not tuned further to chase edge cases.
- **[Risk]** Requirements synthesis being purely templated may produce shallow non-functional requirements where crawl evidence doesn't clearly signal them → **Mitigation:** accepted for this change; the gate lets a reviewer flag gaps, and richer NFR inference is left for a later iteration rather than reached for now via AI (which would break the no-AI boundary for this stage).
- **[Risk]** JSON-only editing at gates means a reviewer who wants to rewrite requirement prose freely can't → **Mitigation:** accepted trade-off for machine-consumability; revisit only if reviewers find structured editing too restrictive in practice.

## Open Questions

- Where do the WebForms source repo and the .NET 10 MVC target repo live relative to this tool, and does `.migration/` live in one of them or in a third location? Doesn't affect this change's specs but will shape how the conversion-step change resolves file paths.
- Should staleness/drift detection (re-scan invalidating an already-approved gate) be added later, or is a single linear pipeline pass a durable assumption? Deferred - not needed for stages 1-6 as specified here.
