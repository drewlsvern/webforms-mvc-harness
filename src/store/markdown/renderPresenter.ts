import type { PresenterEvidence } from "../../types/evidence.ts";

export function renderPresenter(presenter: PresenterEvidence): string {
  const lines: string[] = [];
  lines.push(`# Presenter: ${presenter.id}`, "");
  lines.push(`- **Path:** \`${presenter.path}\``);
  lines.push("");

  lines.push("## Models", "");
  if (presenter.modelRefs.length === 0) {
    lines.push("_none found_");
  } else {
    for (const model of presenter.modelRefs) {
      lines.push(`- \`${model}\``);
    }
  }
  lines.push("");

  return lines.join("\n");
}
