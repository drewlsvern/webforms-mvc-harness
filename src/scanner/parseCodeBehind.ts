import type { NavigationEdge } from "../types/evidence.ts";
import { stripQueryString } from "./parseMarkup.ts";

export interface CodeBehindParseResult {
  eventHandlers: string[];
  redirectEdges: NavigationEdge[];
  presenterRef: string | null;
  modelRefs: string[];
}

const HANDLER_SIGNATURE = /(?:protected|public|private)\s+void\s+(\w+)\s*\([^)]*\)\s*\{/g;

export function parseCodeBehind(source: string): CodeBehindParseResult {
  const eventHandlers: string[] = [];
  const redirectEdges: NavigationEdge[] = [];

  for (const match of source.matchAll(HANDLER_SIGNATURE)) {
    const name = match[1];
    if (!name) continue;
    const bodyStart = match.index + match[0].length;
    const body = extractBraceBody(source, bodyStart - 1);
    if (body === null) continue;
    eventHandlers.push(name);

    for (const redirect of body.matchAll(/Response\.Redirect\(\s*"([^"]+)"/g)) {
      redirectEdges.push({ kind: "redirectOrTransfer", targetPage: stripQueryString(redirect[1] ?? ""), sourceLocation: name });
    }
    for (const transfer of body.matchAll(/Server\.Transfer\(\s*"([^"]+)"/g)) {
      redirectEdges.push({ kind: "redirectOrTransfer", targetPage: stripQueryString(transfer[1] ?? ""), sourceLocation: name });
    }
  }

  const presenterRef = findPresenterRef(source);
  const modelRefs = findModelRefs(source);

  return { eventHandlers, redirectEdges, presenterRef, modelRefs };
}

/** Given the index of an opening `{`, returns the text between it and its matching `}`. */
function extractBraceBody(source: string, openBraceIndex: number): string | null {
  if (source[openBraceIndex] !== "{") return null;
  let depth = 0;
  for (let i = openBraceIndex; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}") {
      depth--;
      if (depth === 0) return source.slice(openBraceIndex + 1, i);
    }
  }
  return null;
}

function findPresenterRef(source: string): string | null {
  const fieldDeclaration = /(?:private|protected|public)\s+(?:readonly\s+)?(I?\w*Presenter)\s+\w+\s*[;=]/.exec(source);
  if (fieldDeclaration?.[1]) return fieldDeclaration[1];
  const anyUsage = /\b(I?\w*Presenter)\b/.exec(source);
  return anyUsage?.[1] ?? null;
}

function findModelRefs(source: string): string[] {
  const found = new Set<string>();
  for (const match of source.matchAll(/\b(\w+(?:ViewModel|Model))\b/g)) {
    const name = match[1];
    if (name && name !== "Model" && name !== "ViewModel") found.add(name);
  }
  return [...found];
}
