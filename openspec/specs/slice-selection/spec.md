# slice-selection Specification

## Purpose

Lets a reviewer choose exactly one ready slice per round to work on next, computing which slices are locked or ready from their dependency on the shared slice.

## Requirements

### Requirement: Slice readiness is computed from shared-slice status
A slice that depends on the shared slice SHALL be `locked` until the shared slice's status is `done`; otherwise it SHALL be `ready`, unless it has already been selected or completed.

#### Scenario: Slice locked pending shared slice
- **WHEN** a slice depends on the shared slice and the shared slice's status is not `done`
- **THEN** that slice is reported as `locked` and is not selectable

#### Scenario: Slice ready once shared slice is done
- **WHEN** a slice depends on the shared slice and the shared slice's status is `done`, or the slice has no shared-slice dependency
- **THEN** that slice is reported as `ready`

### Requirement: Exactly one ready slice may be selected per round
The system SHALL allow a reviewer to select exactly one `ready` slice per round, and SHALL record that selection by setting the slice's status to `selected`.

#### Scenario: Selecting a ready slice
- **WHEN** a reviewer selects a slice that is currently `ready`
- **THEN** that slice's status becomes `selected`

#### Scenario: Locked slice cannot be selected
- **WHEN** a reviewer attempts to select a slice that is currently `locked`
- **THEN** the selection is rejected and the slice's status does not change

#### Scenario: Only one slice selected at a time
- **WHEN** a reviewer attempts to select a second slice while another slice's status is already `selected`
- **THEN** the selection is rejected until the previously selected slice's status is no longer `selected`

### Requirement: Slice status defaults to not started
Slice detection SHALL initialize every slice's status to `not_started`.

#### Scenario: New slice starts as not started
- **WHEN** slice detection produces a new slice
- **THEN** that slice's status is `not_started`
