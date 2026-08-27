import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { AddressInfo } from "node:net";
import { createStore } from "../store/paths.ts";
import { createApp } from "./app.ts";

const FIXTURE_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "test", "fixtures", "webforms-sample");

async function withServer<T>(fn: (baseUrl: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(path.join(tmpdir(), "migration-store-"));
  const store = createStore(dir);
  const app = createApp(store);
  const server = app.listen(0);
  try {
    const { port } = server.address() as AddressInfo;
    return await fn(`http://127.0.0.1:${port}`);
  } finally {
    server.close();
    await rm(dir, { recursive: true, force: true });
  }
}

test("API: scan runs and its gate can be approved", async () => {
  await withServer(async (baseUrl) => {
    const scanRes = await fetch(`${baseUrl}/api/stages/scan`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sourceRoot: FIXTURE_ROOT }),
    });
    assert.equal(scanRes.status, 200);
    const scanBody = (await scanRes.json()) as { index: { pages: string[] } };
    assert.equal(scanBody.index.pages.length, 6);

    const approveRes = await fetch(`${baseUrl}/api/gates/scan/approve`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reviewedBy: "tester" }),
    });
    assert.equal(approveRes.status, 200);
    const runState = (await approveRes.json()) as { currentStage: string };
    assert.equal(runState.currentStage, "crawl");
  });
});

test("API: action endpoints reject actions run.json doesn't currently allow", async () => {
  await withServer(async (baseUrl) => {
    // No scan has run yet, so crawl's predecessor gate isn't approved.
    const crawlRes = await fetch(`${baseUrl}/api/stages/crawl`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ baseUrl: "http://localhost" }),
    });
    assert.equal(crawlRes.status, 409);
    const body = (await crawlRes.json()) as { error: string };
    assert.match(body.error, /predecessor stage "scan" gate is not approved/);

    // Selecting a slice before slices even exist should also be rejected, not crash.
    const selectRes = await fetch(`${baseUrl}/api/slices/select`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sliceId: "anything" }),
    });
    assert.equal(selectRes.status, 409);
  });
});
