## MODIFIED Requirements

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

## ADDED Requirements

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
