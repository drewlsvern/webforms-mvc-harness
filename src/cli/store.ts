import path from "node:path";
import { createStore, type MigrationStore } from "../store/paths.ts";

/** Resolves the migration store from a `--root` flag (defaults to the current working directory). */
export function resolveStore(root: string | undefined): MigrationStore {
  return createStore(path.resolve(root ?? process.cwd()));
}
