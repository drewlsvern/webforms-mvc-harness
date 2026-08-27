import path from "node:path";
import express, { type Request, type Response, type NextFunction } from "express";
import type { MigrationStore } from "../store/paths.ts";
import { isNotFound, readJson } from "../store/jsonFile.ts";
import { getGate } from "../store/gate.ts";
import type { Stage } from "../types/evidence.ts";
import { STAGE_ORDER } from "../pipeline/run.ts";
import { readGateArtifact } from "../pipeline/gateArtifact.ts";
import {
  runScanStage,
  runCrawlStage,
  runRequirementsStage,
  runSlicesStage,
  approveStageGate,
  rejectStageGate,
} from "../pipeline/pipeline.ts";
import { loadCurrentSlices, mergeSlices, splitSlice, movePages, promoteSharedComponent, demoteSharedComponent } from "../slices/editSlices.ts";
import { getSliceStates, selectSlice } from "../slices/selection.ts";
import { sliceEvidencePaths } from "../store/paths.ts";
import { cancelAuthSession, confirmAuthSession, launchAuthSession, loadAuthState, type AuthSession } from "../crawler/auth.ts";
import { getCrawlPauseState } from "../crawler/crawl.ts";
import { progress, type ProgressEvent } from "../pipeline/progress.ts";

type Handler = (req: Request, res: Response, store: MigrationStore) => Promise<void>;

/** Wraps an action so a thrown Error (a blocked/invalid action) becomes a 409, not an unhandled rejection. */
function action(store: MigrationStore, handler: Handler) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await handler(req, res, store);
    } catch (err) {
      if (err instanceof Error) {
        res.status(409).json({ error: err.message });
      } else {
        next(err);
      }
    }
  };
}

/** Wraps a read so evidence that hasn't been produced yet is a 404, not a 409 - it isn't a blocked action. */
function read(store: MigrationStore, handler: Handler) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await handler(req, res, store);
    } catch (err) {
      if (isNotFound(err)) {
        res.status(404).json({ error: "not found" });
      } else if (err instanceof Error) {
        res.status(500).json({ error: err.message });
      } else {
        next(err);
      }
    }
  };
}

export function createApp(store: MigrationStore): express.Express {
  const app = express();
  app.use(express.json());

  const wrap = (handler: Handler) => action(store, handler);
  const wrapRead = (handler: Handler) => read(store, handler);

  // Only one authentication flow (a visible browser window) makes sense at a time.
  let activeAuthSession: AuthSession | null = null;

  // --- Reads ---

  app.get("/api/run", wrapRead(async (_req, res, store) => {
    try {
      res.json(await readJson(store.runFile));
    } catch {
      res.json({ currentStage: "scan", gates: {}, updatedAt: null });
    }
  }));

  app.get("/api/gates/:stage", wrapRead(async (req, res, store) => {
    const stage = req.params.stage as Stage;
    if (!STAGE_ORDER.includes(stage)) return void res.status(404).json({ error: `Unknown stage "${stage}"` });
    res.json(await getGate(store, stage));
  }));

  app.get("/api/scan/index", wrapRead(async (_req, res, store) => {
    res.json(await readJson(store.scanIndexFile));
  }));

  app.get("/api/scan/pages/:pageId", wrapRead(async (req, res, store) => {
    res.json(await readJson(path.join(store.scanPagesDir, `${req.params.pageId}.json`)));
  }));

  app.get("/api/crawl/index", wrapRead(async (_req, res, store) => {
    res.json(await readJson(store.crawlIndexFile));
  }));

  app.get("/api/crawl/pause-state", wrapRead(async (_req, res, store) => {
    res.json(await getCrawlPauseState(store));
  }));

  app.get("/api/crawl/pages/:pageId/:runId", wrapRead(async (req, res, store) => {
    res.json(await readJson(path.join(store.crawlPagesDir, req.params.pageId!, req.params.runId!, "run.json")));
  }));

  const CRAWL_RUN_FILES = new Set(["screenshot.png", "dom.html", "network.json", "interactions.json"]);
  app.get("/api/crawl/pages/:pageId/:runId/file/:filename", (req, res) => {
    const { filename } = req.params;
    if (!CRAWL_RUN_FILES.has(filename!)) return void res.status(404).end();
    res.sendFile(path.join(store.crawlPagesDir, req.params.pageId!, req.params.runId!, filename!));
  });

  app.get("/api/requirements", wrapRead(async (_req, res, store) => {
    const functional = await readJson(path.join(store.requirementsDir, "functional.json"));
    const nonfunctional = await readJson(path.join(store.requirementsDir, "nonfunctional.json"));
    res.json({ functional, nonfunctional });
  }));

  app.get("/api/slices", wrapRead(async (_req, res, store) => {
    const slices = await loadCurrentSlices(store);
    const states = await getSliceStates(store);
    res.json({ slices, states });
  }));

  app.get("/api/slices/:sliceId", wrapRead(async (req, res, store) => {
    res.json(await readJson(sliceEvidencePaths(store, req.params.sliceId!).json));
  }));

  // --- Stage actions ---

  app.post("/api/stages/scan", wrap(async (req, res, store) => {
    const { sourceRoot } = req.body as { sourceRoot?: string };
    if (!sourceRoot) return void res.status(400).json({ error: "sourceRoot is required" });
    res.json(await runScanStage(sourceRoot, store));
  }));

  app.post("/api/stages/crawl", wrap(async (req, res, store) => {
    const { baseUrl, maxPages, resume } = req.body as { baseUrl?: string; maxPages?: number; resume?: boolean };
    if (!baseUrl) return void res.status(400).json({ error: "baseUrl is required" });
    res.json(await runCrawlStage(store, { baseUrl, maxPages }, { resume }));
  }));

  app.post("/api/stages/requirements", wrap(async (_req, res, store) => {
    res.json(await runRequirementsStage(store));
  }));

  // --- Crawl authentication ---

  app.get("/api/crawl/auth", wrapRead(async (_req, res, store) => {
    const state = await loadAuthState(store);
    res.json({ hasSession: state !== null, sessionInProgress: activeAuthSession !== null, loginUrl: state?.loginUrl ?? null });
  }));

  app.post("/api/crawl/auth/start", wrap(async (req, res) => {
    const { baseUrl } = req.body as { baseUrl?: string };
    if (!baseUrl) return void res.status(400).json({ error: "baseUrl is required" });
    if (activeAuthSession) throw new Error("An authentication session is already in progress");
    activeAuthSession = await launchAuthSession(baseUrl);
    res.json({ loginUrl: activeAuthSession.loginUrl });
  }));

  app.post("/api/crawl/auth/confirm", wrap(async (_req, res, store) => {
    if (!activeAuthSession) throw new Error("No authentication session is in progress");
    const state = await confirmAuthSession(store, activeAuthSession);
    activeAuthSession = null;
    res.json({ loginUrl: state.loginUrl, capturedAt: state.capturedAt });
  }));

  app.post("/api/crawl/auth/cancel", wrap(async (_req, res) => {
    if (activeAuthSession) {
      await cancelAuthSession(activeAuthSession);
      activeAuthSession = null;
    }
    res.json({ ok: true });
  }));

  // --- Live progress (SSE, any stage) ---

  app.get("/api/progress", (req, res) => {
    res.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    });
    res.write(":ok\n\n");

    const onProgress = (event: ProgressEvent) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };
    progress.on("progress", onProgress);
    req.on("close", () => progress.off("progress", onProgress));
  });

  app.post("/api/stages/slices", wrap(async (_req, res, store) => {
    res.json(await runSlicesStage(store));
  }));

  // --- Gate actions ---

  app.post("/api/gates/:stage/approve", wrap(async (req, res, store) => {
    const stage = req.params.stage as Stage;
    if (!STAGE_ORDER.includes(stage)) return void res.status(404).json({ error: `Unknown stage "${stage}"` });
    const { reviewedBy } = req.body as { reviewedBy?: string };
    const artifact = await readGateArtifact(store, stage);
    res.json(await approveStageGate(store, stage, artifact, reviewedBy ?? "web"));
  }));

  app.post("/api/gates/:stage/reject", wrap(async (req, res, store) => {
    const stage = req.params.stage as Stage;
    if (!STAGE_ORDER.includes(stage)) return void res.status(404).json({ error: `Unknown stage "${stage}"` });
    const { reviewedBy, comment } = req.body as { reviewedBy?: string; comment?: string };
    if (!comment) return void res.status(400).json({ error: "comment is required to reject a gate" });
    res.json(await rejectStageGate(store, stage, reviewedBy ?? "web", comment));
  }));

  // --- Slice gate editing ---

  app.post("/api/slices/merge", wrap(async (req, res, store) => {
    const { sliceIds, newId } = req.body as { sliceIds?: string[]; newId?: string };
    if (!sliceIds) return void res.status(400).json({ error: "sliceIds is required" });
    res.json(await mergeSlices(store, sliceIds, newId));
  }));

  app.post("/api/slices/split", wrap(async (req, res, store) => {
    const { sliceId, groups } = req.body as { sliceId?: string; groups?: { id: string; pages: string[] }[] };
    if (!sliceId || !groups) return void res.status(400).json({ error: "sliceId and groups are required" });
    res.json(await splitSlice(store, sliceId, groups));
  }));

  app.post("/api/slices/move", wrap(async (req, res, store) => {
    const { pageIds, fromSliceId, toSliceId } = req.body as { pageIds?: string[]; fromSliceId?: string; toSliceId?: string };
    if (!pageIds || !fromSliceId || !toSliceId) return void res.status(400).json({ error: "pageIds, fromSliceId, and toSliceId are required" });
    res.json(await movePages(store, pageIds, fromSliceId, toSliceId));
  }));

  app.post("/api/slices/promote", wrap(async (req, res, store) => {
    const { kind, id, sliceId } = req.body as { kind?: "userControl" | "presenter"; id?: string; sliceId?: string };
    if (!kind || !id || !sliceId) return void res.status(400).json({ error: "kind, id, and sliceId are required" });
    res.json(await promoteSharedComponent(store, kind, id, sliceId));
  }));

  app.post("/api/slices/demote", wrap(async (req, res, store) => {
    const { kind, id } = req.body as { kind?: "userControl" | "presenter"; id?: string };
    if (!kind || !id) return void res.status(400).json({ error: "kind and id are required" });
    await demoteSharedComponent(store, kind, id);
    res.json({ ok: true });
  }));

  // --- Slice selection ---

  app.post("/api/slices/select", wrap(async (req, res, store) => {
    const { sliceId } = req.body as { sliceId?: string };
    if (!sliceId) return void res.status(400).json({ error: "sliceId is required" });
    res.json(await selectSlice(store, sliceId));
  }));

  return app;
}
