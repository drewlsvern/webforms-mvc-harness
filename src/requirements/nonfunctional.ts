import type { CrawlRunEvidence, NonFunctionalRequirement } from "../types/evidence.ts";
import { slug } from "./slug.ts";

export function deriveNonFunctionalRequirements(crawlRuns: Map<string, CrawlRunEvidence>): NonFunctionalRequirement[] {
  const requirements: NonFunctionalRequirement[] = [];
  for (const [pageId, run] of crawlRuns) {
    requirements.push({
      id: `NFR-${slug(pageId)}`,
      pageId,
      description: `Page ${pageId} issued ${run.network.length} network request(s) during the runtime crawl on ${run.timestamp}. Treat this as the baseline request count the replacement MVC action should not regress.`,
      evidenceRefs: [{ kind: "crawl", path: `crawl/pages/${pageId}/${run.runId}/run.json` }],
    });
  }
  return requirements;
}
