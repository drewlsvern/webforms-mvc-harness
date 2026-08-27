export type Stage = "scan" | "crawl" | "requirements" | "slices";

export type GateStatus = "pending" | "approved" | "rejected";

export interface GateRecord {
  stage: Stage;
  status: GateStatus;
  artifactHash: string | null;
  reviewedBy: string | null;
  comment: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

export interface RunState {
  currentStage: Stage | "done";
  gates: Partial<Record<Stage, GateStatus>>;
  updatedAt: string;
}

export type NavigationEdgeKind = "postbackUrl" | "redirectOrTransfer" | "contentLink";

export interface NavigationEdge {
  kind: NavigationEdgeKind;
  targetPage: string;
  sourceLocation?: string;
}

export interface ControlReference {
  id: string;
  type: string;
}

export interface PageScanEvidence {
  pageId: string;
  path: string;
  codeBehindPath: string | null;
  masterPage: string | null;
  controls: ControlReference[];
  navigationEdges: NavigationEdge[];
  presenterRef: string | null;
  modelRefs: string[];
  userControlRefs: string[];
}

export interface UserControlEvidence {
  id: string;
  path: string;
}

export interface PresenterEvidence {
  id: string;
  path: string;
  modelRefs: string[];
}

export interface ScanIndex {
  pages: string[];
  controls: string[];
  presenters: string[];
  generatedAt: string;
}

export interface NetworkEntry {
  url: string;
  method: string;
  status: number | null;
}

export interface InteractionRecord {
  type: string;
  selector?: string;
  description: string;
}

export interface CrawlRunEvidence {
  pageId: string;
  runId: string;
  timestamp: string;
  domPath: string;
  screenshotPath: string;
  network: NetworkEntry[];
  interactions: InteractionRecord[];
  /** URL the browser actually landed on, if different from the page requested (a redirect, or an expired-session bounce to login). */
  redirectedTo: string | null;
}

export interface CrawlIndex {
  pages: Record<string, string[]>;
  generatedAt: string;
}

export type EvidenceKind = "scan" | "crawl";

export interface EvidenceRef {
  kind: EvidenceKind;
  path: string;
}

export interface FunctionalRequirement {
  id: string;
  pageId: string;
  description: string;
  evidenceRefs: EvidenceRef[];
}

export interface NonFunctionalRequirement {
  id: string;
  pageId: string;
  description: string;
  evidenceRefs: EvidenceRef[];
}

export interface RequirementsDocument<T> {
  requirements: T[];
  generatedAt: string;
}

export type SharedComponentKind = "userControl" | "presenter";

export interface SharedComponentRef {
  kind: SharedComponentKind;
  id: string;
}

export type SliceStatus = "not_started" | "selected" | "done";

/** A slice's dependency on another slice (in practice, the shared slice), and which components caused it. */
export interface SliceDependency {
  sliceId: string;
  components: SharedComponentRef[];
}

export interface SliceEvidence {
  id: string;
  pages: string[];
  /** Populated only on the shared slice: the UserControls/Presenters it holds. Empty on feature slices. */
  componentRefs: SharedComponentRef[];
  dependsOn: SliceDependency[];
  requirementRefs: string[];
  status: SliceStatus;
}

export interface SliceIndex {
  slices: string[];
  sharedSliceId: string | null;
  generatedAt: string;
}
