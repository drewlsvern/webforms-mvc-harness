# webforms-runtime-crawler Specification

## Purpose

Uses Playwright to drive the running WebForms application locally and capture runtime evidence per page, supplementing static scan evidence with observed behavior, without using AI.

## Requirements

### Requirement: Per-page runtime capture
For each page it visits, the crawler SHALL capture a DOM snapshot, a screenshot, observed network activity, observed interactions, and the URL the browser actually landed on if different from the page requested.

#### Scenario: Page visited during crawl
- **WHEN** the crawler navigates to a page in the running WebForms application
- **THEN** it records a DOM snapshot, a screenshot, network activity, and any interactions performed on that page as crawl evidence

#### Scenario: Page visit results in a redirect
- **WHEN** the crawler navigates to a page and the browser lands on a different URL than requested
- **THEN** the crawl evidence for that page records the URL it was redirected to

### Requirement: Crawl seeded from static scan
The crawler SHALL use the page inventory produced by the static scanner as its starting route list.

#### Scenario: Crawl starts from scanned pages
- **WHEN** a crawl run begins and static scan evidence already exists
- **THEN** the crawler's initial route list is derived from the pages recorded in that scan evidence

### Requirement: Crawling uses no AI
Runtime crawling SHALL be performed via deterministic browser automation only, without invoking an AI/LLM to decide navigation or interaction.

#### Scenario: Crawl runs without AI calls
- **WHEN** the crawler visits and interacts with pages
- **THEN** it does so without making any AI/LLM request
