import type { NavigationEdge } from "../types/evidence.ts";
import { stripQueryString } from "./parseMarkup.ts";
import { stripCommentsAndStrings } from "./csharpSource.ts";

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

  // Redirect/Transfer targets are string literal arguments, so this pass
  // still needs the original (unstripped) source.
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

  const stripped = stripCommentsAndStrings(source);
  const presenterRef = findPresenterRef(stripped);
  const modelRefs = findModelRefsInStripped(stripped);

  return { eventHandlers, redirectEdges, presenterRef, modelRefs };
}

/** Model/ViewModel references in a C# source file - exported so presenter files can be scanned the same way page code-behind is. */
export function findModelRefs(source: string): string[] {
  return findModelRefsInStripped(stripCommentsAndStrings(source));
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

/** Declaration/usage-position patterns for a `\w+<suffix>` type name, tried before any blanket fallback scan. */
function declarationPositionMatches(strippedSource: string, suffixAlternation: string): Set<string> {
  const typeToken = `\\w+(?:${suffixAlternation})`;
  const patterns = [
    new RegExp(`\\b(${typeToken})\\s+\\w+\\s*[;,)=]`, "g"), // field/property/parameter/local declaration, or a method's return type before its name
    new RegExp(`[<,]\\s*(${typeToken})\\s*[>,]`, "g"), // generic type argument, e.g. List<OrderModel>
    new RegExp(`\\bnew\\s+(${typeToken})\\s*[({]`, "g"), // object instantiation
  ];
  const found = new Set<string>();
  for (const pattern of patterns) {
    for (const match of strippedSource.matchAll(pattern)) {
      const name = match[1];
      if (name) found.add(name);
    }
  }
  return found;
}

function findPresenterRef(strippedSource: string): string | null {
  const fieldDeclaration = /(?:private|protected|public)\s+(?:readonly\s+)?(I?\w*Presenter)\s+\w+\s*[;=]/.exec(strippedSource);
  if (fieldDeclaration?.[1]) return fieldDeclaration[1];

  const declared = declarationPositionMatches(strippedSource, "Presenter");
  if (declared.size > 0) return [...declared][0]!;

  const anyUsage = /\b(I?\w*Presenter)\b/.exec(strippedSource);
  return anyUsage?.[1] ?? null;
}

function findModelRefsInStripped(strippedSource: string): string[] {
  const exclude = new Set(["Model", "ViewModel"]);

  const declared = [...declarationPositionMatches(strippedSource, "ViewModel|Model")].filter((name) => !exclude.has(name));
  if (declared.length > 0) return declared;

  const found = new Set<string>();
  for (const match of strippedSource.matchAll(/\b(\w+(?:ViewModel|Model))\b/g)) {
    const name = match[1];
    if (name && !exclude.has(name)) found.add(name);
  }
  return [...found];
}
