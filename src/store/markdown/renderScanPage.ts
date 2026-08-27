import type { PageScanEvidence } from "../../types/evidence.ts";

export function renderScanPage(page: PageScanEvidence): string {
  const lines: string[] = [];
  lines.push(`# ${page.pageId}`, "");
  lines.push(`- **Path:** \`${page.path}\``);
  lines.push(`- **Code-behind:** ${page.codeBehindPath ? `\`${page.codeBehindPath}\`` : "_none found_"}`);
  lines.push(`- **Master Page:** ${page.masterPage ? `\`${page.masterPage}\`` : "_none_"}`);
  lines.push(`- **Presenter:** ${page.presenterRef ? `\`${page.presenterRef}\`` : "_none_"}`);
  lines.push(
    `- **Models:** ${page.modelRefs.length ? page.modelRefs.map((m) => `\`${m}\``).join(", ") : "_none_"}`,
  );
  lines.push(
    `- **UserControls:** ${
      page.userControlRefs.length ? page.userControlRefs.map((u) => `\`${u}\``).join(", ") : "_none_"
    }`,
  );
  lines.push("");

  lines.push("## Controls", "");
  if (page.controls.length === 0) {
    lines.push("_none found_");
  } else {
    for (const control of page.controls) {
      lines.push(`- \`${control.id}\` (${control.type})`);
    }
  }
  lines.push("");

  lines.push("## Navigation edges", "");
  if (page.navigationEdges.length === 0) {
    lines.push("_none found_");
  } else {
    for (const edge of page.navigationEdges) {
      const source = edge.sourceLocation ? ` — ${edge.sourceLocation}` : "";
      lines.push(`- **${edge.kind}** → \`${edge.targetPage}\`${source}`);
    }
  }
  lines.push("");

  return lines.join("\n");
}
