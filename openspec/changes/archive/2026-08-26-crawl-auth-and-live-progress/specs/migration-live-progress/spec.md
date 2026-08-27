## Purpose

Broadcasts live, per-item progress from a running long-running stage to connected web UI clients, so the primary migration tool doesn't leave the user waiting with no feedback during a multi-minute operation like a crawl.

## ADDED Requirements

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
