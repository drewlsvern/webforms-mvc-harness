## MODIFIED Requirements

### Requirement: Per-page runtime capture
For each page it visits, the crawler SHALL capture a DOM snapshot, a screenshot, observed network activity, observed interactions, and the URL the browser actually landed on if different from the page requested.

#### Scenario: Page visited during crawl
- **WHEN** the crawler navigates to a page in the running WebForms application
- **THEN** it records a DOM snapshot, a screenshot, network activity, and any interactions performed on that page as crawl evidence

#### Scenario: Page visit results in a redirect
- **WHEN** the crawler navigates to a page and the browser lands on a different URL than requested
- **THEN** the crawl evidence for that page records the URL it was redirected to
