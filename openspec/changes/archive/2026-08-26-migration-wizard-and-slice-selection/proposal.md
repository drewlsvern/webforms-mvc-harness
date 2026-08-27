## Why

The discovery pipeline (scan, crawl, requirements, slices) exists as a headless engine with no way for a human to drive it, review its output, or act on it — every stage today is only reachable by calling TypeScript functions directly. Before any AI-assisted conversion work can start, someone needs to actually run the pipeline, review evidence at each gate, and pick which slice to build next. This change adds that interactive layer and the one missing stage the engine doesn't have yet: choosing a slice to work on.

## What Changes

- Add a CLI that runs the discovery engine (`pipeline.ts`) in-process: run a stage, approve/reject a gate (with `--approve`/`--reject "comment"` flags for scripting), and print artifact summaries.
- Add a local web server (also built on `pipeline.ts`) serving a web UI that is the **primary** way to run a migration; the CLI is the secondary, scriptable surface.
- Add a persistent wizard shell (stepper across Scan → Crawl → Requirements → Slices → Select) that allows browsing any already-produced artifact at any time, while gating only the actions that advance the pipeline (run next stage, approve/reject a gate, select a slice) on current `run.json` state.
- Add a new **slice-selection** stage: after the slices gate is approved, a reviewer selects exactly one `ready` slice per round to work on next. A slice is `locked` while it depends on the shared slice and the shared slice isn't yet `done`, otherwise `ready`. This change owns the `not_started → selected` transition on slice status; a future conversion change owns `selected → done`.
- Add web/CLI editing for the slice gate: merge and split (reusing existing engine primitives unchanged), a composed "move page(s) to another slice" action (implemented as merge or split+merge, exposed as one step), and demote-as-clean-removal for correcting a scanner false-positive shared-component match.
- Auto-derive `requirementRefs` on every slice from its page membership instead of leaving it empty, and recompute it (along with `dependsOn`) whenever slices are merged or split.
- **BREAKING**: Shared components are no longer "ownerless" — they now belong to one dedicated shared slice that every dependent slice must wait on.

Out of scope for this change (a companion change covers it separately): crawl authentication and live/SSE progress streaming during crawl. Also out of scope: the AI conversion stage itself, and the "assign a demoted component to one owning slice" editing option (deferred — needs data-model work nothing has validated the need for yet).

## Capabilities

### New Capabilities
- `migration-wizard-shell`: the CLI + web UI orchestration layer over the discovery engine — the stepper, unrestricted artifact browsing, gated pipeline actions, and the constraint that only the slice gate gets structured editing (scan/crawl/requirements gates stay approve-or-reject-with-comment only).
- `slice-selection`: the new pipeline stage where a reviewer picks exactly one `ready` slice per round to work on next, including the `locked`/`ready` computation and the `not_started`/`selected` status lifecycle.

### Modified Capabilities
- `webforms-slice-detection`: shared components are now promoted into a dedicated shared slice (not an ownerless layer); the slice-gate-editing requirement gets explicit scenarios for promote/demote (previously named but unspecified); a new requirement covers `requirementRefs` being auto-derived from page membership rather than left empty.

## Impact

- New CLI entry point and command surface over `pipeline.ts`.
- New local web server + web UI, both reading/writing the existing `.migration/` JSON store — no new sync mechanism, no new persistence layer.
- Extends `SliceEvidence` with a `status` field (`not_started` | `selected`; `done` reserved for a future change).
- Changes `detectSlices.ts` to write a dedicated shared slice instead of ownerless `SharedComponentEvidence` records, and to auto-populate `requirementRefs`.
- Changes `editSlices.ts`'s `recomputeAndPersist` to also recompute `requirementRefs` on merge/split instead of carrying it over.
