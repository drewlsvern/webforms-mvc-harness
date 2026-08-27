import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createStore, scaffoldStore } from "../store/paths.ts";
import { runScan } from "./scan.ts";

async function withFixtureSource<T>(fn: (sourceRoot: string) => Promise<T>): Promise<T> {
  const sourceRoot = await mkdtemp(path.join(tmpdir(), "presenter-model-fixture-"));
  try {
    return await fn(sourceRoot);
  } finally {
    await rm(sourceRoot, { recursive: true, force: true });
  }
}

test("presenter models are parsed and rolled up into the page that resolves to that presenter", async () => {
  await withFixtureSource(async (sourceRoot) => {
    await writeFile(
      path.join(sourceRoot, "Page1.aspx"),
      '<%@ Page Language="C#" CodeBehind="Page1.aspx.cs" Inherits="Sample.Page1" %>\n<html><body>Page1</body></html>\n',
    );
    await writeFile(
      path.join(sourceRoot, "Page1.aspx.cs"),
      `namespace Sample { public partial class Page1 : System.Web.UI.Page { private readonly IOrderPresenter presenter; } }`,
    );
    await writeFile(
      path.join(sourceRoot, "OrderPresenter.cs"),
      `namespace Sample { public class OrderPresenter { private readonly OrderModel _order; } }`,
    );

    const storeRoot = await mkdtemp(path.join(tmpdir(), "presenter-model-store-"));
    try {
      const store = createStore(storeRoot);
      await scaffoldStore(store);
      const result = await runScan(sourceRoot, store);

      const presenter = result.presenters.find((p) => p.id === "OrderPresenter");
      assert.ok(presenter, "OrderPresenter should be discovered");
      assert.deepEqual(presenter!.modelRefs, ["OrderModel"]);

      const page = result.pages.find((p) => p.pageId === "Page1.aspx");
      assert.ok(page);
      assert.deepEqual(page!.modelRefs, ["OrderModel"], "page's own code-behind never mentions OrderModel directly - only via its presenter");
    } finally {
      await rm(storeRoot, { recursive: true, force: true });
    }
  });
});

test("an unresolvable presenter reference leaves the page's own modelRefs unchanged", async () => {
  await withFixtureSource(async (sourceRoot) => {
    await mkdir(path.join(sourceRoot, "Controls"), { recursive: true });
    await writeFile(
      path.join(sourceRoot, "Page2.aspx"),
      '<%@ Page Language="C#" CodeBehind="Page2.aspx.cs" Inherits="Sample.Page2" %>\n<html><body>Page2</body></html>\n',
    );
    await writeFile(
      path.join(sourceRoot, "Page2.aspx.cs"),
      `namespace Sample { public partial class Page2 : System.Web.UI.Page { private readonly IUnknownPresenter presenter; private readonly CustomerModel _customer; } }`,
    );
    // Deliberately no UnknownPresenter.cs file - the reference should fail to resolve.

    const storeRoot = await mkdtemp(path.join(tmpdir(), "presenter-model-store-"));
    try {
      const store = createStore(storeRoot);
      await scaffoldStore(store);
      const result = await runScan(sourceRoot, store);

      assert.equal(result.presenters.length, 0);
      const page = result.pages.find((p) => p.pageId === "Page2.aspx");
      assert.ok(page);
      assert.equal(page!.presenterRef, "IUnknownPresenter");
      assert.deepEqual(page!.modelRefs, ["CustomerModel"], "only the page's own directly-referenced model, no crash from the unresolved presenter");
    } finally {
      await rm(storeRoot, { recursive: true, force: true });
    }
  });
});
