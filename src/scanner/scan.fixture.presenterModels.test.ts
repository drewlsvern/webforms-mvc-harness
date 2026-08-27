import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createStore, scaffoldStore } from "../store/paths.ts";
import { runScan } from "./scan.ts";

const FIXTURE_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "test", "fixtures", "webforms-sample");

test("scanning the fixture app finds OrderPresenter's model and rolls it up into both Orders pages", async () => {
  const storeRoot = await mkdtemp(path.join(tmpdir(), "presenter-model-fixture-store-"));
  try {
    const store = createStore(storeRoot);
    await scaffoldStore(store);
    const result = await runScan(FIXTURE_ROOT, store);

    const presenter = result.presenters.find((p) => p.id === "OrderPresenter");
    assert.ok(presenter, "OrderPresenter should be discovered from Orders/OrderPresenter.cs");
    assert.deepEqual(presenter!.modelRefs, ["OrderModel"]);

    for (const pageId of ["Orders/OrderList.aspx", "Orders/OrderEdit.aspx"]) {
      const page = result.pages.find((p) => p.pageId === pageId);
      assert.ok(page, `${pageId} should be in scan results`);
      assert.deepEqual(
        page!.modelRefs,
        ["OrderModel"],
        `${pageId}'s own code-behind never mentions OrderModel directly - it should only appear via the OrderPresenter rollup`,
      );
    }
  } finally {
    await rm(storeRoot, { recursive: true, force: true });
  }
});
