import type { GateRecord, Stage } from "../types/evidence.ts";
import type { MigrationStore } from "./paths.ts";
import { gateFilePath } from "./paths.ts";
import { hashArtifact } from "./hash.ts";
import { isNotFound, readJson, writeArtifact, writeJson } from "./jsonFile.ts";

async function readGate(store: MigrationStore, stage: Stage): Promise<GateRecord | null> {
  try {
    return await readJson<GateRecord>(gateFilePath(store, stage));
  } catch (err) {
    if (isNotFound(err)) return null;
    throw err;
  }
}

/** Creates a pending gate once a stage finishes producing evidence. */
export async function createPendingGate(store: MigrationStore, stage: Stage, artifact: unknown): Promise<GateRecord> {
  const record: GateRecord = {
    stage,
    status: "pending",
    artifactHash: hashArtifact(artifact),
    reviewedBy: null,
    comment: null,
    createdAt: new Date().toISOString(),
    reviewedAt: null,
  };
  await writeJson(gateFilePath(store, stage), record);
  return record;
}

/** Approves a pending (or previously rejected) gate, capturing the hash of what was approved. */
export async function approveGate(
  store: MigrationStore,
  stage: Stage,
  artifact: unknown,
  reviewedBy: string,
): Promise<GateRecord> {
  const record: GateRecord = {
    stage,
    status: "approved",
    artifactHash: hashArtifact(artifact),
    reviewedBy,
    comment: null,
    createdAt: (await readGate(store, stage))?.createdAt ?? new Date().toISOString(),
    reviewedAt: new Date().toISOString(),
  };
  await writeJson(gateFilePath(store, stage), record);
  return record;
}

/** Rejects a pending gate with a reviewer comment; the next stage stays blocked. */
export async function rejectGate(
  store: MigrationStore,
  stage: Stage,
  reviewedBy: string,
  comment: string,
): Promise<GateRecord> {
  const existing = await readGate(store, stage);
  if (!existing) {
    throw new Error(`No gate exists for stage "${stage}" to reject`);
  }
  const record: GateRecord = {
    ...existing,
    status: "rejected",
    reviewedBy,
    comment,
    reviewedAt: new Date().toISOString(),
  };
  await writeJson(gateFilePath(store, stage), record);
  return record;
}

export async function getGate(store: MigrationStore, stage: Stage): Promise<GateRecord | null> {
  return readGate(store, stage);
}

export function isApproved(gate: GateRecord | null): boolean {
  return gate?.status === "approved";
}

/**
 * Applies a structured edit to an artifact's JSON fields, regenerates its
 * Markdown view, and returns the updated artifact. Per the migration-evidence-store
 * spec, gate review edits touch specific JSON fields only - never the
 * regenerated Markdown - so callers pass a mutator over the typed artifact
 * rather than raw text.
 */
export async function applyStructuredEdit<T>(
  jsonPath: string,
  mdPath: string,
  mutate: (current: T) => T,
  renderMarkdown: (data: T) => string,
): Promise<T> {
  const current = await readJson<T>(jsonPath);
  const updated = mutate(current);
  await writeArtifact(jsonPath, mdPath, updated, renderMarkdown);
  return updated;
}
