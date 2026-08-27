## Purpose

Provides the shared local artifact store and gate mechanism that every discovery stage (scan, crawl, requirements synthesis, slice detection) reads from and writes to, keeping migration evidence structured, reviewable, and safe for downstream stages to consume.

## ADDED Requirements

### Requirement: JSON is the sole source of truth
The system SHALL persist every stage's output as JSON files. Any Markdown rendering of an artifact SHALL be regenerated from that artifact's JSON content and SHALL NOT be hand-authored or treated as authoritative.

#### Scenario: Markdown regenerated after JSON changes
- **WHEN** a stage writes or updates a JSON evidence file
- **THEN** the corresponding Markdown file for that artifact is regenerated from the current JSON content

#### Scenario: Direct Markdown edits are not persisted as evidence
- **WHEN** a user edits a generated Markdown file directly
- **THEN** the system does not treat that edit as a change to the underlying evidence, and the file is overwritten the next time it is regenerated

### Requirement: A gate blocks progression until reviewed
Each pipeline stage that produces evidence (scan, crawl, requirements synthesis, slice detection) SHALL create a pending gate record when it completes, and the pipeline SHALL NOT begin the next stage until that gate is approved.

#### Scenario: Stage completes and awaits review
- **WHEN** a stage finishes producing evidence
- **THEN** a gate record for that stage is created with status "pending" and the next stage does not start

#### Scenario: Approved gate unblocks the next stage
- **WHEN** a reviewer approves a pending gate
- **THEN** the next stage in the pipeline becomes eligible to run

### Requirement: Gate edits are structured field edits only
A reviewer modifying evidence at a gate SHALL apply the edit to specific fields of the underlying JSON artifact. The system SHALL NOT accept freeform edits made directly to a regenerated Markdown view as a way of changing evidence.

#### Scenario: Reviewer edits a structured field
- **WHEN** a reviewer changes a specific field of an evidence artifact through the gate review interface
- **THEN** the change is written to the artifact's JSON and the artifact's Markdown view is regenerated to reflect it

### Requirement: Gate records reference the approved artifact version
When a gate is approved, the system SHALL record which artifact (and its content hash) was approved at that gate.

#### Scenario: Gate approval captures artifact hash
- **WHEN** a reviewer approves a gate for a given stage's evidence
- **THEN** the gate record stores the content hash of the evidence artifact that was approved

### Requirement: Rejection halts progression with a comment
A reviewer SHALL be able to reject a stage's evidence at its gate with a comment. A rejected gate SHALL NOT unblock the next stage until it is re-approved.

#### Scenario: Reviewer rejects evidence
- **WHEN** a reviewer rejects a pending gate and provides a comment
- **THEN** the gate status is recorded as "rejected" with that comment, and the next stage remains blocked
