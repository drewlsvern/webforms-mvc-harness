## Purpose

Provides the interactive CLI and web UI layer that lets a human drive the discovery pipeline, review evidence at each gate, and edit the proposed slice list, without calling the underlying engine directly.

## ADDED Requirements

### Requirement: CLI runs the pipeline in-process
The system SHALL provide a CLI that runs pipeline stages and gate actions by invoking the discovery engine directly, without requiring a separate server process.

#### Scenario: CLI runs a stage
- **WHEN** a user runs a stage command from the CLI
- **THEN** the corresponding pipeline stage executes in-process and its evidence is written to the shared `.migration/` store

#### Scenario: CLI approves or rejects a gate via flags
- **WHEN** a user runs a gate command with an approve or reject flag
- **THEN** the corresponding gate is approved or rejected accordingly, without an interactive prompt

### Requirement: Web UI is the primary migration interface
The system SHALL provide a local web server, built on the same discovery engine as the CLI, serving a web UI intended as the primary way to run a migration.

#### Scenario: Web UI and CLI share the same evidence store
- **WHEN** a stage is run or a gate is approved from either the CLI or the web UI
- **THEN** the change is reflected in the shared `.migration/` store and is visible from the other interface

### Requirement: Persistent stepper shows pipeline progress
The web UI SHALL display a persistent stepper across Scan, Crawl, Requirements, Slices, and Select, showing the gate status of each stage.

#### Scenario: Stepper reflects current gate statuses
- **WHEN** a gate's status changes
- **THEN** the stepper updates to reflect the new status for that stage

### Requirement: Artifact browsing is unrestricted by pipeline position
A user SHALL be able to view the evidence produced by any already-completed stage regardless of which stage the pipeline is currently on.

#### Scenario: Viewing an earlier stage's evidence while on a later stage
- **WHEN** a user is on the Select stage and requests to view scan evidence
- **THEN** the scan evidence is displayed, even though scan is not the current stage

### Requirement: Pipeline-advancing actions are gated by run state
The system SHALL only permit running the next stage, approving or rejecting a gate, or selecting a slice when the current `run.json` state allows that action.

#### Scenario: Blocked action is rejected
- **WHEN** a user attempts to run a stage whose predecessor gate is not approved
- **THEN** the action is rejected and the pipeline state does not change

### Requirement: Only the slice gate exposes structured editing
The scan, crawl, and requirements gates SHALL only support approve and reject-with-comment actions. Only the slice gate SHALL expose structured editing (merge, split, move pages, promote, demote).

#### Scenario: No field-level editing at the scan gate
- **WHEN** a user is reviewing the scan gate
- **THEN** the only available actions are approve and reject-with-comment

#### Scenario: Structured editing available at the slice gate
- **WHEN** a user is reviewing the slice gate
- **THEN** merge, split, move-pages, promote, and demote actions are available in addition to approve and reject-with-comment

### Requirement: Moving pages between slices is a single action
The system SHALL allow a reviewer to move one or more pages from one slice to another as a single action, regardless of whether the move is implemented as a merge, a split, or a combination of the two.

#### Scenario: Moving all pages out of a slice
- **WHEN** a reviewer moves every page belonging to a slice into another slice
- **THEN** the source slice no longer exists and its pages become part of the target slice

#### Scenario: Moving some pages out of a slice
- **WHEN** a reviewer moves a subset of a slice's pages into another slice
- **THEN** the source slice retains its remaining pages, and the moved pages become part of the target slice
