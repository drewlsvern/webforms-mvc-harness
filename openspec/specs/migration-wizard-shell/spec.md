# migration-wizard-shell Specification

## Purpose

Provides the interactive CLI and web UI layer that lets a human drive the discovery pipeline, review evidence at each gate, and edit the proposed slice list, without calling the underlying engine directly.

## Requirements

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

### Requirement: Status strip shows pipeline progress as cards
The web UI SHALL display a horizontal strip of numbered status cards across Scan, Crawl, Requirements, Slices, and Select, each showing the step's title, a one-line status detail, and one of five states: complete, active, error, warning, or pending.

#### Scenario: Card reflects current gate status
- **WHEN** a gate's status changes
- **THEN** that stage's card updates to reflect the new state

#### Scenario: Paused crawl shows the warning state
- **WHEN** a crawl is paused awaiting re-authentication
- **THEN** the Crawl card shows the warning state, distinct from both its active and error states

#### Scenario: Clicking a card navigates to that step
- **WHEN** a user clicks a step's card
- **THEN** the left column navigates to that step

#### Scenario: Headline count reflects completed gated stages
- **WHEN** one or more of Scan, Crawl, Requirements, or Slices has its gate approved
- **THEN** the headline "X of Y steps complete" count reflects the number of those four stages with an approved gate

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

### Requirement: Left column toggles between step list and step detail
The left column SHALL display a compact list of steps with inline actions by default, and SHALL replace that list in place with a step's full detail view when the user navigates into it, providing a way to return to the list.

#### Scenario: Navigating into a step's detail
- **WHEN** a user opens a step from the compact list
- **THEN** the left column shows that step's full detail view in place of the list, with a control to return to the list

#### Scenario: Detail view does not obscure the console
- **WHEN** a step's detail view is open in the left column
- **THEN** the right column's console and history remain visible

### Requirement: Console panel shows live progress for the relevant stage
The right column SHALL display a console panel showing progress output for whichever stage is currently running, or most recently ran if none is currently running.

#### Scenario: Console updates while a stage runs
- **WHEN** a stage is running
- **THEN** the console panel displays that stage's progress events as they arrive

### Requirement: History panel is present as a placeholder
The right column SHALL display a history panel below the console. Until durable task-history persistence exists, it SHALL render an empty state rather than fabricated or partial data.

#### Scenario: History panel with no persisted history
- **WHEN** no task-history persistence is available
- **THEN** the history panel shows an empty state rather than fabricating entries
