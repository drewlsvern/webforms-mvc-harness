import path from "node:path";
import type { FunctionalRequirement, NonFunctionalRequirement, RequirementsDocument } from "../types/evidence.ts";
import type { MigrationStore } from "../store/paths.ts";
import { readJson } from "../store/jsonFile.ts";

export interface RequirementIndexEntry {
  id: string;
  pageId: string;
}

async function tryReadRequirements<T extends { id: string; pageId: string }>(jsonPath: string): Promise<T[]> {
  try {
    return (await readJson<RequirementsDocument<T>>(jsonPath)).requirements;
  } catch {
    return [];
  }
}

/** Loads every functional/non-functional requirement as a flat (id, pageId) index for joining against slice pages. */
export async function loadRequirementIndex(store: MigrationStore): Promise<RequirementIndexEntry[]> {
  const functional = await tryReadRequirements<FunctionalRequirement>(path.join(store.requirementsDir, "functional.json"));
  const nonfunctional = await tryReadRequirements<NonFunctionalRequirement>(
    path.join(store.requirementsDir, "nonfunctional.json"),
  );
  return [...functional, ...nonfunctional].map((r) => ({ id: r.id, pageId: r.pageId }));
}

/**
 * A slice's requirement references are every requirement whose page is a
 * member of that slice - a pure join, no heuristics (see
 * webforms-slice-detection spec, "Slice requirement references are derived
 * from page membership").
 */
export function deriveRequirementRefs(pages: string[], requirementIndex: RequirementIndexEntry[]): string[] {
  const pageSet = new Set(pages);
  return requirementIndex.filter((r) => pageSet.has(r.pageId)).map((r) => r.id).sort();
}
