## MODIFIED Requirements

### Requirement: Shared components are promoted into a dedicated shared slice
The system SHALL promote any UserControl or Presenter referenced by pages belonging to more than one slice into a dedicated shared slice, and SHALL record that shared slice as a dependency of each slice that references it.

#### Scenario: UserControl referenced by multiple slices is promoted
- **WHEN** a UserControl is referenced by pages that belong to more than one slice
- **THEN** that UserControl is recorded as a member of the shared slice rather than belonging to any one feature slice, and each referencing slice records the shared slice as a dependency

#### Scenario: Presenter reused across slices is promoted
- **WHEN** a Presenter is referenced by pages that belong to more than one slice
- **THEN** that Presenter is recorded as a member of the shared slice rather than belonging to any one feature slice, and each referencing slice records the shared slice as a dependency

### Requirement: Slice list is reviewable and editable at its gate
The system SHALL present the proposed slice list at a gate where a reviewer can merge slices, split a slice, and promote or demote shared components, before the slice list is treated as final.

#### Scenario: Reviewer merges two proposed slices
- **WHEN** a reviewer merges two slices at the slice gate
- **THEN** the resulting slice list records the merged pages as one slice

#### Scenario: Reviewer splits a proposed slice
- **WHEN** a reviewer splits a slice into two at the slice gate
- **THEN** the resulting slice list records two separate slices with the reviewer's chosen page assignment

#### Scenario: Reviewer promotes a component into the shared slice
- **WHEN** a reviewer promotes a UserControl or Presenter that is currently used by only one slice
- **THEN** that component is added to the shared slice, and the referencing slice records the shared slice as a dependency

#### Scenario: Reviewer demotes a component from the shared slice
- **WHEN** a reviewer demotes a component from the shared slice to correct a false-positive match
- **THEN** that component is removed from the shared slice, and every slice's dependency on it is cleared

## ADDED Requirements

### Requirement: Slice requirement references are derived from page membership
The system SHALL populate each slice's requirement references with every functional and non-functional requirement whose page is a member of that slice, computed automatically without manual review.

#### Scenario: Requirement references computed at slice detection
- **WHEN** slice detection runs and functional/non-functional requirements already exist for a page
- **THEN** every requirement whose page is a member of a slice is included in that slice's requirement references

#### Scenario: Requirement references recomputed after merge or split
- **WHEN** slices are merged or split
- **THEN** each resulting slice's requirement references are recomputed from its current page membership rather than copied from its predecessor slice
