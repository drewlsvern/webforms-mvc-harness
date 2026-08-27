import path from "node:path";
import type {
  CrawlIndex,
  CrawlRunEvidence,
  FunctionalRequirement,
  NonFunctionalRequirement,
  PageScanEvidence,
  RequirementsDocument,
  ScanIndex,
} from "../types/evidence.ts";
import type { MigrationStore } from "../store/paths.ts";
import { readJson, writeArtifact } from "../store/jsonFile.ts";
import { renderFunctionalRequirements, renderNonFunctionalRequirements } from "../store/markdown/renderRequirements.ts";
import { createPendingGate } from "../store/gate.ts";
import { emitProgress } from "../pipeline/progress.ts";
import { deriveFunctionalRequirements } from "./functional.ts";
import { deriveNonFunctionalRequirements } from "./nonfunctional.ts";

async function tryReadJson<T>(jsonPath: string): Promise<T | null> {
  try {
    return await readJson<T>(jsonPath);
  } catch {
    return null;
  }
}

export interface RequirementsSynthesisResult {
  functional: RequirementsDocument<FunctionalRequirement>;
  nonfunctional: RequirementsDocument<NonFunctionalRequirement>;
}

export async function runRequirementsSynthesis(store: MigrationStore): Promise<RequirementsSynthesisResult> {
  emitProgress({ stage: "requirements", type: "started" });

  const scanIndex = await readJson<ScanIndex>(store.scanIndexFile);
  const pages: PageScanEvidence[] = [];
  for (const pageId of scanIndex.pages) {
    const page = await readJson<PageScanEvidence>(path.join(store.scanPagesDir, `${pageId}.json`));
    pages.push(page);
  }

  const crawlIndex = await tryReadJson<CrawlIndex>(store.crawlIndexFile);
  const crawlRuns = new Map<string, CrawlRunEvidence>();
  if (crawlIndex) {
    for (const [pageId, runIds] of Object.entries(crawlIndex.pages)) {
      const latestRunId = runIds.at(-1);
      if (!latestRunId) continue;
      const run = await readJson<CrawlRunEvidence>(path.join(store.crawlPagesDir, pageId, latestRunId, "run.json"));
      crawlRuns.set(pageId, run);
    }
  }

  const functional: RequirementsDocument<FunctionalRequirement> = {
    requirements: deriveFunctionalRequirements(pages, crawlRuns),
    generatedAt: new Date().toISOString(),
  };
  const nonfunctional: RequirementsDocument<NonFunctionalRequirement> = {
    requirements: deriveNonFunctionalRequirements(crawlRuns),
    generatedAt: new Date().toISOString(),
  };

  await writeArtifact(
    path.join(store.requirementsDir, "functional.json"),
    path.join(store.requirementsDir, "functional.md"),
    functional,
    renderFunctionalRequirements,
  );
  await writeArtifact(
    path.join(store.requirementsDir, "nonfunctional.json"),
    path.join(store.requirementsDir, "nonfunctional.md"),
    nonfunctional,
    renderNonFunctionalRequirements,
  );

  const result: RequirementsSynthesisResult = { functional, nonfunctional };
  await createPendingGate(store, "requirements", result);
  emitProgress({
    stage: "requirements",
    type: "summary",
    functional: functional.requirements.length,
    nonfunctional: nonfunctional.requirements.length,
  });
  return result;
}
