import { createHash } from "node:crypto";

/** Deterministic content hash for an evidence artifact (stable key order). */
export function hashArtifact(value: unknown): string {
  const json = canonicalize(value);
  return createHash("sha256").update(json).digest("hex");
}

function canonicalize(value: unknown): string {
  return JSON.stringify(sortKeysDeep(value));
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    const result: Record<string, unknown> = {};
    for (const [key, v] of entries) {
      result[key] = sortKeysDeep(v);
    }
    return result;
  }
  return value;
}
