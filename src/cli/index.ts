#!/usr/bin/env node
import { parseArgs } from "node:util";
import { runScanStage, runCrawlStage, runRequirementsStage, runSlicesStage, approveStageGate, rejectStageGate } from "../pipeline/pipeline.ts";
import { readGateArtifact } from "../pipeline/gateArtifact.ts";
import { loadAuthState } from "../crawler/auth.ts";
import { selectSlice } from "../slices/selection.ts";
import type { Stage } from "../types/evidence.ts";
import { resolveStore } from "./store.ts";
import { printScanSummary, printCrawlSummary, printRequirementsSummary, printSlicesSummary, printRunStatus, printRunState } from "./summaries.ts";

const STAGES: Stage[] = ["scan", "crawl", "requirements", "slices"];

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);

  switch (command) {
    case "scan":
      return cmdScan(rest);
    case "crawl":
      return cmdCrawl(rest);
    case "requirements":
      return cmdRequirements(rest);
    case "slices":
      return cmdSlices(rest);
    case "gate":
      return cmdGate(rest);
    case "select":
      return cmdSelect(rest);
    case "status":
      return cmdStatus(rest);
    default:
      printUsage();
      process.exitCode = command ? 1 : 0;
  }
}

function printUsage(): void {
  console.log(`Usage: migrate <command> [options]

Commands:
  scan <sourceRoot> [--root <dir>]
  crawl --base-url <url> [--root <dir>] [--max-pages <n>] [--storage-state <path>]
  requirements [--root <dir>]
  slices [--root <dir>]
  gate <scan|crawl|requirements|slices> --approve [--by <name>] [--root <dir>]
  gate <scan|crawl|requirements|slices> --reject "<comment>" [--by <name>] [--root <dir>]
  select <sliceId> [--root <dir>]
  status [--root <dir>]`);
}

async function cmdScan(argv: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args: argv,
    options: { root: { type: "string" } },
    allowPositionals: true,
  });
  const [sourceRoot] = positionals;
  if (!sourceRoot) {
    console.error("Usage: migrate scan <sourceRoot> [--root <dir>]");
    process.exitCode = 1;
    return;
  }
  const store = resolveStore(values.root);
  const result = await runScanStage(sourceRoot, store);
  printScanSummary(result);
}

async function cmdCrawl(argv: string[]): Promise<void> {
  const { values } = parseArgs({
    args: argv,
    options: {
      root: { type: "string" },
      "base-url": { type: "string" },
      "max-pages": { type: "string" },
      resume: { type: "boolean" },
    },
  });
  if (!values["base-url"]) {
    console.error("Usage: migrate crawl --base-url <url> [--root <dir>] [--max-pages <n>] [--resume]");
    process.exitCode = 1;
    return;
  }
  const store = resolveStore(values.root);

  const authState = await loadAuthState(store);
  if (!authState) {
    console.error('No authenticated session found. Authenticate via the web UI first (crawl requires a visible browser login), then re-run "migrate crawl".');
    process.exitCode = 1;
    return;
  }

  const result = await runCrawlStage(
    store,
    { baseUrl: values["base-url"], maxPages: values["max-pages"] ? Number(values["max-pages"]) : undefined },
    { resume: values.resume },
  );
  printCrawlSummary(result);
}

async function cmdRequirements(argv: string[]): Promise<void> {
  const { values } = parseArgs({ args: argv, options: { root: { type: "string" } } });
  const store = resolveStore(values.root);
  const result = await runRequirementsStage(store);
  printRequirementsSummary(result);
}

async function cmdSlices(argv: string[]): Promise<void> {
  const { values } = parseArgs({ args: argv, options: { root: { type: "string" } } });
  const store = resolveStore(values.root);
  const result = await runSlicesStage(store);
  printSlicesSummary(result);
}

async function cmdGate(argv: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args: argv,
    options: {
      root: { type: "string" },
      approve: { type: "boolean" },
      reject: { type: "string" },
      by: { type: "string" },
    },
    allowPositionals: true,
  });
  const [stage] = positionals;
  if (!stage || !STAGES.includes(stage as Stage)) {
    console.error(`Usage: migrate gate <${STAGES.join("|")}> --approve|--reject "<comment>" [--by <name>] [--root <dir>]`);
    process.exitCode = 1;
    return;
  }
  const store = resolveStore(values.root);
  const reviewedBy = values.by ?? "cli";

  if (values.approve) {
    const artifact = await readGateArtifact(store, stage as Stage);
    const state = await approveStageGate(store, stage as Stage, artifact, reviewedBy);
    console.log(`Approved ${stage} gate. Current stage: ${state.currentStage}`);
  } else if (values.reject !== undefined) {
    const state = await rejectStageGate(store, stage as Stage, reviewedBy, values.reject);
    console.log(`Rejected ${stage} gate. Current stage: ${state.currentStage}`);
  } else {
    console.error("Specify --approve or --reject \"<comment>\"");
    process.exitCode = 1;
  }
}

async function cmdSelect(argv: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args: argv,
    options: { root: { type: "string" } },
    allowPositionals: true,
  });
  const [sliceId] = positionals;
  if (!sliceId) {
    console.error("Usage: migrate select <sliceId> [--root <dir>]");
    process.exitCode = 1;
    return;
  }
  const store = resolveStore(values.root);
  const slice = await selectSlice(store, sliceId);
  console.log(`Selected slice "${slice.id}".`);
}

async function cmdStatus(argv: string[]): Promise<void> {
  const { values } = parseArgs({ args: argv, options: { root: { type: "string" } } });
  const store = resolveStore(values.root);
  await printRunState(store);
  await printRunStatus(store);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
