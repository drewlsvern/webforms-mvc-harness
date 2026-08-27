## Purpose

Provides an interactive login flow that captures an authenticated session for the WebForms application under migration, persists it for reuse across crawl runs, and detects when that session has expired mid-crawl.

## ADDED Requirements

### Requirement: Interactive headed-browser authentication
The system SHALL launch a visible browser window for the user to log into the WebForms application, and SHALL capture the resulting session state once the user confirms they are logged in.

#### Scenario: User completes login and confirms
- **WHEN** a user completes login in the launched browser window and confirms they are logged in
- **THEN** the system captures the browser's session state (cookies and storage) as the authenticated session

### Requirement: Authenticated session is persisted and reused
The captured session SHALL be persisted to the evidence store and reused by subsequent crawl runs without requiring the user to log in again.

#### Scenario: Crawl reuses a persisted session
- **WHEN** a crawl run starts and a persisted authenticated session exists
- **THEN** the crawler uses that session rather than prompting for authentication again

### Requirement: Crawl requires a valid authenticated session before starting
The system SHALL NOT begin crawling pages until a valid authenticated session exists.

#### Scenario: Crawl blocked with no session
- **WHEN** a crawl run is started and no authenticated session has been captured
- **THEN** the crawl does not start, and the user is prompted to authenticate first

### Requirement: Mid-crawl session expiry pauses the crawl
The system SHALL detect when a page visit during crawl lands on the same URL the authentication flow started from, treat this as an expired session, and pause the crawl pending re-authentication rather than continuing to visit further pages.

#### Scenario: Session expires mid-crawl
- **WHEN** a page visit during crawl lands on the login URL captured during authentication
- **THEN** the crawl pauses, no further pages are visited, and the user is prompted to re-authenticate

#### Scenario: Crawl resumes after re-authentication
- **WHEN** the user re-authenticates after a paused crawl
- **THEN** the crawl resumes from the page it was on when it paused
