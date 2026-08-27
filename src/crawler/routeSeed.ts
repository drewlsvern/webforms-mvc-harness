import type { ScanIndex } from "../types/evidence.ts";

/** The crawler starts from exactly the page inventory the static scanner found. */
export function seedRoutesFromScanIndex(index: ScanIndex): string[] {
  return [...index.pages];
}
