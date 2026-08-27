import { rm } from "node:fs/promises";
import path from "node:path";
import type { PageScanEvidence, ScanIndex, SharedComponentKind, SliceEvidence, SliceIndex } from "../types/evidence.ts";
import type { MigrationStore } from "../store/paths.ts";
import { sliceEvidencePaths } from "../store/paths.ts";
import { readJson, writeJson } from "../store/jsonFile.ts";
import { promoteSharedComponents } from "./sharedPromotion.ts";
import { deriveRequirementRefs, loadRequirementIndex } from "./requirementLinks.ts";
import { writeSliceEvidence } from "./writeSlices.ts";
import { SHARED_SLICE_ID } from "./sharedSlice.ts";

export async function loadCurrentSlices(store: MigrationStore): Promise<SliceEvidence[]> {
  const index = await readJson<SliceIndex>(store.slicesIndexFile);
  const slices: SliceEvidence[] = [];
  for (const id of index.slices) {
    slices.push(await readJson<SliceEvidence>(sliceEvidencePaths(store, id).json));
  }
  return slices;
}

async function loadPagesById(store: MigrationStore): Promise<Map<string, PageScanEvidence>> {
  const scanIndex = await readJson<ScanIndex>(store.scanIndexFile);
  const map = new Map<string, PageScanEvidence>();
  for (const pageId of scanIndex.pages) {
    map.set(pageId, await readJson<PageScanEvidence>(path.join(store.scanPagesDir, `${pageId}.json`)));
  }
  return map;
}

/**
 * Recomputes shared-component promotion and requirement links for the given
 * feature-slice list, folds in the (possibly recomputed) shared slice, and
 * persists everything including the index.
 */
async function recomputeAndPersist(store: MigrationStore, slices: SliceEvidence[]): Promise<SliceEvidence[]> {
  const existingShared = slices.find((s) => s.id === SHARED_SLICE_ID);
  const featureSlices = slices.filter((s) => s.id !== SHARED_SLICE_ID);

  const pagesById = await loadPagesById(store);
  const sliceAssignment = new Map<string, string>();
  for (const slice of featureSlices) for (const pageId of slice.pages) sliceAssignment.set(pageId, slice.id);

  const pages = [...new Set(featureSlices.flatMap((s) => s.pages))]
    .map((pageId) => pagesById.get(pageId))
    .filter((p): p is PageScanEvidence => Boolean(p));

  const { sharedComponentRefs, sliceComponentUsage } = promoteSharedComponents(pages, sliceAssignment);
  const requirementIndex = await loadRequirementIndex(store);

  const updatedFeatureSlices: SliceEvidence[] = featureSlices.map((s) => {
    const usage = sliceComponentUsage.get(s.id);
    return {
      ...s,
      componentRefs: [],
      dependsOn: usage && usage.length > 0 ? [{ sliceId: SHARED_SLICE_ID, components: usage }] : [],
      requirementRefs: deriveRequirementRefs(s.pages, requirementIndex),
    };
  });

  const updatedSlices: SliceEvidence[] = [...updatedFeatureSlices];
  if (sharedComponentRefs.length > 0) {
    updatedSlices.push({
      id: SHARED_SLICE_ID,
      pages: [],
      componentRefs: sharedComponentRefs,
      dependsOn: [],
      requirementRefs: [],
      status: existingShared?.status ?? "not_started",
    });
  } else if (existingShared) {
    await rm(sliceEvidencePaths(store, SHARED_SLICE_ID).dir, { recursive: true, force: true });
  }

  for (const slice of updatedSlices) await writeSliceEvidence(store, slice);

  const index: SliceIndex = {
    slices: updatedSlices.map((s) => s.id).sort(),
    sharedSliceId: sharedComponentRefs.length > 0 ? SHARED_SLICE_ID : null,
    generatedAt: new Date().toISOString(),
  };
  await writeJson(store.slicesIndexFile, index);

  return updatedSlices;
}

/** Reviewer action at the slice gate: combine two or more slices into one. */
export async function mergeSlices(store: MigrationStore, sliceIds: string[], newId?: string): Promise<SliceEvidence> {
  if (sliceIds.length < 2) throw new Error("mergeSlices requires at least two slice ids");
  const current = await loadCurrentSlices(store);
  const toMerge = current.filter((s) => sliceIds.includes(s.id));
  if (toMerge.length !== sliceIds.length) throw new Error("One or more slice ids were not found");

  const mergedId = newId ?? toMerge[0]!.id;
  const merged: SliceEvidence = {
    id: mergedId,
    pages: [...new Set(toMerge.flatMap((s) => s.pages))].sort(),
    componentRefs: [],
    dependsOn: [],
    requirementRefs: [],
    status: "not_started",
  };

  for (const slice of toMerge) {
    if (slice.id !== mergedId) await rm(sliceEvidencePaths(store, slice.id).dir, { recursive: true, force: true });
  }

  const remaining = current.filter((s) => !sliceIds.includes(s.id));
  const updated = await recomputeAndPersist(store, [...remaining, merged]);
  return updated.find((s) => s.id === mergedId)!;
}

/** Reviewer action at the slice gate: split one slice into several, given an exhaustive page partition. */
export async function splitSlice(
  store: MigrationStore,
  sliceId: string,
  groups: { id: string; pages: string[] }[],
): Promise<SliceEvidence[]> {
  const current = await loadCurrentSlices(store);
  const target = current.find((s) => s.id === sliceId);
  if (!target) throw new Error(`Unknown slice "${sliceId}"`);

  const groupedPages = new Set(groups.flatMap((g) => g.pages));
  const targetPages = new Set(target.pages);
  for (const pageId of groupedPages) {
    if (!targetPages.has(pageId)) throw new Error(`Page "${pageId}" does not belong to slice "${sliceId}"`);
  }
  for (const pageId of targetPages) {
    if (!groupedPages.has(pageId)) throw new Error(`Split groups must cover every page in "${sliceId}"; missing "${pageId}"`);
  }

  await rm(sliceEvidencePaths(store, sliceId).dir, { recursive: true, force: true });

  const newSlices: SliceEvidence[] = groups.map((g) => ({
    id: g.id,
    pages: [...g.pages].sort(),
    componentRefs: [],
    dependsOn: [],
    requirementRefs: [],
    status: "not_started",
  }));

  const remaining = current.filter((s) => s.id !== sliceId);
  const updated = await recomputeAndPersist(store, [...remaining, ...newSlices]);
  const newIds = new Set(groups.map((g) => g.id));
  return updated.filter((s) => newIds.has(s.id));
}

/**
 * Reviewer action: move one or more pages from one slice to another as a
 * single step. Moving every page out of the source slice is just a merge;
 * moving a subset is a split (source vs. moved pages) followed by a merge
 * of the moved group into the target - the caller never sees those as two
 * separate operations.
 */
export async function movePages(
  store: MigrationStore,
  pageIds: string[],
  fromSliceId: string,
  toSliceId: string,
): Promise<SliceEvidence[]> {
  if (pageIds.length === 0) throw new Error("movePages requires at least one page id");
  if (fromSliceId === toSliceId) throw new Error("fromSliceId and toSliceId must differ");

  const current = await loadCurrentSlices(store);
  const from = current.find((s) => s.id === fromSliceId);
  if (!from) throw new Error(`Unknown slice "${fromSliceId}"`);
  if (!current.some((s) => s.id === toSliceId)) throw new Error(`Unknown slice "${toSliceId}"`);

  const moving = new Set(pageIds);
  for (const pageId of moving) {
    if (!from.pages.includes(pageId)) throw new Error(`Page "${pageId}" does not belong to slice "${fromSliceId}"`);
  }

  if (from.pages.length === moving.size) {
    const merged = await mergeSlices(store, [fromSliceId, toSliceId], toSliceId);
    return [merged];
  }

  const movedGroupId = `${fromSliceId}__move-${Date.now()}`;
  const remainder = from.pages.filter((p) => !moving.has(p));
  await splitSlice(store, fromSliceId, [
    { id: fromSliceId, pages: remainder },
    { id: movedGroupId, pages: [...moving] },
  ]);
  const merged = await mergeSlices(store, [movedGroupId, toSliceId], toSliceId);
  const remainderSlice = await readJson<SliceEvidence>(sliceEvidencePaths(store, fromSliceId).json);
  return [remainderSlice, merged];
}

/** Reviewer action: force a component into the shared slice even if only one slice currently references it. */
export async function promoteSharedComponent(
  store: MigrationStore,
  kind: SharedComponentKind,
  id: string,
  sliceId: string,
): Promise<SliceEvidence> {
  if (sliceId === SHARED_SLICE_ID) throw new Error("Cannot promote a component from the shared slice itself");
  const slices = await loadCurrentSlices(store);
  const slice = slices.find((s) => s.id === sliceId);
  if (!slice) throw new Error(`Unknown slice "${sliceId}"`);

  const existingShared = slices.find((s) => s.id === SHARED_SLICE_ID);
  const shared: SliceEvidence = existingShared ?? {
    id: SHARED_SLICE_ID,
    pages: [],
    componentRefs: [],
    dependsOn: [],
    requirementRefs: [],
    status: "not_started",
  };
  if (!shared.componentRefs.some((c) => c.kind === kind && c.id === id)) {
    shared.componentRefs = [...shared.componentRefs, { kind, id }];
  }
  await writeSliceEvidence(store, shared);

  const existingDep = slice.dependsOn.find((d) => d.sliceId === SHARED_SLICE_ID);
  if (!existingDep) {
    slice.dependsOn = [...slice.dependsOn, { sliceId: SHARED_SLICE_ID, components: [{ kind, id }] }];
  } else if (!existingDep.components.some((c) => c.kind === kind && c.id === id)) {
    existingDep.components = [...existingDep.components, { kind, id }];
  }
  await writeSliceEvidence(store, slice);

  await refreshIndexPreservingManualEdits(store);
  return shared;
}

/** Reviewer action: remove a component from the shared slice, dropping it from every slice's dependency list. */
export async function demoteSharedComponent(store: MigrationStore, kind: SharedComponentKind, id: string): Promise<void> {
  const slices = await loadCurrentSlices(store);
  const shared = slices.find((s) => s.id === SHARED_SLICE_ID);
  if (!shared) return;

  for (const slice of slices) {
    if (slice.id === SHARED_SLICE_ID) continue;
    const dep = slice.dependsOn.find((d) => d.sliceId === SHARED_SLICE_ID);
    if (!dep) continue;
    const remainingComponents = dep.components.filter((c) => !(c.kind === kind && c.id === id));
    if (remainingComponents.length === dep.components.length) continue;
    const updatedDependsOn =
      remainingComponents.length > 0
        ? slice.dependsOn.map((d) => (d.sliceId === SHARED_SLICE_ID ? { ...d, components: remainingComponents } : d))
        : slice.dependsOn.filter((d) => d.sliceId !== SHARED_SLICE_ID);
    await writeSliceEvidence(store, { ...slice, dependsOn: updatedDependsOn });
  }

  const remainingShared = shared.componentRefs.filter((c) => !(c.kind === kind && c.id === id));
  if (remainingShared.length === 0) {
    await rm(sliceEvidencePaths(store, SHARED_SLICE_ID).dir, { recursive: true, force: true });
  } else {
    await writeSliceEvidence(store, { ...shared, componentRefs: remainingShared });
  }

  await refreshIndexPreservingManualEdits(store);
}

/** Rewrites just the index from what's on disk, without re-running algorithmic promotion (would undo a manual promote/demote). */
async function refreshIndexPreservingManualEdits(store: MigrationStore): Promise<void> {
  const slices = await loadCurrentSlices(store);
  const hasShared = slices.some((s) => s.id === SHARED_SLICE_ID);
  const index: SliceIndex = {
    slices: slices.map((s) => s.id).sort(),
    sharedSliceId: hasShared ? SHARED_SLICE_ID : null,
    generatedAt: new Date().toISOString(),
  };
  await writeJson(store.slicesIndexFile, index);
}
