import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createStore } from "../store/paths.ts";
import { readJson, writeJson } from "../store/jsonFile.ts";
import { sliceEvidencePaths } from "../store/paths.ts";
import { runScanStage, runRequirementsStage, runCrawlStage, approveStageGate } from "../pipeline/pipeline.ts";
import { runSliceDetection } from "./detectSlices.ts";
import { movePages, loadCurrentSlices } from "./editSlices.ts";
import { getSliceStates, selectSlice } from "./selection.ts";
import { SHARED_SLICE_ID } from "./sharedSlice.ts";
import { createPendingGate } from "../store/gate.ts";
import type { CrawlIndex, SliceEvidence } from "../types/evidence.ts";

const FIXTURE_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "test", "fixtures", "webforms-sample");

async function withTempStore<T>(fn: (storeRoot: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(path.join(tmpdir(), "migration-store-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Runs scan -> (bypassed crawl) -> requirements -> slices against the fixture app, all gates approved. */
async function buildSlicedFixture(root: string) {
  const store = createStore(root);
  const scanResult = await runScanStage(FIXTURE_ROOT, store);
  await approveStageGate(store, "scan", scanResult, "reviewer@example.com");

  const emptyCrawlIndex: CrawlIndex = { pages: {}, generatedAt: new Date().toISOString() };
  await createPendingGate(store, "crawl", emptyCrawlIndex);
  await approveStageGate(store, "crawl", emptyCrawlIndex, "reviewer@example.com");

  const requirements = await runRequirementsStage(store);
  await approveStageGate(store, "requirements", requirements, "reviewer@example.com");

  const sliceResult = await runSliceDetection(store);
  await approveStageGate(store, "slices", sliceResult, "reviewer@example.com");

  return { store, sliceResult };
}

test("movePages: moving every page out of a slice is a merge", async () => {
  await withTempStore(async (root) => {
    const { store, sliceResult } = await buildSlicedFixture(root);
    const defaultSlice = sliceResult.slices.find((s) => s.pages.includes("Default.aspx"))!;
    const reportsSlice = sliceResult.slices.find((s) => s.pages.includes("Reports/ReportsList.aspx"))!;

    const [moved] = await movePages(store, ["Default.aspx"], defaultSlice.id, reportsSlice.id);
    assert.deepEqual(moved!.pages, ["Default.aspx", "Reports/ReportsList.aspx"]);
    assert.equal(moved!.id, reportsSlice.id);

    const remaining = await loadCurrentSlices(store);
    assert.ok(!remaining.some((s) => s.id === defaultSlice.id), "source slice should no longer exist");
  });
});

test("movePages: moving some pages out of a slice splits then merges", async () => {
  await withTempStore(async (root) => {
    const { store, sliceResult } = await buildSlicedFixture(root);
    const ordersSlice = sliceResult.slices.find((s) => s.pages.includes("Orders/OrderList.aspx"))!;
    const reportsSlice = sliceResult.slices.find((s) => s.pages.includes("Reports/ReportsList.aspx"))!;

    const [remainder, merged] = await movePages(store, ["Orders/OrderEdit.aspx"], ordersSlice.id, reportsSlice.id);
    assert.deepEqual(remainder!.pages, ["Orders/OrderList.aspx"]);
    assert.equal(remainder!.id, ordersSlice.id);
    assert.deepEqual(merged!.pages, ["Orders/OrderEdit.aspx", "Reports/ReportsList.aspx"]);
    assert.equal(merged!.id, reportsSlice.id);
  });
});

test("slice selection: locked until the shared slice is done, and only one selection at a time", async () => {
  await withTempStore(async (root) => {
    const { store, sliceResult } = await buildSlicedFixture(root);
    const ordersSlice = sliceResult.slices.find((s) => s.pages.includes("Orders/OrderList.aspx"))!;
    const defaultSlice = sliceResult.slices.find((s) => s.pages.includes("Default.aspx"))!;

    let states = await getSliceStates(store);
    assert.equal(states.find((s) => s.sliceId === ordersSlice.id)?.state, "locked");
    assert.equal(states.find((s) => s.sliceId === SHARED_SLICE_ID)?.state, "ready");
    assert.equal(states.find((s) => s.sliceId === defaultSlice.id)?.state, "ready", "no shared dependency -> ready immediately");

    await assert.rejects(() => selectSlice(store, ordersSlice.id), /locked/);

    await selectSlice(store, SHARED_SLICE_ID);
    states = await getSliceStates(store);
    assert.equal(states.find((s) => s.sliceId === SHARED_SLICE_ID)?.state, "selected");

    await assert.rejects(() => selectSlice(store, defaultSlice.id), /already selected/);

    const shared = await readJson<SliceEvidence>(sliceEvidencePaths(store, SHARED_SLICE_ID).json);
    await writeJson(sliceEvidencePaths(store, SHARED_SLICE_ID).json, { ...shared, status: "done" });

    states = await getSliceStates(store);
    assert.equal(states.find((s) => s.sliceId === ordersSlice.id)?.state, "ready");

    const selected = await selectSlice(store, ordersSlice.id);
    assert.equal(selected.status, "selected");
  });
});

test("requirementRefs are derived from page membership and recomputed after a move", async () => {
  await withTempStore(async (root) => {
    const { store, sliceResult } = await buildSlicedFixture(root);
    const ordersSlice = sliceResult.slices.find((s) => s.pages.includes("Orders/OrderList.aspx"))!;
    const reportsSlice = sliceResult.slices.find((s) => s.pages.includes("Reports/ReportsList.aspx"))!;

    assert.deepEqual(ordersSlice.requirementRefs.sort(), ["FR-Orders-OrderEdit", "FR-Orders-OrderList"]);
    assert.deepEqual(reportsSlice.requirementRefs, ["FR-Reports-ReportsList"]);

    const [remainder, merged] = await movePages(store, ["Orders/OrderEdit.aspx"], ordersSlice.id, reportsSlice.id);
    assert.deepEqual(remainder!.requirementRefs, ["FR-Orders-OrderList"]);
    assert.deepEqual(merged!.requirementRefs.sort(), ["FR-Orders-OrderEdit", "FR-Reports-ReportsList"]);
  });
});
