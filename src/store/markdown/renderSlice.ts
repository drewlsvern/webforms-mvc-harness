import type { SliceEvidence } from "../../types/evidence.ts";

export function renderSlice(slice: SliceEvidence): string {
  const lines: string[] = [];
  lines.push(`# Slice: ${slice.id}`, "");
  lines.push(`- **Status:** ${slice.status}`, "");

  if (slice.pages.length > 0) {
    lines.push("## Pages", "");
    for (const page of slice.pages) {
      lines.push(`- \`${page}\``);
    }
    lines.push("");
  }

  if (slice.componentRefs.length > 0) {
    lines.push("## Shared components", "");
    for (const component of slice.componentRefs) {
      lines.push(`- ${component.kind}: \`${component.id}\``);
    }
    lines.push("");
  }

  lines.push("## Depends on", "");
  if (slice.dependsOn.length === 0) {
    lines.push("_none_");
  } else {
    for (const dep of slice.dependsOn) {
      const components = dep.components.map((c) => `${c.kind}:${c.id}`).join(", ");
      lines.push(`- \`${dep.sliceId}\` (via ${components})`);
    }
  }
  lines.push("");

  lines.push("## Requirements", "");
  if (slice.requirementRefs.length === 0) {
    lines.push("_none linked_");
  } else {
    for (const ref of slice.requirementRefs) {
      lines.push(`- \`${ref}\``);
    }
  }
  lines.push("");

  return lines.join("\n");
}
