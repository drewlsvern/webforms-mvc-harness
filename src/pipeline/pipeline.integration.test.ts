import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createStore } from "../store/paths.ts";
import { getGate } from "../store/gate.ts";
import { readJson } from "../store/jsonFile.ts";
import { runCrawlStage, runRequirementsStage, runScanStage, runSlicesStage, approveStageGate, rejectStageGate } from "./pipeline.ts";
import { createPendingGate } from "../store/gate.ts";
import type { CrawlIndex, SliceEvidence, SliceIndex } from "../types/evidence.ts";
import { sliceEvidencePaths } from "../store/paths.ts";
import { mergeSlices, splitSlice, promoteSharedComponent, demoteSharedComponent } from "../slices/editSlices.ts";
import { SHARED_SLICE_ID } from "../slices/sharedSlice.ts";

const FIXTURE_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "test", "fixtures", "webforms-sample");

async function withTempStore<T>(fn: (storeRoot: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(path.join(tmpdir(), "migration-store-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("stage ordering: crawl cannot run before the scan gate is approved", async () => {
  await withTempStore(async (root) => {
    const store = createStore(root);
    await runScanStage(FIXTURE_ROOT, store);

    await assert.rejects(
      () => runCrawlStage(store, { baseUrl: "http://localhost" }),
      /predecessor stage "scan" gate is not approved/,
    );
  });
});

test("rejecting a gate leaves the pipeline blocked with the reviewer's comment recorded", async () => {
  await withTempStore(async (root) => {
    const store = createStore(root);
    await runScanStage(FIXTURE_ROOT, store);

    await rejectStageGate(store, "scan", "reviewer@example.com", "OrderEdit looks mis-scanned");
    const gate = await getGate(store, "scan");
    assert.equal(gate?.status, "rejected");
    assert.equal(gate?.comment, "OrderEdit looks mis-scanned");

    await assert.rejects(() => runCrawlStage(store, { baseUrl: "http://localhost" }));
  });
});

test("full discovery pipeline: scan -> (crawl bypassed) -> requirements -> slices", async () => {
  await withTempStore(async (root) => {
    const store = createStore(root);

    const scanResult = await runScanStage(FIXTURE_ROOT, store);
    assert.deepEqual(
      [...scanResult.index.pages].sort(),
      [
        "Customers/CustomerDetail.aspx",
        "Customers/CustomerList.aspx",
        "Default.aspx",
        "Orders/OrderEdit.aspx",
        "Orders/OrderList.aspx",
        "Reports/ReportsList.aspx",
      ],
    );
    assert.deepEqual(scanResult.index.controls, ["Controls/SearchBox.ascx"]);

    await approveStageGate(store, "scan", scanResult, "reviewer@example.com");

    // Crawling needs a live browser against a running WebForms app, which this
    // test environment doesn't have. We simulate "crawl ran and was approved"
    // by approving an empty crawl gate directly, so downstream stage-ordering
    // and graceful-degradation behavior can still be exercised end to end.
    const emptyCrawlIndex: CrawlIndex = { pages: {}, generatedAt: new Date().toISOString() };
    await createPendingGate(store, "crawl", emptyCrawlIndex);
    await approveStageGate(store, "crawl", emptyCrawlIndex, "reviewer@example.com");

    const requirements = await runRequirementsStage(store);
    assert.equal(requirements.functional.requirements.length, 6);
    assert.equal(requirements.nonfunctional.requirements.length, 0); // no crawl evidence -> no NFRs invented

    await approveStageGate(store, "requirements", requirements, "reviewer@example.com");

    const sliceResult = await runSlicesStage(store);
    assert.equal(
      sliceResult.slices.length,
      5,
      "Default, Orders pair, Customers pair, Reports, and the shared slice",
    );

    const ordersSlice = sliceResult.slices.find((s) => s.pages.includes("Orders/OrderList.aspx"))!;
    assert.deepEqual(ordersSlice.pages, ["Orders/OrderEdit.aspx", "Orders/OrderList.aspx"]);

    const customersSlice = sliceResult.slices.find((s) => s.pages.includes("Customers/CustomerList.aspx"))!;
    assert.deepEqual(customersSlice.pages, ["Customers/CustomerDetail.aspx", "Customers/CustomerList.aspx"]);

    const defaultSlice = sliceResult.slices.find((s) => s.pages.includes("Default.aspx"))!;
    assert.deepEqual(defaultSlice.pages, ["Default.aspx"]);
    assert.deepEqual(defaultSlice.dependsOn, []);

    const reportsSlice = sliceResult.slices.find((s) => s.pages.includes("Reports/ReportsList.aspx"))!;
    assert.deepEqual(reportsSlice.pages, ["Reports/ReportsList.aspx"]);

    // SearchBox.ascx is used by both the Orders slice and the Customers slice,
    // so it must be promoted into the dedicated shared slice.
    const shared = sliceResult.slices.find((s) => s.id === SHARED_SLICE_ID)!;
    assert.equal(shared.componentRefs.length, 1);
    assert.equal(shared.componentRefs[0]!.kind, "userControl");
    assert.equal(shared.componentRefs[0]!.id, "Controls/SearchBox.ascx");

    assert.deepEqual(ordersSlice.dependsOn, [
      { sliceId: SHARED_SLICE_ID, components: [{ kind: "userControl", id: "Controls/SearchBox.ascx" }] },
    ]);
    assert.deepEqual(customersSlice.dependsOn, [
      { sliceId: SHARED_SLICE_ID, components: [{ kind: "userControl", id: "Controls/SearchBox.ascx" }] },
    ]);

    // IOrderPresenter is used by both Orders pages but they're already in the
    // same slice, so it must NOT be promoted (only cross-slice sharing promotes).
    assert.equal(shared.componentRefs.filter((c) => c.kind === "presenter").length, 0);

    await approveStageGate(store, "slices", sliceResult, "reviewer@example.com");
    const finalGate = await getGate(store, "slices");
    assert.equal(finalGate?.status, "approved");

    // --- Reviewer edits at the slice gate ---

    const merged = await mergeSlices(store, [defaultSlice.id, reportsSlice.id], "misc");
    assert.deepEqual(merged.pages, ["Default.aspx", "Reports/ReportsList.aspx"]);

    const [backToDefault, backToReports] = await splitSlice(store, "misc", [
      { id: defaultSlice.id, pages: ["Default.aspx"] },
      { id: reportsSlice.id, pages: ["Reports/ReportsList.aspx"] },
    ]);
    assert.deepEqual(backToDefault!.pages, ["Default.aspx"]);
    assert.deepEqual(backToReports!.pages, ["Reports/ReportsList.aspx"]);

    const promoted = await promoteSharedComponent(store, "presenter", "IOrderPresenter", ordersSlice.id);
    assert.ok(promoted.componentRefs.some((c) => c.kind === "presenter" && c.id === "IOrderPresenter"));
    const ordersAfterPromote = await readJson<SliceEvidence>(sliceEvidencePaths(store, ordersSlice.id).json);
    assert.ok(
      ordersAfterPromote.dependsOn.some(
        (d) => d.sliceId === SHARED_SLICE_ID && d.components.some((c) => c.kind === "presenter" && c.id === "IOrderPresenter"),
      ),
    );

    await demoteSharedComponent(store, "presenter", "IOrderPresenter");
    const ordersAfterDemote = await readJson<SliceEvidence>(sliceEvidencePaths(store, ordersSlice.id).json);
    assert.ok(!ordersAfterDemote.dependsOn.some((d) => d.components.some((c) => c.kind === "presenter")));
    assert.ok(
      ordersAfterDemote.dependsOn.some((d) => d.sliceId === SHARED_SLICE_ID && d.components.some((c) => c.id === "Controls/SearchBox.ascx")),
      "SearchBox dependency must survive demoting an unrelated component",
    );

    const finalIndex = await readJson<SliceIndex>(store.slicesIndexFile);
    assert.equal(finalIndex.slices.length, 5);
  });
});
