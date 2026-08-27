import type { MigrationStore } from "../store/paths.ts";
import { sliceEvidencePaths } from "../store/paths.ts";
import { writeArtifact } from "../store/jsonFile.ts";
import { renderSlice } from "../store/markdown/renderSlice.ts";
import type { SliceEvidence } from "../types/evidence.ts";

export async function writeSliceEvidence(store: MigrationStore, slice: SliceEvidence): Promise<void> {
  const { json, md } = sliceEvidencePaths(store, slice.id);
  await writeArtifact(json, md, slice, renderSlice);
}
