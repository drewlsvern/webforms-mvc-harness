import { slug } from "../requirements/slug.ts";

/** Deterministic slice id from its member pages, so re-scanning an unchanged app reproduces the same ids. */
export function assignSliceIds(components: string[][]): Map<string, string> {
  const idOf = new Map<string, string>(); // pageId -> sliceId
  const used = new Set<string>();

  for (const component of components) {
    const sortedPages = [...component].sort();
    const first = sortedPages[0];
    if (!first) continue;
    let candidate = slug(first) || "slice";
    let suffix = 2;
    while (used.has(candidate)) {
      candidate = `${slug(first) || "slice"}-${suffix++}`;
    }
    used.add(candidate);
    for (const pageId of sortedPages) idOf.set(pageId, candidate);
  }

  return idOf;
}
