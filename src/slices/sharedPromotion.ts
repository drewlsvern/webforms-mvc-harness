import type { PageScanEvidence, SharedComponentKind, SharedComponentRef } from "../types/evidence.ts";

export interface SharedPromotionResult {
  /** Every component promoted into the shared slice (empty if nothing is shared). */
  sharedComponentRefs: SharedComponentRef[];
  /** Which of the shared components each slice actually uses, for that slice's dependency traceability. */
  sliceComponentUsage: Map<string, SharedComponentRef[]>;
}

/**
 * A UserControl or Presenter referenced by pages in more than one slice is
 * promoted into the shared slice, and each referencing slice records which
 * of those components it uses (for the dependency it will record on the
 * shared slice - see detectSlices.ts / editSlices.ts).
 */
export function promoteSharedComponents(
  pages: PageScanEvidence[],
  sliceAssignment: Map<string, string>,
): SharedPromotionResult {
  const referencedBy = new Map<string, Set<string>>(); // "kind:id" -> slice ids

  const record = (kind: SharedComponentKind, id: string, sliceId: string) => {
    const key = `${kind}:${id}`;
    if (!referencedBy.has(key)) referencedBy.set(key, new Set());
    referencedBy.get(key)!.add(sliceId);
  };

  for (const page of pages) {
    const sliceId = sliceAssignment.get(page.pageId);
    if (!sliceId) continue;
    for (const userControl of page.userControlRefs) record("userControl", userControl, sliceId);
    if (page.presenterRef) record("presenter", page.presenterRef, sliceId);
  }

  const sharedComponentRefs: SharedComponentRef[] = [];
  const sliceComponentUsage = new Map<string, SharedComponentRef[]>();

  for (const [key, sliceIds] of referencedBy) {
    if (sliceIds.size <= 1) continue; // referenced by only one slice - stays owned by that slice, not promoted
    const [kind, id] = splitKey(key);
    sharedComponentRefs.push({ kind, id });
    for (const sliceId of sliceIds) {
      if (!sliceComponentUsage.has(sliceId)) sliceComponentUsage.set(sliceId, []);
      sliceComponentUsage.get(sliceId)!.push({ kind, id });
    }
  }

  return { sharedComponentRefs, sliceComponentUsage };
}

function splitKey(key: string): [SharedComponentKind, string] {
  const separatorIndex = key.indexOf(":");
  return [key.slice(0, separatorIndex) as SharedComponentKind, key.slice(separatorIndex + 1)];
}
