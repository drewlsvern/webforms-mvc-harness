import path from "node:path";
import { readFile } from "node:fs/promises";
import type {
  NavigationEdge,
  PageScanEvidence,
  PresenterEvidence,
  ScanIndex,
  UserControlEvidence,
} from "../types/evidence.ts";
import type { MigrationStore } from "../store/paths.ts";
import { pageEvidencePaths } from "../store/paths.ts";
import { writeArtifact, writeJson } from "../store/jsonFile.ts";
import { renderScanPage } from "../store/markdown/renderScanPage.ts";
import { renderPresenter } from "../store/markdown/renderPresenter.ts";
import { createPendingGate } from "../store/gate.ts";
import { emitProgress } from "../pipeline/progress.ts";
import { parseMarkup } from "./parseMarkup.ts";
import { parseCodeBehind, findModelRefs } from "./parseCodeBehind.ts";
import { resolveAppRelative, toPosix } from "./resolvePath.ts";
import { resolvePresenterId } from "./resolvePresenter.ts";
import { walkFiles } from "./walk.ts";

export interface ScanResult {
  index: ScanIndex;
  pages: PageScanEvidence[];
  controls: UserControlEvidence[];
  presenters: PresenterEvidence[];
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await readFile(p);
    return true;
  } catch {
    return false;
  }
}

export async function runScan(sourceRoot: string, store: MigrationStore): Promise<ScanResult> {
  emitProgress({ stage: "scan", type: "started" });

  const files = await walkFiles(sourceRoot);
  const aspxFiles = files.filter((f) => f.toLowerCase().endsWith(".aspx"));
  const ascxFiles = files.filter((f) => f.toLowerCase().endsWith(".ascx"));
  const presenterFiles = files.filter(
    (f) => f.toLowerCase().endsWith(".cs") && !f.toLowerCase().endsWith(".designer.cs") && /presenter/i.test(path.basename(f)),
  );

  // Presenters are parsed before pages so each page can resolve its
  // presenterRef and roll that presenter's models into its own modelRefs.
  const presenters: PresenterEvidence[] = [];
  for (const presenterFile of presenterFiles) {
    const relPath = toPosix(path.relative(sourceRoot, presenterFile));
    const id = path.basename(presenterFile).replace(/\.cs$/i, "");
    const modelRefs = findModelRefs(await readFile(presenterFile, "utf8"));
    const evidence: PresenterEvidence = { id, path: relPath, modelRefs };
    presenters.push(evidence);
    const presenterJsonPath = path.join(store.scanPresentersDir, `${sanitizeForPath(id)}.json`);
    const presenterMdPath = path.join(store.scanPresentersDir, `${sanitizeForPath(id)}.md`);
    await writeArtifact(presenterJsonPath, presenterMdPath, evidence, renderPresenter);
  }
  const presentersById = new Map(presenters.map((p) => [p.id, p]));
  const presenterIds = presenters.map((p) => p.id);

  const pages: PageScanEvidence[] = [];

  for (const aspxFile of aspxFiles) {
    const pageId = toPosix(path.relative(sourceRoot, aspxFile));
    const pageDir = toPosix(path.relative(sourceRoot, path.dirname(aspxFile)));
    const source = await readFile(aspxFile, "utf8");
    const markup = parseMarkup(source);

    const codeBehindFile = `${aspxFile}.cs`;
    const hasCodeBehind = await fileExists(codeBehindFile);
    const codeBehind = hasCodeBehind
      ? parseCodeBehind(await readFile(codeBehindFile, "utf8"))
      : { eventHandlers: [], redirectEdges: [], presenterRef: null, modelRefs: [] };

    const resolveEdge = (edge: NavigationEdge): NavigationEdge => ({
      ...edge,
      targetPage: resolveAppRelative(pageDir, edge.targetPage),
    });

    const navigationEdges: NavigationEdge[] = [
      ...markup.postBackUrlEdges.map(resolveEdge),
      ...markup.contentLinkEdges.map(resolveEdge),
      ...codeBehind.redirectEdges.map(resolveEdge),
    ];

    const userControlRefs = [...new Set(markup.userControlTagRefs.map((src) => resolveAppRelative(pageDir, src)))];

    const resolvedPresenterId = codeBehind.presenterRef ? resolvePresenterId(codeBehind.presenterRef, presenterIds) : null;
    const presenterModelRefs = resolvedPresenterId ? (presentersById.get(resolvedPresenterId)?.modelRefs ?? []) : [];
    const modelRefs = [...new Set([...codeBehind.modelRefs, ...presenterModelRefs])];

    const page: PageScanEvidence = {
      pageId,
      path: pageId,
      codeBehindPath: hasCodeBehind ? toPosix(path.relative(sourceRoot, codeBehindFile)) : null,
      masterPage: markup.masterPage ? resolveAppRelative(pageDir, markup.masterPage) : null,
      controls: markup.controls,
      navigationEdges,
      presenterRef: codeBehind.presenterRef,
      modelRefs,
      userControlRefs,
    };
    pages.push(page);

    const { json, md } = pageEvidencePaths(store, sanitizeForPath(pageId));
    await writeArtifact(json, md, page, renderScanPage);
  }

  const controls: UserControlEvidence[] = [];
  for (const ascxFile of ascxFiles) {
    const id = toPosix(path.relative(sourceRoot, ascxFile));
    const evidence: UserControlEvidence = { id, path: id };
    controls.push(evidence);
    await writeJson(path.join(store.scanControlsDir, `${sanitizeForPath(id)}.json`), evidence);
  }

  const index: ScanIndex = {
    pages: pages.map((p) => p.pageId).sort(),
    controls: controls.map((c) => c.id).sort(),
    presenters: presenters.map((p) => p.id).sort(),
    generatedAt: new Date().toISOString(),
  };
  await writeJson(store.scanIndexFile, index);

  const result: ScanResult = { index, pages, controls, presenters };
  await createPendingGate(store, "scan", result);
  emitProgress({ stage: "scan", type: "summary", pages: pages.length, controls: controls.length, presenters: presenters.length });
  return result;
}

function sanitizeForPath(id: string): string {
  return id.replace(/\\/g, "/");
}
