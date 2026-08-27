import type { CrawlRunEvidence, EvidenceRef, FunctionalRequirement, PageScanEvidence } from "../types/evidence.ts";
import { slug } from "./slug.ts";

export function deriveFunctionalRequirements(
  pages: PageScanEvidence[],
  crawlRuns: Map<string, CrawlRunEvidence>,
): FunctionalRequirement[] {
  return pages.map((page) => {
    const controlsSummary = page.controls.length
      ? page.controls.map((c) => `${c.type}#${c.id}`).join(", ")
      : "no controls detected";
    const navSummary = page.navigationEdges.length
      ? page.navigationEdges.map((e) => `${e.kind} -> ${e.targetPage}`).join(", ")
      : "no outgoing navigation detected";

    const evidenceRefs: EvidenceRef[] = [{ kind: "scan", path: `scan/pages/${page.pageId}.json` }];
    const run = crawlRuns.get(page.pageId);
    if (run) {
      evidenceRefs.push({ kind: "crawl", path: `crawl/pages/${page.pageId}/${run.runId}/run.json` });
    }

    return {
      id: `FR-${slug(page.pageId)}`,
      pageId: page.pageId,
      description: `Page ${page.pageId} SHALL support the following controls: ${controlsSummary}. Observed navigation: ${navSummary}.`,
      evidenceRefs,
    };
  });
}
