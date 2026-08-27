import type { PageScanEvidence } from "../types/evidence.ts";

export interface PageGraph {
  nodes: Set<string>;
  adjacency: Map<string, Set<string>>;
}

/**
 * Builds an undirected page graph from navigation edges recorded by the
 * static scanner (PostBackUrl, Redirect/Transfer, content-area hyperlinks).
 * Edges pointing at a page the scanner never found are dropped for graph
 * purposes - they stay visible in the source page's own scan evidence, but
 * can't place an unknown page into a slice.
 */
export function buildPageGraph(pages: PageScanEvidence[]): PageGraph {
  const nodes = new Set(pages.map((p) => p.pageId));
  const adjacency = new Map<string, Set<string>>();
  for (const pageId of nodes) adjacency.set(pageId, new Set());

  const addEdge = (a: string, b: string) => {
    adjacency.get(a)?.add(b);
    adjacency.get(b)?.add(a);
  };

  for (const page of pages) {
    for (const edge of page.navigationEdges) {
      if (nodes.has(edge.targetPage)) addEdge(page.pageId, edge.targetPage);
    }
  }

  return { nodes, adjacency };
}
