## ADDED Requirements

### Requirement: Non-crawl stages report a start and completion summary
The system SHALL emit a "started" event when Scan, Requirements, or Slices begins, and a single summary event when it completes, without per-item streaming.

#### Scenario: Scan summary reports discovered counts
- **WHEN** scan completes
- **THEN** the summary event includes the number of pages, controls, and presenters found

#### Scenario: Requirements summary reports generated counts
- **WHEN** requirements synthesis completes
- **THEN** the summary event includes the number of functional and non-functional requirements generated

#### Scenario: Slices summary reports detected counts
- **WHEN** slice detection completes
- **THEN** the summary event includes the number of slices detected and whether a shared slice was created

#### Scenario: Crawl's per-page feed is unaffected
- **WHEN** a crawl runs
- **THEN** progress continues to stream per page as already specified, not collapsed into a single summary event
