## 1. Slice data model changes

- [x] 1.1 Add `status: "not_started" | "selected" | "done"` to `SliceEvidence`, defaulting new slices to `not_started`
- [x] 1.2 Change `detectSlices.ts` to write the shared/common layer as a dedicated shared slice (empty `pages`, a new `componentRefs` field listing its member UserControls/Presenters) instead of ownerless `SharedComponentEvidence` records
- [x] 1.3 Change every feature slice's `dependsOn` to reference the shared slice's id instead of individual component records
- [x] 1.4 Implement `requirementRefs` derivation (join `slice.pages` against every requirement's `pageId`) as a shared function used by both `detectSlices.ts` and `editSlices.ts`
- [x] 1.5 Update `editSlices.ts`'s `recomputeAndPersist` to recompute `requirementRefs` via that shared function, removing the old union-on-merge/copy-on-split logic
- [x] 1.6 Update `promoteSharedComponent`/`demoteSharedComponent` to add/remove a component from the shared slice's `componentRefs` (rather than a standalone `SharedComponentEvidence` file)

## 2. Slice-selection stage

- [x] 2.1 Implement `locked`/`ready` computation from a slice's `dependsOn` and the shared slice's `status`
- [x] 2.2 Implement `selectSlice(store, sliceId)`: rejects if the slice is `locked`, rejects if another slice is already `selected`, otherwise sets status to `selected`
- [x] 2.3 Implement a query returning every slice's computed lifecycle state (`locked`/`ready`/`selected`/`done`) for rendering

## 3. Move-pages composed action

- [x] 3.1 Implement `movePages(store, pageIds, fromSliceId, toSliceId)`: merge if `pageIds` covers all of `fromSliceId`'s pages, otherwise split then merge
- [x] 3.2 Unit test both branches (whole-slice move, partial move)

## 4. CLI

- [x] 4.1 Add CLI entry point wrapping `pipeline.ts`'s stage runners
- [x] 4.2 Add stage commands (`scan`, `crawl`, `requirements`, `slices`) each running the corresponding stage in-process
- [x] 4.3 Add gate commands with `--approve` / `--reject "<comment>"` flags
- [x] 4.4 Add a `select <slice-id>` command
- [x] 4.5 Add artifact-summary printing (page/slice/requirement counts, table output) for each stage

## 5. Web server + API

- [x] 5.1 Set up the local web server process, importing `pipeline.ts`
- [x] 5.2 Add read endpoints for every evidence type (scan pages, crawl runs, requirements, slices, gates, run state)
- [x] 5.3 Add action endpoints: run stage, approve/reject gate, merge/split/move/promote/demote, select slice
- [x] 5.4 Enforce action gating server-side (reject an action `run.json` doesn't currently allow), independent of what the UI shows

## 6. Web UI shell

- [x] 6.1 Build the persistent stepper component (Scan/Crawl/Requirements/Slices/Select, gate status per stage)
- [x] 6.2 Build per-stage artifact browser views (scan page detail, crawl run detail, requirements list, slice list)
- [x] 6.3 Build the slice gate editing UI: merge, split, move-pages, promote, demote — each calling its corresponding API action
- [x] 6.4 Build the slice-selection screen: slice cards showing locked/ready/selected status, single-select action
- [x] 6.5 Enforce unrestricted browsing regardless of current stage, with only actions gated per current `run.json` state
- [x] 6.6 Enforce scan/crawl/requirements gates as approve/reject-with-comment only (no field editor)

## 7. Tests

- [x] 7.1 Integration test: shared slice promoted correctly, dependent slices `locked` until shared slice `status` is manually set to `done` in the test
- [x] 7.2 Integration test: select rejects a locked slice, rejects a second selection while one is already `selected`
- [x] 7.3 Integration test: `requirementRefs` correct after initial detection and after a merge/split
- [x] 7.4 API test: action endpoints reject actions `run.json` doesn't currently allow
