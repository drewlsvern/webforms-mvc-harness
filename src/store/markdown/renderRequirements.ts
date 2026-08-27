import type {
  EvidenceRef,
  FunctionalRequirement,
  NonFunctionalRequirement,
  RequirementsDocument,
} from "../../types/evidence.ts";

function renderEvidenceRefs(refs: EvidenceRef[]): string {
  if (refs.length === 0) return "_none_";
  return refs.map((r) => `\`${r.kind}:${r.path}\``).join(", ");
}

export function renderFunctionalRequirements(doc: RequirementsDocument<FunctionalRequirement>): string {
  const lines: string[] = ["# Functional Requirements", ""];
  for (const req of doc.requirements) {
    lines.push(`## ${req.id} (${req.pageId})`, "", req.description, "");
    lines.push(`**Evidence:** ${renderEvidenceRefs(req.evidenceRefs)}`, "");
  }
  return lines.join("\n");
}

export function renderNonFunctionalRequirements(doc: RequirementsDocument<NonFunctionalRequirement>): string {
  const lines: string[] = ["# Non-Functional Requirements", ""];
  for (const req of doc.requirements) {
    lines.push(`## ${req.id} (${req.pageId})`, "", req.description, "");
    lines.push(`**Evidence:** ${renderEvidenceRefs(req.evidenceRefs)}`, "");
  }
  return lines.join("\n");
}
