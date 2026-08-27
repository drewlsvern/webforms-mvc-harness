import path from "node:path";
import type { PageScanEvidence, ScanIndex, SliceEvidence, SliceIndex } from "../types/evidence.ts";
import type { MigrationStore } from "../store/paths.ts";
import { readJson, writeJson } from "../store/jsonFile.ts";
import { createPendingGate } from "../store/gate.ts";
import { emitProgress } from "../pipeline/progress.ts";
import { buildPageGraph } from "./graph.ts";
import { computeConnectedComponents } from "./connectedComponents.ts";
import { assignSliceIds } from "./sliceId.ts";
import { promoteSharedComponents } from "./sharedPromotion.ts";
import { deriveRequirementRefs, loadRequirementIndex } from "./requirementLinks.ts";
import { writeSliceEvidence } from "./writeSlices.ts";
import { SHARED_SLICE_ID } from "./sharedSlice.ts";

export interface SliceDetectionResult {
  slices: SliceEvidence[];
  index: SliceIndex;
}

export async function runSliceDetection(store: MigrationStore): Promise<SliceDetectionResult> {
  emitProgress({ stage: "slices", type: "started" });

  const scanIndex = await readJson<ScanIndex>(store.scanIndexFile);
  const pages: PageScanEvidence[] = [];
  for (const pageId of scanIndex.pages) {
    pages.push(await readJson<PageScanEvidence>(path.join(store.scanPagesDir, `${pageId}.json`)));
  }

  const graph = buildPageGraph(pages);
  const components = computeConnectedComponents(graph);
  const sliceAssignment = assignSliceIds(components);

  const { sharedComponentRefs, sliceComponentUsage } = promoteSharedComponents(pages, sliceAssignment);
  const requirementIndex = await loadRequirementIndex(store);

  const slices: SliceEvidence[] = components.map((componentPages) => {
    const sortedPages = [...componentPages].sort();
    const sliceId = sliceAssignment.get(sortedPages[0]!)!;
    const usage = sliceComponentUsage.get(sliceId);
    return {
      id: sliceId,
      pages: sortedPages,
      componentRefs: [],
      dependsOn: usage && usage.length > 0 ? [{ sliceId: SHARED_SLICE_ID, components: usage }] : [],
      requirementRefs: deriveRequirementRefs(sortedPages, requirementIndex),
      status: "not_started",
    };
  });

  if (sharedComponentRefs.length > 0) {
    slices.push({
      id: SHARED_SLICE_ID,
      pages: [],
      componentRefs: sharedComponentRefs,
      dependsOn: [],
      requirementRefs: [],
      status: "not_started",
    });
  }

  for (const slice of slices) await writeSliceEvidence(store, slice);

  const index: SliceIndex = {
    slices: slices.map((s) => s.id).sort(),
    sharedSliceId: sharedComponentRefs.length > 0 ? SHARED_SLICE_ID : null,
    generatedAt: new Date().toISOString(),
  };
  await writeJson(store.slicesIndexFile, index);

  const result: SliceDetectionResult = { slices, index };
  await createPendingGate(store, "slices", result);
  emitProgress({ stage: "slices", type: "summary", slices: slices.length, sharedSlice: index.sharedSliceId !== null });
  return result;
}
