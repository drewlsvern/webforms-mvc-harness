import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createStore } from "../store/paths.ts";
import { createApp } from "./app.ts";

/** Same minimal login-redirect fixture app used by the crawler's own auth tests. */
async function startFixtureApp(): Promise<{ baseUrl: string; close: () => Promise<void> }> {
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
        res.writeHead(302, { "set-cookie": `sid=${sessionId}; Path=/`, location: "/" });
        res.end();
        return;
      }
      res.writeHead(200, { "content-type": "text/html" });
      res.end("<html><body>Login page</body></html>");
      return;
    }

    if (!authenticated) {
      res.writeHead(302, { location: "/Login.aspx" });
      res.end();
      return;
    }
    res.writeHead(200, { "content-type": "text/html" });
    res.end(`<html><body>${url.pathname}</body></html>`);
  });

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const { port } = server.address() as AddressInfo;
  return { baseUrl: `http://127.0.0.1:${port}`, close: () => new Promise<void>((resolve) => server.close(() => resolve())) };
}

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

test("API: crawl auth start/confirm flow persists a usable session", async () => {
  await withServer(async (serverBaseUrl) => {
    const fixture = await startFixtureApp();
    try {
      const initialStatus = (await (await fetch(`${serverBaseUrl}/api/crawl/auth`)).json()) as { hasSession: boolean };
      assert.equal(initialStatus.hasSession, false);

      const startRes = await fetch(`${serverBaseUrl}/api/crawl/auth/start`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ baseUrl: fixture.baseUrl }),
      });
      assert.equal(startRes.status, 200);
      const { loginUrl } = (await startRes.json()) as { loginUrl: string };
      assert.match(loginUrl, /\/Login\.aspx/);

      // Starting a second session while one's in progress should be rejected.
      const secondStart = await fetch(`${serverBaseUrl}/api/crawl/auth/start`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ baseUrl: fixture.baseUrl }),
      });
      assert.equal(secondStart.status, 409);

      // The actual login flow (auth.ts's launchAuthSession/confirmAuthSession,
      // including a real successful login) is covered end-to-end by
      // crawler/crawlAuth.integration.test.ts. This test verifies the HTTP
      // wiring around it - confirming here just persists whatever state the
      // server's headed page currently holds.
      const confirmRes = await fetch(`${serverBaseUrl}/api/crawl/auth/confirm`, { method: "POST" });
      assert.equal(confirmRes.status, 200);

      const afterStatus = (await (await fetch(`${serverBaseUrl}/api/crawl/auth`)).json()) as { hasSession: boolean; loginUrl: string };
      assert.equal(afterStatus.hasSession, true);
      assert.match(afterStatus.loginUrl, /\/Login\.aspx/);

      // Confirming again with no session in progress is rejected.
      const confirmAgain = await fetch(`${serverBaseUrl}/api/crawl/auth/confirm`, { method: "POST" });
      assert.equal(confirmAgain.status, 409);
    } finally {
      await fixture.close();
    }
  });
});
