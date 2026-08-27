## Why

The runtime crawler can't currently get past a login page — `CrawlConfig.storageStatePath` assumes an authenticated session already exists on disk, but nothing produces one. And because crawling a real app runs sequentially and can take minutes, running it blind (no feedback until it finishes, or fails) is a poor experience for what the wizard shell change establishes as the primary migration tool. This change adds the missing authentication step and live, per-page progress visibility, including detecting when a session has silently expired mid-crawl.

## What Changes

- Add an interactive authentication flow: launch a real, visible (headed) browser window pointed at the WebForms app's login page, let the user log in themselves however their app's login works, capture the resulting session (`storageState`) once they confirm they're logged in, and persist it to `.migration/crawl/auth-state.json` for reuse by subsequent headless crawl runs.
- Add mid-crawl session-expiry detection: if a page visit lands on the same URL the authentication flow started from (the login page), the crawl SHALL pause and prompt for re-authentication rather than continuing to capture pages that are actually just the login screen.
- Add redirect tracking to per-page crawl evidence: record the originally requested page id alongside the URL the browser actually landed on, so a genuine app-level redirect (not just session expiry) is visible in evidence.
- Add SSE-based live progress streaming from the server to the web UI during crawl: which page is currently being visited, its result (captured / redirected-to X), and overall progress (N of M pages).

## Capabilities

### New Capabilities
- `webforms-crawl-authentication`: the interactive headed-browser login flow, session capture/persistence/reuse, and mid-crawl session-expiry detection with pause-for-re-auth.
- `migration-live-progress`: SSE-based live progress broadcasting from a running stage to connected web UI clients, starting with crawl.

### Modified Capabilities
- `webforms-runtime-crawler`: per-page capture now includes the requested-vs-landed URL (redirect target); the crawler requires a valid authenticated session before starting, and a mid-crawl session-expiry pauses rather than continuing to crawl blind.

## Impact

- Extends `CrawlRunEvidence` with a `redirectedTo: string | null` field.
- Extends `crawl.ts`'s orchestrator to require/refresh an auth-state file before starting, and to detect a landed-on-login-page condition per page visit.
- Adds a new auth-flow module launching and coordinating a headed Playwright browser separate from the (headless) crawl browser.
- Extends the web server (from the `migration-wizard-and-slice-selection` change) with an SSE endpoint and the crawl stage's screen with a live per-page feed and an "Authenticate" action.
- No changes to the CLI's non-interactive scriptability are implied here beyond what's needed to trigger authentication headlessly-impossible — authentication inherently needs a visible browser and a human, so the CLI path for crawl either requires a prior web-UI-driven authentication or documents that limitation (see design.md).
