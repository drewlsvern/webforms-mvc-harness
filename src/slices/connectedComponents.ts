import type { PageGraph } from "./graph.ts";

/** Each connected component is one slice - a page with no navigation edges forms its own singleton slice. */
export function computeConnectedComponents(graph: PageGraph): string[][] {
  const visited = new Set<string>();
  const components: string[][] = [];

  for (const start of [...graph.nodes].sort()) {
    if (visited.has(start)) continue;
    const component: string[] = [];
    const queue = [start];
    visited.add(start);
    while (queue.length > 0) {
      const current = queue.shift()!;
      component.push(current);
      for (const neighbor of graph.adjacency.get(current) ?? []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }
    components.push(component.sort());
  }

  return components;
}
