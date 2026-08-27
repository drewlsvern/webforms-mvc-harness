import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createStore } from "../store/paths.ts";
import { scaffoldStore } from "../store/paths.ts";
import { writeJson } from "../store/jsonFile.ts";
import { launchAuthSession, confirmAuthSession, loadAuthState } from "./auth.ts";
import { runCrawl } from "./crawl.ts";

/**
 * A minimal cookie-session "WebForms-like" fixture app: unauthenticated
 * requests to any page bounce to /Login.aspx, exactly the pattern
 * isLoginRedirect() is designed to detect. `expireSessions()` simulates a
 * session timeout mid-crawl by invalidating every issued session id.
 */
async function startFixtureApp(): Promise<{ baseUrl: string; expireSessions: () => void; close: () => Promise<void> }> {
  const validSessions = new Set<string>();
  let nextSessionId = 1;

  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const cookieHeader = req.headers.cookie ?? "";
    const sid = /sid=([^;]+)/.exec(cookieHeader)?.[1];
    const authenticated = sid !== undefined && validSessions.has(sid);

    if (url.pathname === "/Login.aspx") {
      if (url.searchParams.get("login") === "1") {
        const sessionId = String(nextSessionId++);
        validSessions.add(sessionId);
        res.writeHead(302, { "set-cookie": `sid=${sessionId}; Path=/`, location: url.searchParams.get("ReturnUrl") || "/" });
        res.end();
        return;
      }
      res.writeHead(200, { "content-type": "text/html" });
      res.end("<html><body>Login page</body></html>");
      return;
    }

    if (!authenticated) {
      res.writeHead(302, { location: `/Login.aspx?ReturnUrl=${encodeURIComponent(url.pathname)}` });
      res.end();
      return;
    }

    res.writeHead(200, { "content-type": "text/html" });
    res.end(`<html><body>${url.pathname}</body></html>`);
  });

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const { port } = server.address() as AddressInfo;

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    expireSessions: () => validSessions.clear(),
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

async function withTempStore<T>(fn: (storeRoot: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(path.join(tmpdir(), "migration-store-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Programmatically completes login in an auth session's browser window (stands in for the human clicking through). */
async function simulateLogin(session: { page: import("playwright").Page }, baseUrl: string): Promise<void> {
  await session.page.goto(new URL("/Login.aspx?login=1&ReturnUrl=%2F", baseUrl).toString(), { waitUntil: "networkidle" });
}

test("auth: capturing and reloading a storageState round-trips correctly", async () => {
  await withTempStore(async (root) => {
    const store = createStore(root);
    await scaffoldStore(store);
    const fixture = await startFixtureApp();
    try {
      const session = await launchAuthSession(fixture.baseUrl);
      assert.match(session.loginUrl, /\/Login\.aspx/);
      await simulateLogin(session, fixture.baseUrl);

      const captured = await confirmAuthSession(store, session);
      assert.equal(captured.loginUrl, session.loginUrl);

      const reloaded = await loadAuthState(store);
      assert.ok(reloaded);
      assert.equal(reloaded!.loginUrl, captured.loginUrl);
      assert.deepEqual(reloaded!.storageState, captured.storageState);
    } finally {
      await fixture.close();
    }
  });
});

test("crawl: pauses on an expired-session redirect and resumes from the correct page after re-authentication", async () => {
  await withTempStore(async (root) => {
    const store = createStore(root);
    await scaffoldStore(store);
    const fixture = await startFixtureApp();
    try {
      await writeJson(store.scanIndexFile, {
        pages: ["PageA.aspx", "PageB.aspx", "PageC.aspx"],
        controls: [],
        presenters: [],
        generatedAt: new Date().toISOString(),
      });

      const firstAuth = await launchAuthSession(fixture.baseUrl);
      await simulateLogin(firstAuth, fixture.baseUrl);
      await confirmAuthSession(store, firstAuth);

      const fullRun = await runCrawl(store, { baseUrl: fixture.baseUrl });
      assert.equal(fullRun.status, "complete");
      assert.equal(Object.keys(fullRun.index.pages).length, 3);

      // Simulate the session silently expiring, then crawl fresh (not resume).
      fixture.expireSessions();
      const pausedRun = await runCrawl(store, { baseUrl: fixture.baseUrl });
      assert.equal(pausedRun.status, "paused");
      if (pausedRun.status === "paused") {
        assert.equal(pausedRun.pausedAtPageId, "PageA.aspx");
        assert.deepEqual(pausedRun.remainingPageIds, ["PageA.aspx", "PageB.aspx", "PageC.aspx"]);
      }

      // Re-authenticate and resume.
      const secondAuth = await launchAuthSession(fixture.baseUrl);
      await simulateLogin(secondAuth, fixture.baseUrl);
      await confirmAuthSession(store, secondAuth);

      const resumedRun = await runCrawl(store, { baseUrl: fixture.baseUrl }, { resume: true });
      assert.equal(resumedRun.status, "complete");
      assert.equal(Object.keys(resumedRun.index.pages).length, 3);
      for (const pageId of ["PageA.aspx", "PageB.aspx", "PageC.aspx"]) {
        assert.ok(resumedRun.index.pages[pageId]?.length ?? 0 > 0, `${pageId} should have a recorded run`);
      }
    } finally {
      await fixture.close();
    }
  });
});
