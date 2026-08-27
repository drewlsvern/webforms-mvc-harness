import path from "node:path";
import type { MigrationStore } from "../store/paths.ts";
import { readJson } from "../store/jsonFile.ts";
import type { Stage } from "../types/evidence.ts";

/** Re-derives the current evidence bundle a gate should hash-check against, for CLI/API approval. */
export async function readGateArtifact(store: MigrationStore, stage: Stage): Promise<unknown> {
  switch (stage) {
    case "scan":
      return readJson(store.scanIndexFile);
    case "crawl":
      return readJson(store.crawlIndexFile);
    case "requirements": {
      const functional = await readJson(path.join(store.requirementsDir, "functional.json"));
      const nonfunctional = await readJson(path.join(store.requirementsDir, "nonfunctional.json"));
      return { functional, nonfunctional };
    }
    case "slices":
      return readJson(store.slicesIndexFile);
  }
}
