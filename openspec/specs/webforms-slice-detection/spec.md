# webforms-slice-detection Specification

## Purpose

Groups WebForms pages into convertible, feature-sized slices using a locally-computed page graph, and identifies components shared across slices, without using AI.

## Requirements

### Requirement: Page graph built from navigation edges
The system SHALL build a graph whose nodes are the pages recorded in scan evidence and whose edges are the navigation edges recorded for those pages: `PostBackUrl` targets, `Response.Redirect`/`Server.Transfer` targets from postback handlers, and content-area hyperlinks.

#### Scenario: Graph constructed from scan evidence
- **WHEN** slice detection runs against completed scan evidence
- **THEN** a page graph is built using every navigation edge recorded in that scan evidence

### Requirement: A slice is a connected component of the page graph
The system SHALL compute each slice as one connected component of the page graph, treating navigation edges as undirected for the purpose of grouping.

#### Scenario: Pages linked by navigation form one slice
- **WHEN** two pages are connected, directly or transitively, by navigation edges in the page graph
- **THEN** both pages are assigned to the same slice

#### Scenario: Unconnected page forms its own slice
- **WHEN** a page has no navigation edges connecting it to any other page
- **THEN** that page is assigned to a slice containing only itself

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

### Requirement: Slice requirement references are derived from page membership
The system SHALL populate each slice's requirement references with every functional and non-functional requirement whose page is a member of that slice, computed automatically without manual review.

#### Scenario: Requirement references computed at slice detection
- **WHEN** slice detection runs and functional/non-functional requirements already exist for a page
- **THEN** every requirement whose page is a member of a slice is included in that slice's requirement references

#### Scenario: Requirement references recomputed after merge or split
- **WHEN** slices are merged or split
- **THEN** each resulting slice's requirement references are recomputed from its current page membership rather than copied from its predecessor slice

### Requirement: Slice detection uses no AI
Slice detection SHALL be computed via deterministic graph analysis only, without invoking an AI/LLM.

#### Scenario: Slice detection runs without AI calls
- **WHEN** the system computes the proposed slice list from scan evidence
- **THEN** it does so without making any AI/LLM request
