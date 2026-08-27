# migration-live-progress Specification

## Purpose

Broadcasts live, per-item progress from a running long-running stage to connected web UI clients, so the primary migration tool doesn't leave the user waiting with no feedback during a multi-minute operation like a crawl.

## Requirements

### Requirement: Live progress is streamed during crawl
The system SHALL stream a progress event to connected web UI clients for each page visited during a crawl run, including the page identifier and its result.

#### Scenario: Progress event emitted per page
- **WHEN** the crawler visits a page during a crawl run
- **THEN** a progress event identifying that page and its result (captured, or redirected to another URL) is streamed to connected web UI clients

### Requirement: Overall progress is visible during a running stage
The system SHALL report how many of the total seeded pages have been visited so far during a crawl run.

#### Scenario: Progress count updates as pages are visited
- **WHEN** pages are visited during a crawl run
- **THEN** the reported count of pages visited so far increases accordingly

### Requirement: Redirect is visible in the live feed
When a page visit results in a redirect, the live progress event SHALL include the URL the browser was redirected to.

#### Scenario: Redirect shown in live feed
- **WHEN** a page visit during crawl results in a redirect
- **THEN** the progress event for that page includes the URL it was redirected to

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
