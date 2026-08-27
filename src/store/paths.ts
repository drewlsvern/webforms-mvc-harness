import path from "node:path";
import { mkdir } from "node:fs/promises";
import type { Stage } from "../types/evidence.ts";

export interface MigrationStore {
  root: string;
  runFile: string;
  scanDir: string;
  scanPagesDir: string;
  scanControlsDir: string;
  scanPresentersDir: string;
  scanIndexFile: string;
  crawlDir: string;
  crawlPagesDir: string;
  crawlIndexFile: string;
  requirementsDir: string;
  slicesDir: string;
  slicesIndexFile: string;
  gatesDir: string;
}

export function createStore(root: string): MigrationStore {
  const base = path.join(root, ".migration");
  const scanDir = path.join(base, "scan");
  const crawlDir = path.join(base, "crawl");
  const requirementsDir = path.join(base, "requirements");
  const slicesDir = path.join(base, "slices");
  const gatesDir = path.join(base, "gates");
  return {
    root: base,
    runFile: path.join(base, "run.json"),
    scanDir,
    scanPagesDir: path.join(scanDir, "pages"),
    scanControlsDir: path.join(scanDir, "controls"),
    scanPresentersDir: path.join(scanDir, "presenters"),
    scanIndexFile: path.join(scanDir, "index.json"),
    crawlDir,
    crawlPagesDir: path.join(crawlDir, "pages"),
    crawlIndexFile: path.join(crawlDir, "index.json"),
    requirementsDir,
    slicesDir,
    slicesIndexFile: path.join(slicesDir, "index.json"),
    gatesDir,
  };
}

export async function scaffoldStore(store: MigrationStore): Promise<void> {
  const dirs = [
    store.root,
    store.scanDir,
    store.scanPagesDir,
    store.scanControlsDir,
    store.scanPresentersDir,
    store.crawlDir,
    store.crawlPagesDir,
    store.requirementsDir,
    store.slicesDir,
    store.gatesDir,
  ];
  for (const dir of dirs) {
    await mkdir(dir, { recursive: true });
  }
}

export function gateFilePath(store: MigrationStore, stage: Stage): string {
  return path.join(store.gatesDir, `${stage}.gate.json`);
}

export function pageEvidencePaths(store: MigrationStore, pageId: string): { json: string; md: string } {
  return {
    json: path.join(store.scanPagesDir, `${pageId}.json`),
    md: path.join(store.scanPagesDir, `${pageId}.md`),
  };
}

export function sliceEvidencePaths(store: MigrationStore, sliceId: string): { dir: string; json: string; md: string } {
  const dir = path.join(store.slicesDir, sliceId);
  return {
    dir,
    json: path.join(dir, "slice.json"),
    md: path.join(dir, "slice.md"),
  };
}

export function crawlRunDir(store: MigrationStore, pageId: string, runId: string): string {
  return path.join(store.crawlPagesDir, pageId, runId);
}
