import type { GateStatus, RunState, Stage } from "../types/evidence.ts";
import type { MigrationStore } from "../store/paths.ts";
import { writeJson } from "../store/jsonFile.ts";
import { getGate, isApproved } from "../store/gate.ts";

export const STAGE_ORDER: Stage[] = ["scan", "crawl", "requirements", "slices"];

/** Reads every gate, recomputes which stage the pipeline is currently on, and persists `run.json`. */
export async function refreshRunState(store: MigrationStore): Promise<RunState> {
  const gates: Partial<Record<Stage, GateStatus>> = {};
  for (const stage of STAGE_ORDER) {
    const gate = await getGate(store, stage);
    if (gate) gates[stage] = gate.status;
  }

  let currentStage: Stage | "done" = "done";
  for (const stage of STAGE_ORDER) {
    if (gates[stage] !== "approved") {
      currentStage = stage;
      break;
    }
  }

  const state: RunState = { currentStage, gates, updatedAt: new Date().toISOString() };
  await writeJson(store.runFile, state);
  return state;
}

/**
 * A stage only runs once its predecessor's gate is approved (migration-evidence-store
 * spec). `scan` has no predecessor and always may run.
 */
export async function assertStageReady(store: MigrationStore, stage: Stage): Promise<void> {
  const index = STAGE_ORDER.indexOf(stage);
  if (index <= 0) return;
  const predecessor = STAGE_ORDER[index - 1]!;
  const gate = await getGate(store, predecessor);
  if (!isApproved(gate)) {
    throw new Error(
      `Cannot run stage "${stage}": predecessor stage "${predecessor}" gate is not approved (status: ${gate?.status ?? "missing"})`,
    );
  }
}
