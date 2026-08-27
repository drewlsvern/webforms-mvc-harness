import type { CrawlRunEvidence } from "../../types/evidence.ts";

export function renderCrawlRun(run: CrawlRunEvidence): string {
  const lines: string[] = [];
  lines.push(`# Crawl run: ${run.pageId} / ${run.runId}`, "");
  lines.push(`- **Timestamp:** ${run.timestamp}`);
  lines.push(`- **DOM snapshot:** \`${run.domPath}\``);
  lines.push(`- **Screenshot:** \`${run.screenshotPath}\``);
  if (run.redirectedTo) {
    lines.push(`- **Redirected to:** \`${run.redirectedTo}\``);
  }
  lines.push("");

  lines.push("## Network activity", "");
  if (run.network.length === 0) {
    lines.push("_none observed_");
  } else {
    for (const entry of run.network) {
      lines.push(`- ${entry.method} \`${entry.url}\` → ${entry.status ?? "?"}`);
    }
  }
  lines.push("");

  lines.push("## Interactions", "");
  if (run.interactions.length === 0) {
    lines.push("_none observed_");
  } else {
    for (const interaction of run.interactions) {
      const selector = interaction.selector ? ` (\`${interaction.selector}\`)` : "";
      lines.push(`- **${interaction.type}**${selector}: ${interaction.description}`);
    }
  }
  lines.push("");

  return lines.join("\n");
}
