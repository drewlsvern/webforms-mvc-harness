import type { SliceEvidence } from "../types/evidence.ts";
import type { MigrationStore } from "../store/paths.ts";
import { loadCurrentSlices } from "./editSlices.ts";
import { writeSliceEvidence } from "./writeSlices.ts";
import { getGate, isApproved } from "../store/gate.ts";

export type SliceLifecycleState = "locked" | "ready" | "selected" | "done";

export interface SliceStateEntry {
  sliceId: string;
  state: SliceLifecycleState;
}

/**
 * `locked`/`ready` are computed on every call from each slice's `dependsOn`
 * and the status of whatever it depends on (in practice, the shared slice) -
 * nothing to persist or get out of sync for those two states.
 */
export function computeSliceStates(slices: SliceEvidence[]): SliceStateEntry[] {
  const statusById = new Map(slices.map((s) => [s.id, s.status]));

  return slices.map((slice) => {
    if (slice.status === "done") return { sliceId: slice.id, state: "done" };
    if (slice.status === "selected") return { sliceId: slice.id, state: "selected" };

    const locked = slice.dependsOn.some((dep) => statusById.get(dep.sliceId) !== "done");
    return { sliceId: slice.id, state: locked ? "locked" : "ready" };
  });
}

export async function getSliceStates(store: MigrationStore): Promise<SliceStateEntry[]> {
  const slices = await loadCurrentSlices(store);
  return computeSliceStates(slices);
}

/** Reviewer action: pick exactly one `ready` slice per round to work on next. */
export async function selectSlice(store: MigrationStore, sliceId: string): Promise<SliceEvidence> {
  const slicesGate = await getGate(store, "slices");
  if (!isApproved(slicesGate)) {
    throw new Error(`Cannot select a slice: the slices gate is not approved (status: ${slicesGate?.status ?? "missing"})`);
  }

  const slices = await loadCurrentSlices(store);
  const states = computeSliceStates(slices);
  const target = states.find((s) => s.sliceId === sliceId);
  if (!target) throw new Error(`Unknown slice "${sliceId}"`);

  if (target.state === "locked") throw new Error(`Slice "${sliceId}" is locked and cannot be selected yet`);
  if (target.state !== "ready") throw new Error(`Slice "${sliceId}" is not ready to select (current state: ${target.state})`);

  const alreadySelected = states.find((s) => s.state === "selected");
  if (alreadySelected) throw new Error(`Slice "${alreadySelected.sliceId}" is already selected; only one slice may be selected at a time`);

  const slice = slices.find((s) => s.id === sliceId)!;
  const updated: SliceEvidence = { ...slice, status: "selected" };
  await writeSliceEvidence(store, updated);
  return updated;
}
