import type { ScanResult } from "../scanner/scan.ts";
import type { RequirementsSynthesisResult } from "../requirements/synthesize.ts";
import type { SliceDetectionResult } from "../slices/detectSlices.ts";
import type { CrawlRunResult } from "../crawler/crawl.ts";
import type { GateRecord, Stage } from "../types/evidence.ts";
import type { MigrationStore } from "../store/paths.ts";
import { getGate } from "../store/gate.ts";
import { readJson } from "../store/jsonFile.ts";
import { STAGE_ORDER } from "../pipeline/run.ts";
import { getSliceStates } from "../slices/selection.ts";
import { loadCurrentSlices } from "../slices/editSlices.ts";

export function printScanSummary(result: ScanResult): void {
  console.log(`Scan complete: ${result.index.pages.length} page(s), ${result.index.controls.length} control(s), ${result.index.presenters.length} presenter(s).`);
}

export function printCrawlSummary(result: CrawlRunResult): void {
  const runCount = Object.values(result.index.pages).reduce((sum, runs) => sum + runs.length, 0);
  if (result.status === "paused") {
    console.log(
      `Crawl paused at "${result.pausedAtPageId}" - session appears to have expired. Re-authenticate via the web UI, then re-run with --resume.`,
    );
    console.log(`  ${Object.keys(result.index.pages).length} page(s) captured so far, ${runCount} run(s) recorded, ${result.remainingPageIds.length} page(s) remaining.`);
    return;
  }
  console.log(`Crawl complete: ${Object.keys(result.index.pages).length} page(s) visited, ${runCount} run(s) recorded.`);
}

export function printRequirementsSummary(result: RequirementsSynthesisResult): void {
  console.log(
    `Requirements complete: ${result.functional.requirements.length} functional, ${result.nonfunctional.requirements.length} non-functional.`,
  );
}

export function printSlicesSummary(result: SliceDetectionResult): void {
  console.log(`Slice detection complete: ${result.slices.length} slice(s), shared slice: ${result.index.sharedSliceId ?? "none"}.`);
  for (const slice of result.slices) {
    const label = slice.pages.length > 0 ? `${slice.pages.length} page(s)` : `${slice.componentRefs.length} shared component(s)`;
    console.log(`  - ${slice.id} (${label})`);
  }
}

export function printGate(gate: GateRecord | null, stage: Stage): void {
  if (!gate) {
    console.log(`${stage}: no gate yet`);
    return;
  }
  const comment = gate.comment ? ` — ${gate.comment}` : "";
  console.log(`${stage}: ${gate.status}${comment}`);
}

export async function printRunStatus(store: MigrationStore): Promise<void> {
  for (const stage of STAGE_ORDER) {
    printGate(await getGate(store, stage), stage);
  }

  const slicesGate = await getGate(store, "slices");
  if (slicesGate?.status !== "approved") return;

  const slices = await loadCurrentSlices(store).catch(() => []);
  if (slices.length === 0) return;

  console.log("\nSlices:");
  const states = await getSliceStates(store);
  for (const state of states) {
    console.log(`  - ${state.sliceId}: ${state.state}`);
  }
}

export async function printRunState(store: MigrationStore): Promise<void> {
  try {
    const runState = await readJson<{ currentStage: string }>(store.runFile);
    console.log(`Current stage: ${runState.currentStage}`);
  } catch {
    console.log("No run started yet.");
  }
}
