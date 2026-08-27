## Context

The discovery engine (`src/pipeline/pipeline.ts`, `src/slices/editSlices.ts`, the evidence store) already exists from the archived `migration-discovery-and-slicing` change — see proposal.md for why an interactive layer is needed on top of it. This change adds that layer plus the slice-selection stage. A companion change (proposed separately) adds crawl authentication and SSE-based live progress; this design treats that stage's screen as a placeholder the companion change fills in, not something built here.

## Goals / Non-Goals

**Goals:**
- Two clients (CLI, web UI) sharing one engine and one evidence store, with no new sync mechanism between them.
- A wizard shell whose gating rules (what's browsable vs. what's actionable) are simple enough to reason about: browsing is always allowed, actions check `run.json`.
- A slice data model that supports the shared-slice ownership model and the `not_started`/`selected` status lifecycle without overreaching into `selected → done`, which belongs to a future change.

**Non-Goals:**
- Live/SSE progress streaming (companion change).
- Crawl authentication (companion change).
- The AI conversion stage.
- The "assign a demoted component to one owning slice" editing option — deferred; see Risks/Trade-offs.
- Concurrent-write locking between the CLI and web server touching `.migration/` at the same time. Both are expected to be used by one person, one action at a time; if that assumption breaks down in practice, add locking then rather than now.

## Decisions

### Two processes, one store, no server dependency for the CLI

The CLI imports `pipeline.ts` directly and runs stages/gates in-process — it never talks to the web server, and does not require one to be running. The web server is a separate process that also imports `pipeline.ts` and additionally serves the web UI + its own API. Both read and write the same `.migration/` JSON files. This preserves the CLI's "just works, no server" property while letting the web UI be the fuller, primary experience.

**Alternative considered:** CLI as a thin HTTP client of the web server (so there's only one place "how a stage runs" is implemented). Rejected because it would make the CLI depend on a server being up, which cuts against it being a fast, scriptable, always-available fallback.

### Shared slice: a real slice, not a special-cased bucket

The shared slice is stored and represented as an ordinary `SliceEvidence` record (reusing the existing shape) whose `pages` field is empty and which instead lists its member UserControls/Presenters. Every other slice that references a promoted component records the shared slice's id in its `dependsOn`, replacing the old model of `dependsOn` pointing at individual `SharedComponentEvidence` records with no owner. This is the `MODIFIED` delta on `webforms-slice-detection`. One shared slice exists per app (no further clustering) — deliberately simple; see Risks/Trade-offs.

**Alternative considered:** keep the ownerless `SharedComponentEvidence` layer and bolt a separate "must build shared components first" rule onto the selection logic without giving it a slice identity. Rejected because slice-selection, status tracking, and (eventually) conversion all already operate in terms of slices — giving the shared layer its own slice identity means it flows through every one of those mechanisms for free instead of needing special-cased handling in each.

### `locked`/`ready` are computed, `not_started`/`selected` are stored

Only two of the four lifecycle states need persistence. `locked` and `ready` are pure functions of `(slice.dependsOn, sharedSlice.status)` and are recomputed on every read — there's nothing to get out of sync. `not_started` and `selected` are facts about a choice someone made and must be persisted on `SliceEvidence.status`. `done` is reserved (present in the type, never written by this change) so the future conversion change has a field to write to rather than needing another migration.

### `requirementRefs` becomes a derived field, computed the same place `dependsOn` already is

`recomputeAndPersist` in `editSlices.ts` already recomputes `dependsOn` after every merge/split. This change adds `requirementRefs` recomputation to that same function (join slice.pages against every requirement's `pageId`), and makes `detectSlices.ts` compute it the same way on first generation instead of writing `[]`. One derivation function, used in both places, rather than two separate pieces of copy-management logic (the old union-on-merge/copy-on-split code being deleted).

## Risks / Trade-offs

- **[Risk]** One shared slice for the entire app could become an awkward, large first conversion unit on a big application with a heterogeneous shared layer → **Mitigation:** deliberately deferred; revisit clustering (grouping shared components the same way pages are clustered into slices) only if a real run shows this is a problem in practice.
- **[Risk]** Demote-as-clean-removal can silently drop a real (not false-positive) dependency's build-order guarantee if a reviewer misuses it → **Mitigation:** UI copy frames demote explicitly as "not actually shared / correcting a scanner mismatch," not as a general "stop enforcing this" toggle. The safer "assign to one owning slice" alternative is deferred rather than built now, since its data model isn't validated by any real use yet.
- **[Risk]** No locking between CLI and web server processes writing `.migration/` concurrently → **Mitigation:** accepted for now under a single-user, single-action-at-a-time usage assumption; revisit if that assumption proves wrong.

## Open Questions

- Should the CLI's non-interactive flags (`--approve`, `--reject`) also support the slice-gate structured edits (merge/split/move/promote/demote), or is rich editing web-UI-only for v1? Doesn't change the specs or task breakdown either way — can default to "web UI only for editing, CLI for approve/reject" during implementation and revisit if scripting a merge/split turns out to matter.
