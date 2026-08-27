import type { ControlReference, NavigationEdge } from "../types/evidence.ts";

export interface MarkupParseResult {
  masterPage: string | null;
  controls: ControlReference[];
  userControlTagRefs: string[];
  postBackUrlEdges: NavigationEdge[];
  contentLinkEdges: NavigationEdge[];
}

interface RegisteredControl {
  tag: string; // "prefix:tagname" lowercased
  src: string; // raw Src attribute value, e.g. "~/Controls/Search.ascx"
}

/**
 * Parses one .aspx/.master markup source. Only hyperlinks found inside
 * <asp:Content> blocks are treated as navigation edges - links belonging to
 * the shared Master Page are never inlined into a content page's own markup,
 * so scanning content-page files here already excludes master-page chrome
 * by construction (see webforms-static-scanner spec).
 */
export function parseMarkup(source: string): MarkupParseResult {
  const masterPage = matchFirst(source, /MasterPageFile\s*=\s*"([^"]+)"/i);
  const registered = parseRegisterDirectives(source);
  const contentBlocks = extractContentBlocks(source);

  const controls: ControlReference[] = [];
  const userControlTagRefs: string[] = [];
  const postBackUrlEdges: NavigationEdge[] = [];
  const contentLinkEdges: NavigationEdge[] = [];
  let anonCounter = 0;

  for (const block of contentBlocks) {
    for (const tagMatch of block.matchAll(/<([\w:]+)\b([^>]*)>/g)) {
      const rawTag = tagMatch[1] ?? "";
      const attrs = tagMatch[2] ?? "";
      const tagLower = rawTag.toLowerCase();
      if (!tagLower.startsWith("asp:") && !tagLower.includes(":")) continue;

      const id = matchFirst(attrs, /\bid\s*=\s*"([^"]+)"/i) ?? `anon-${++anonCounter}`;
      controls.push({ id, type: rawTag });

      const registration = registered.find((r) => r.tag === tagLower);
      if (registration) {
        userControlTagRefs.push(stripQueryString(registration.src));
      }

      const postBackUrl = matchFirst(attrs, /\bPostBackUrl\s*=\s*"([^"]+)"/i);
      if (postBackUrl) {
        postBackUrlEdges.push({
          kind: "postbackUrl",
          targetPage: stripQueryString(postBackUrl),
          sourceLocation: id,
        });
      }

      const navigateUrl = matchFirst(attrs, /\bNavigateUrl\s*=\s*"([^"]+)"/i);
      if (navigateUrl && tagLower === "asp:hyperlink") {
        const target = tryNormalizeLinkTarget(navigateUrl);
        if (target) contentLinkEdges.push({ kind: "contentLink", targetPage: target, sourceLocation: id });
      }
    }

    for (const linkMatch of block.matchAll(/<a\b[^>]*\bhref\s*=\s*"([^"]+)"[^>]*>/gi)) {
      const target = tryNormalizeLinkTarget(linkMatch[1] ?? "");
      if (target) contentLinkEdges.push({ kind: "contentLink", targetPage: target });
    }
  }

  return { masterPage: masterPage ? stripQueryString(masterPage) : null, controls, userControlTagRefs, postBackUrlEdges, contentLinkEdges };
}

function parseRegisterDirectives(source: string): RegisteredControl[] {
  const results: RegisteredControl[] = [];
  for (const match of source.matchAll(/<%@\s*Register\b([^%]*)%>/gi)) {
    const attrs = match[1] ?? "";
    const prefix = matchFirst(attrs, /\bTagPrefix\s*=\s*"([^"]+)"/i);
    const tagName = matchFirst(attrs, /\bTagName\s*=\s*"([^"]+)"/i);
    const src = matchFirst(attrs, /\bSrc\s*=\s*"([^"]+)"/i);
    if (prefix && tagName && src) {
      results.push({ tag: `${prefix}:${tagName}`.toLowerCase(), src });
    }
  }
  return results;
}

function extractContentBlocks(source: string): string[] {
  const blocks: string[] = [];
  for (const match of source.matchAll(/<asp:Content\b[^>]*>([\s\S]*?)<\/asp:Content>/gi)) {
    blocks.push(match[1] ?? "");
  }
  // A page with no MasterPageFile has no <asp:Content> wrapper - its whole body is "content".
  if (blocks.length === 0 && !/MasterPageFile\s*=/i.test(source)) {
    blocks.push(source);
  }
  return blocks;
}

function matchFirst(text: string, pattern: RegExp): string | null {
  const match = pattern.exec(text);
  return match?.[1] ?? null;
}

function tryNormalizeLinkTarget(raw: string): string | null {
  const href = raw.trim();
  if (!href || href.startsWith("#") || href.startsWith("javascript:") || href.startsWith("mailto:")) return null;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(href)) return null; // external absolute URL
  if (!/\.aspx(\?|$)/i.test(href)) return null; // only local page links count as navigation edges
  return stripQueryString(href);
}

/** Strips any query string from a raw href/attribute value; leaves ~/, /, and relative prefixes untouched. */
export function stripQueryString(raw: string): string {
  const value = raw.trim();
  const queryIndex = value.indexOf("?");
  return queryIndex >= 0 ? value.slice(0, queryIndex) : value;
}
