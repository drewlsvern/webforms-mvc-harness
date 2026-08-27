import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Browser, type Page } from "playwright";
import { createStore } from "../store/paths.ts";
import { scaffoldStore, gateFilePath } from "../store/paths.ts";
import { writeJson } from "../store/jsonFile.ts";
import { hashArtifact } from "../store/hash.ts";
import type { GateRecord } from "../types/evidence.ts";

const ROOT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const FIXTURE_ROOT = path.join(ROOT_DIR, "test", "fixtures", "webforms-sample");

async function withDashboard<T>(fn: (ctx: { page: Page; baseUrl: string; storeDir: string }) => Promise<T>): Promise<T> {
  const storeDir = await mkdtemp(path.join(tmpdir(), "dashboard-ui-"));
  const port = 4400 + Math.floor(Math.random() * 500);
  const server: ChildProcess = spawn("node", ["src/server/index.ts"], {
    cwd: ROOT_DIR,
    env: { ...process.env, MIGRATION_ROOT: storeDir, PORT: String(port) },
    stdio: "ignore",
  });
  await new Promise((resolve) => setTimeout(resolve, 900));

  let browser: Browser | undefined;
  try {
    browser = await chromium.launch();
    const page = await browser.newPage();
    const result = await fn({ page, baseUrl: `http://localhost:${port}`, storeDir });
    return result;
  } finally {
    await browser?.close();
    server.kill("SIGKILL");
    await rm(storeDir, { recursive: true, force: true });
  }
}

async function fakeGate(store: ReturnType<typeof createStore>, stage: "scan" | "crawl" | "requirements" | "slices", status: GateRecord["status"]) {
  const record: GateRecord = {
    stage,
    status,
    artifactHash: hashArtifact({}),
    reviewedBy: status === "pending" ? null : "tester",
    comment: status === "rejected" ? "needs another look" : null,
    createdAt: new Date().toISOString(),
    reviewedAt: status === "pending" ? null : new Date().toISOString(),
  };
  await writeJson(gateFilePath(store, stage), record);
}

test("dashboard: card states render correctly for complete/warning/error/active/pending", async () => {
  await withDashboard(async ({ page, baseUrl, storeDir }) => {
    const store = createStore(storeDir);
    await scaffoldStore(store);

    await fakeGate(store, "scan", "approved"); // complete
    await writeJson(path.join(store.crawlDir, "pending-routes.json"), ["Home.aspx"]); // crawl: warning (paused, no gate)
    await fakeGate(store, "requirements", "rejected"); // error
    await fakeGate(store, "slices", "pending"); // active
    // select: no slices approval -> pending/locked

    await page.goto(`${baseUrl}/`, { timeout: 15000 });
    await page.waitForSelector(".step-card", { timeout: 10000 });

    const stateOf = async (index: number) => {
      const className = await page.locator(".step-card").nth(index).getAttribute("class");
      return className?.match(/state-(\w+)/)?.[1];
    };

    assert.equal(await stateOf(0), "complete"); // scan
    assert.equal(await stateOf(1), "warning"); // crawl
    assert.equal(await stateOf(2), "error"); // requirements
    assert.equal(await stateOf(3), "active"); // slices
    assert.equal(await stateOf(4), "pending"); // select
  });
});

test("dashboard: clicking a card navigates the left column to that step", async () => {
  await withDashboard(async ({ page, baseUrl }) => {
    await page.goto(`${baseUrl}/`, { timeout: 15000 });
    await page.waitForSelector(".step-card", { timeout: 10000 });

    await page.click(".step-card >> nth=2"); // Requirements
    await page.waitForFunction("location.hash === '#requirements'");
    await page.waitForSelector("h2", { timeout: 10000 });
    assert.equal(await page.locator("h2").first().textContent(), "Requirements");
  });
});

test("dashboard: list <-> detail <-> back keeps console and history mounted", async () => {
  await withDashboard(async ({ page, baseUrl }) => {
    await page.goto(`${baseUrl}/`, { timeout: 15000 });
    await page.waitForSelector(".step-row", { timeout: 10000 });
    assert.equal(await page.locator("#console").count(), 1);
    assert.equal(await page.locator("#history").count(), 1);

    await page.click(".step-card >> nth=0");
    await page.waitForFunction("location.hash === '#scan'");
    assert.equal(await page.locator("#console").count(), 1, "console should still be mounted while a detail view is open");
    assert.equal(await page.locator("#history").count(), 1, "history should still be mounted while a detail view is open");

    await page.click("text=Back to steps");
    await page.waitForFunction("location.hash === '' || location.hash === '#'");
    await page.waitForSelector(".step-row", { timeout: 10000 });
    assert.equal(await page.locator("#console").count(), 1);
    assert.equal(await page.locator("#history").count(), 1);
  });
});

test("dashboard: console shows a start/summary pair for scan", async () => {
  await withDashboard(async ({ page, baseUrl }) => {
    await page.goto(`${baseUrl}/#scan`, { timeout: 15000 });
    await page.waitForSelector('[data-role="source-root"]', { timeout: 10000 });
    await page.fill('[data-role="source-root"]', FIXTURE_ROOT);

    await page.click('[data-action="run"]');
    await page.waitForSelector("text=Scan — running…", { timeout: 10000 });
    await page.waitForSelector("text=Done — 6 page(s), 1 control(s), 0 presenter(s).", { timeout: 10000 });
  });
});

test("dashboard: console shows live per-page updates during a crawl", async () => {
  const fixtureServer = http.createServer((_req, res) => {
    res.writeHead(200, { "content-type": "text/html" });
    res.end("<html><body>fixture home</body></html>");
  });
  await new Promise<void>((resolve) => fixtureServer.listen(0, resolve));
  const { port: fixturePort } = fixtureServer.address() as AddressInfo;
  const fixtureBaseUrl = `http://127.0.0.1:${fixturePort}`;

  try {
    await withDashboard(async ({ page, baseUrl, storeDir }) => {
      const store = createStore(storeDir);
      await scaffoldStore(store);
      await writeJson(store.scanIndexFile, {
        pages: ["a.aspx"],
        controls: [],
        presenters: [],
        generatedAt: new Date().toISOString(),
      });
      await fakeGate(store, "scan", "approved");

      await page.goto(`${baseUrl}/#crawl`, { timeout: 15000 });
      await page.waitForSelector('[data-role="auth-base-url"]', { timeout: 10000 });
      await page.fill('[data-role="auth-base-url"]', fixtureBaseUrl);
      await page.click('button:has-text("Authenticate")');
      await page.waitForSelector('[data-role="confirm-row"]', { state: "visible", timeout: 15000 });
      await page.click('button:has-text("I\'m logged in")');
      // Note: Playwright's `text=` selector is case-insensitive substring
      // matching, so "Authenticated" also matches "Not authenticated" - wait
      // for the actual re-render (the Run button losing `disabled`) instead.
      await page.waitForSelector('button:has-text("Run crawl"):not([disabled])', { timeout: 10000 });

      await page.fill('[data-role="base-url"]', fixtureBaseUrl);
      await page.click('button:has-text("Run crawl")');
      // A single-page crawl against a trivial local fixture can complete in
      // well under a poll interval, so assert on the durable per-page line
      // and final status rather than the transient "running…" moment.
      await page.waitForSelector("text=a.aspx", { timeout: 10000 });
      await page.waitForSelector("text=Crawl complete (1/1).", { timeout: 15000 });
    });
  } finally {
    fixtureServer.close();
  }
});
