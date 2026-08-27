import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createStore } from "../store/paths.ts";
import { createPendingGate } from "../store/gate.ts";
import { writeJson } from "../store/jsonFile.ts";
import { runScanStage, runRequirementsStage, runSlicesStage, approveStageGate } from "./pipeline.ts";
import { progress, type ProgressEvent } from "./progress.ts";
import type { CrawlIndex } from "../types/evidence.ts";

const FIXTURE_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "test", "fixtures", "webforms-sample");

async function withTempStore<T>(fn: (storeRoot: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(path.join(tmpdir(), "migration-store-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function captureEvents(stage: string): { events: ProgressEvent[]; stop: () => void } {
  const events: ProgressEvent[] = [];
  const onProgress = (event: ProgressEvent) => {
    if (event.stage === stage) events.push(event);
  };
  progress.on("progress", onProgress);
  return { events, stop: () => progress.off("progress", onProgress) };
}

test("scan emits started then a summary event matching the CLI summary counts", async () => {
  await withTempStore(async (root) => {
    const store = createStore(root);
    const { events, stop } = captureEvents("scan");
    try {
      const result = await runScanStage(FIXTURE_ROOT, store);
      assert.deepEqual(
        events.map((e) => e.type),
        ["started", "summary"],
      );
      const summary = events[1] as Extract<ProgressEvent, { type: "summary"; stage: "scan" }>;
      assert.equal(summary.pages, result.index.pages.length);
      assert.equal(summary.controls, result.index.controls.length);
      assert.equal(summary.presenters, result.index.presenters.length);
    } finally {
      stop();
    }
  });
});

test("requirements emits started then a summary event matching the CLI summary counts", async () => {
  await withTempStore(async (root) => {
    const store = createStore(root);
    const scanResult = await runScanStage(FIXTURE_ROOT, store);
    await approveStageGate(store, "scan", scanResult, "tester");

    const emptyCrawlIndex: CrawlIndex = { pages: {}, generatedAt: new Date().toISOString() };
    await createPendingGate(store, "crawl", emptyCrawlIndex);
    await approveStageGate(store, "crawl", emptyCrawlIndex, "tester");

    const { events, stop } = captureEvents("requirements");
    try {
      const result = await runRequirementsStage(store);
      assert.deepEqual(
        events.map((e) => e.type),
        ["started", "summary"],
      );
      const summary = events[1] as Extract<ProgressEvent, { type: "summary"; stage: "requirements" }>;
      assert.equal(summary.functional, result.functional.requirements.length);
      assert.equal(summary.nonfunctional, result.nonfunctional.requirements.length);
    } finally {
      stop();
    }
  });
});

test("slices emits started then a summary event matching the CLI summary counts", async () => {
  await withTempStore(async (root) => {
    const store = createStore(root);
    const scanResult = await runScanStage(FIXTURE_ROOT, store);
    await approveStageGate(store, "scan", scanResult, "tester");

    const emptyCrawlIndex: CrawlIndex = { pages: {}, generatedAt: new Date().toISOString() };
    await createPendingGate(store, "crawl", emptyCrawlIndex);
    await approveStageGate(store, "crawl", emptyCrawlIndex, "tester");

    const requirements = await runRequirementsStage(store);
    await approveStageGate(store, "requirements", requirements, "tester");

    const { events, stop } = captureEvents("slices");
    try {
      const result = await runSlicesStage(store);
      assert.deepEqual(
        events.map((e) => e.type),
        ["started", "summary"],
      );
      const summary = events[1] as Extract<ProgressEvent, { type: "summary"; stage: "slices" }>;
      assert.equal(summary.slices, result.slices.length);
      assert.equal(summary.sharedSlice, result.index.sharedSliceId !== null);
    } finally {
      stop();
    }
  });
});
