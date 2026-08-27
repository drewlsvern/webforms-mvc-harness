## 1. Crawl evidence: redirect tracking

- [x] 1.1 Extend `CrawlRunEvidence` with `redirectedTo: string | null`
- [x] 1.2 Update `capture.ts` to compare the requested URL against the landed URL (Playwright navigation response) and populate `redirectedTo`
- [x] 1.3 Update `renderCrawlRun.ts` to show the redirect target when present

## 2. Authentication flow

- [x] 2.1 Implement `launchAuthSession(loginUrl)`: opens a headed Playwright browser context at the login URL
- [x] 2.2 Implement session capture: on user confirmation, call `context.storageState()` and persist to `.migration/crawl/auth-state.json` along with the recorded login URL
- [x] 2.3 Implement `loadAuthState(store)`: reads the persisted state file, returns null if absent
- [x] 2.4 Wire `runCrawl`/`runCrawlStage` to require a valid auth state before starting; fail fast with a clear error if none exists
- [x] 2.5 Unit test: capturing and reloading a storageState round-trips correctly

## 3. Mid-crawl session-expiry detection

- [x] 3.1 Compare each page visit's landed URL against the recorded login URL from auth-state.json
- [x] 3.2 On match, pause the crawl (stop visiting further pages), mark the crawl run's status as "awaiting re-authentication", and leave already-captured pages' evidence intact
- [x] 3.3 Implement resume: after successful re-authentication, continue the crawl from the next un-visited seeded page
- [x] 3.4 Integration test: simulate an expired-session redirect mid-crawl, verify pause and correct resume point

## 4. SSE live progress

- [x] 4.1 Add an SSE endpoint on the web server for the currently running crawl
- [x] 4.2 Emit a progress event per page visit (page id, result, redirect target if any, running count / total)
- [x] 4.3 Emit a distinct event on pause-for-re-authentication and on crawl completion
- [x] 4.4 Verify the crawl itself is unaffected by SSE client connect/disconnect (progress isn't gated on a listener being present)

## 5. Web UI

- [x] 5.1 Build the "Authenticate" action on the crawl stage screen (launches the headed browser flow, shows an "I'm logged in" confirmation control)
- [x] 5.2 Build the live per-page feed component (subscribes to the SSE endpoint, renders navigating/captured/redirected rows and overall progress)
- [x] 5.3 Build the "session expired, please re-authenticate" prompt triggered by the pause event
- [x] 5.4 Disable "Start Crawl" until a valid auth state exists

## 6. CLI

- [x] 6.1 `migrate crawl` reports a clear "authenticate via the web UI first" message when no valid auth state exists, rather than attempting to launch a browser from the terminal session
