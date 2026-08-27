import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import type { CrawlIndex, CrawlRunEvidence, ScanIndex } from "../types/evidence.ts";
import type { MigrationStore } from "../store/paths.ts";
import { crawlRunDir } from "../store/paths.ts";
import { isNotFound, readJson, writeArtifact, writeJson } from "../store/jsonFile.ts";
import { renderCrawlRun } from "../store/markdown/renderCrawlRun.ts";
import { createPendingGate } from "../store/gate.ts";
import { capturePage } from "./capture.ts";
import { seedRoutesFromScanIndex } from "./routeSeed.ts";
import type { CrawlConfig } from "./config.ts";
import { isLoginRedirect, loadAuthState } from "./auth.ts";
import { emitProgress } from "../pipeline/progress.ts";

export type CrawlRunResult =
  | { status: "complete"; index: CrawlIndex }
  | { status: "paused"; index: CrawlIndex; pausedAtPageId: string; remainingPageIds: string[] };

function pendingRoutesPath(store: MigrationStore): string {
  return path.join(store.crawlDir, "pending-routes.json");
}

async function tryReadJson<T>(jsonPath: string): Promise<T | null> {
  try {
    return await readJson<T>(jsonPath);
  } catch (err) {
    if (isNotFound(err)) return null;
    throw err;
  }
}

export interface CrawlPauseState {
  paused: boolean;
  pausedAtPageId: string | null;
  remainingCount: number;
}

/** Whether a crawl is currently paused awaiting re-authentication - the pending-routes marker only exists between a pause and its resume/fresh restart. */
export async function getCrawlPauseState(store: MigrationStore): Promise<CrawlPauseState> {
  const remaining = await tryReadJson<string[]>(pendingRoutesPath(store));
  if (!remaining || remaining.length === 0) return { paused: false, pausedAtPageId: null, remainingCount: 0 };
  return { paused: true, pausedAtPageId: remaining[0]!, remainingCount: remaining.length };
}

export interface RunCrawlOptions {
  /** Continue a previously paused crawl (picks up from the recorded pending routes) instead of starting fresh. */
  resume?: boolean;
}

export async function runCrawl(store: MigrationStore, config: CrawlConfig, options: RunCrawlOptions = {}): Promise<CrawlRunResult> {
  const authState = await loadAuthState(store);
  if (!authState) {
    throw new Error("No authenticated session found. Authenticate via the web UI before crawling.");
  }

  const scanIndex = await readJson<ScanIndex>(store.scanIndexFile);
  const allRoutes = seedRoutesFromScanIndex(scanIndex).slice(0, config.maxPages ?? Infinity);
  const pendingPath = pendingRoutesPath(store);

  let routes = allRoutes;
  let pages: Record<string, string[]> = {};
  if (options.resume) {
    routes = (await tryReadJson<string[]>(pendingPath)) ?? allRoutes;
    const existingIndex = await tryReadJson<CrawlIndex>(store.crawlIndexFile);
    pages = existingIndex?.pages ?? {};
  } else {
    await rm(pendingPath, { force: true });
  }

  let visited = Object.keys(pages).length;
  const total = allRoutes.length;

  emitProgress({ stage: "crawl", type: "started" });

  const browser = await chromium.launch();
  const context = await browser.newContext({ storageState: authState.storageState });
  const page = await context.newPage();

  try {
    for (const pageId of routes) {
      emitProgress({ stage: "crawl", type: "visiting", pageId, visited, total });

      const url = new URL(pageId, config.baseUrl).toString();
      const capture = await capturePage(page, url);

      if (isLoginRedirect(capture.landedUrl, authState.loginUrl)) {
        const remainingPageIds = routes.slice(routes.indexOf(pageId));
        await writeJson(pendingPath, remainingPageIds);
        const index: CrawlIndex = { pages, generatedAt: new Date().toISOString() };
        await writeJson(store.crawlIndexFile, index);
        emitProgress({ stage: "crawl", type: "paused", pageId, visited, total });
        return { status: "paused", index, pausedAtPageId: pageId, remainingPageIds };
      }

      const redirectedTo = capture.landedUrl !== url ? capture.landedUrl : null;
      const runId = `run-${Date.now()}`;
      const dir = crawlRunDir(store, pageId, runId);
      await mkdir(dir, { recursive: true });

      await writeFile(path.join(dir, "dom.html"), capture.dom, "utf8");
      await writeFile(path.join(dir, "screenshot.png"), capture.screenshot);
      await writeJson(path.join(dir, "network.json"), capture.network);
      await writeJson(path.join(dir, "interactions.json"), capture.interactions);

      const runEvidence: CrawlRunEvidence = {
        pageId,
        runId,
        timestamp: new Date().toISOString(),
        domPath: path.join(dir, "dom.html"),
        screenshotPath: path.join(dir, "screenshot.png"),
        network: capture.network,
        interactions: capture.interactions,
        redirectedTo,
      };
      await writeArtifact(path.join(dir, "run.json"), path.join(dir, "run.md"), runEvidence, renderCrawlRun);

      pages[pageId] = [...(pages[pageId] ?? []), runId];
      visited++;
      emitProgress({ stage: "crawl", type: "captured", pageId, redirectedTo, requestCount: capture.network.length, visited, total });
    }
  } finally {
    await browser.close();
  }

  await rm(pendingPath, { force: true });
  const index: CrawlIndex = { pages, generatedAt: new Date().toISOString() };
  await writeJson(store.crawlIndexFile, index);
  await createPendingGate(store, "crawl", index);
  emitProgress({ stage: "crawl", type: "complete", visited, total });
  return { status: "complete", index };
}
