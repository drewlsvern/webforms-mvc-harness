import { readdir } from "node:fs/promises";
import path from "node:path";

const SKIP_DIRS = new Set(["bin", "obj", "node_modules", ".git", ".vs", ".migration"]);

export async function walkFiles(root: string): Promise<string[]> {
  const results: string[] = [];
  async function recurse(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        await recurse(path.join(dir, entry.name));
      } else if (entry.isFile()) {
        results.push(path.join(dir, entry.name));
      }
    }
  }
  await recurse(root);
  return results;
}
