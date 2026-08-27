import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Writes an evidence artifact's JSON (the sole source of truth) and regenerates
 * its paired Markdown view from that same JSON. Nothing should write Markdown
 * any other way - see migration-evidence-store spec, "JSON is the sole source
 * of truth".
 */
export async function writeArtifact<T>(
  jsonPath: string,
  mdPath: string,
  data: T,
  renderMarkdown: (data: T) => string,
): Promise<void> {
  await mkdir(path.dirname(jsonPath), { recursive: true });
  await mkdir(path.dirname(mdPath), { recursive: true });
  await writeFile(jsonPath, JSON.stringify(data, null, 2) + "\n", "utf8");
  await writeFile(mdPath, renderMarkdown(data), "utf8");
}

export async function readJson<T>(jsonPath: string): Promise<T> {
  const raw = await readFile(jsonPath, "utf8");
  return JSON.parse(raw) as T;
}

export async function writeJson<T>(jsonPath: string, data: T): Promise<void> {
  await mkdir(path.dirname(jsonPath), { recursive: true });
  await writeFile(jsonPath, JSON.stringify(data, null, 2) + "\n", "utf8");
}

export function isNotFound(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code: unknown }).code === "ENOENT";
}
