import { EventEmitter } from "node:events";
import type { Stage } from "../types/evidence.ts";

export type ProgressEvent =
  | { stage: Stage; type: "started" }
  | { stage: "scan"; type: "summary"; pages: number; controls: number; presenters: number }
  | { stage: "requirements"; type: "summary"; functional: number; nonfunctional: number }
  | { stage: "slices"; type: "summary"; slices: number; sharedSlice: boolean }
  | { stage: "crawl"; type: "visiting"; pageId: string; visited: number; total: number }
  | { stage: "crawl"; type: "captured"; pageId: string; redirectedTo: string | null; requestCount: number; visited: number; total: number }
  | { stage: "crawl"; type: "paused"; pageId: string; visited: number; total: number }
  | { stage: "crawl"; type: "complete"; visited: number; total: number };

/**
 * Only one stage runs at a time (a stage can't start until its predecessor's
 * gate is approved), so a single process-wide emitter is enough - the server
 * just broadcasts to whoever's connected over SSE, with no per-client state.
 */
export const progress = new EventEmitter();

export function emitProgress(event: ProgressEvent): void {
  progress.emit("progress", event);
}
