import type { Stage } from "../types/evidence.ts";
import type { MigrationStore } from "../store/paths.ts";
import { scaffoldStore } from "../store/paths.ts";
import { approveGate, rejectGate } from "../store/gate.ts";
import { runScan, type ScanResult } from "../scanner/scan.ts";
import { runCrawl, type CrawlRunResult, type RunCrawlOptions } from "../crawler/crawl.ts";
import type { CrawlConfig } from "../crawler/config.ts";
import { runRequirementsSynthesis, type RequirementsSynthesisResult } from "../requirements/synthesize.ts";
import { runSliceDetection, type SliceDetectionResult } from "../slices/detectSlices.ts";
import { assertStageReady, refreshRunState } from "./run.ts";

export async function runScanStage(sourceRoot: string, store: MigrationStore): Promise<ScanResult> {
  await scaffoldStore(store);
  await assertStageReady(store, "scan");
  const result = await runScan(sourceRoot, store);
  await refreshRunState(store);
  return result;
}

export async function runCrawlStage(store: MigrationStore, config: CrawlConfig, options?: RunCrawlOptions): Promise<CrawlRunResult> {
  await assertStageReady(store, "crawl");
  const result = await runCrawl(store, config, options);
  await refreshRunState(store);
  return result;
}

export async function runRequirementsStage(store: MigrationStore): Promise<RequirementsSynthesisResult> {
  await assertStageReady(store, "requirements");
  const result = await runRequirementsSynthesis(store);
  await refreshRunState(store);
  return result;
}

export async function runSlicesStage(store: MigrationStore): Promise<SliceDetectionResult> {
  await assertStageReady(store, "slices");
  const result = await runSliceDetection(store);
  await refreshRunState(store);
  return result;
}

export async function approveStageGate(store: MigrationStore, stage: Stage, artifact: unknown, reviewedBy: string) {
  await approveGate(store, stage, artifact, reviewedBy);
  return refreshRunState(store);
}

export async function rejectStageGate(store: MigrationStore, stage: Stage, reviewedBy: string, comment: string) {
  await rejectGate(store, stage, reviewedBy, comment);
  return refreshRunState(store);
}
