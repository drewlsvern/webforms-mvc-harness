## Context

This change extends the crawler (`src/crawler/`) built in the archived `migration-discovery-and-slicing` change and the web server/UI shell built in the companion `migration-wizard-and-slice-selection` change. See that change's proposal for why the web UI is the primary interface — that's why live progress and the auth flow are being built as web UI features rather than CLI-first.

## Goals / Non-Goals

**Goals:**
- Get past an unknown login flow (forms auth, SSO, MFA — anything) without the tool needing to understand it.
- Make a multi-minute crawl visible while it runs, not just at the end.
- Detect session expiry from evidence the crawler already produces (the URL it landed on), not a new heuristic.

**Non-Goals:**
- Scripted/credential-based login (filling a username/password form automatically). Rejected — see Decisions.
- An embedded live browser view inside the web UI (CDP screencasting). A separate OS browser window is simpler and sufficient.
- General-purpose SSE infrastructure for every stage. This change wires SSE for crawl specifically; other stages can adopt the same mechanism later if they turn out to need it, but scan/requirements/slices are fast enough today that they don't.

## Decisions

### Authentication is a human clicking through a real browser window, not a scripted login

The server launches a headed (visible) Playwright browser pointed at the app's login page. The user logs in themselves — however that works for their app. When they confirm ("I'm logged in"), the server captures `context.storageState()` from that browser and persists it to `.migration/crawl/auth-state.json`. All subsequent crawl page-visits run in a separate, headless browser context restored from that state.

**Alternative considered:** automate the login (fill known field selectors, submit). Rejected because a WebForms login page's shape is unknown ahead of time and could involve MFA/SSO/CAPTCHA the tool has no business trying to handle; it would also require the tool to hold credentials somewhere. A human clicking through their own login, once, is strictly simpler and works regardless of what that login involves.

### Session expiry is detected by URL, not by response content

The authentication flow's starting URL (the login page) is recorded alongside the captured session. During crawl, if a page visit's landed URL matches that recorded login URL, the session is treated as expired. This reuses data already being captured (the same requested-vs-landed URL tracking added to `CrawlRunEvidence` in this change) rather than adding content-sniffing ("does this page look like a login form?") which would be far less reliable across arbitrary WebForms login page designs.

**Alternative considered:** detect expiry by HTTP status (e.g. 401/403). Rejected because ASP.NET forms authentication typically redirects to the login page with a 200, not an auth-failure status code — the redirect *is* the signal.

### SSE, one connection per crawl run, server holds no client-specific state

The server emits progress events on an SSE stream tied to the currently running crawl. Since only one crawl can run at a time (a stage doesn't start until its predecessor's gate is approved, and nothing in this change introduces concurrent crawls), there's no need to track progress per-client — the server just broadcasts to whoever's connected. A client reconnecting mid-crawl misses earlier events but picks up the live feed from that point; the crawl's own evidence files remain the source of truth for anything that needs to be complete after the fact.

### CLI and authentication

Authentication fundamentally needs a visible browser and a human — there's no headless equivalent. The CLI can still trigger a crawl (`migrate crawl`), but if no valid `auth-state.json` exists, it reports that authentication must be completed first via the web UI, rather than trying to launch its own browser window from a terminal session. This is a real, accepted asymmetry between the two clients, not an oversight: authentication is one of the few actions that's necessarily web-UI-only given the "primary tool" decision in the companion change.

## Risks / Trade-offs

- **[Risk]** A false-positive expiry detection if the app's real login URL happens to also be a legitimate destination for some other reason → **Mitigation:** unlikely for ASP.NET forms auth (the login page is not normally a valid post-auth destination), and if it happens, the pause-and-prompt behavior is a safe failure mode (worst case: an unnecessary re-auth prompt), not a silent one.
- **[Risk]** A long crawl held open over SSE could disconnect on a flaky network, losing live updates for the rest of the run → **Mitigation:** the run continues server-side regardless of SSE connection state (progress isn't gated on a client being connected); reconnecting resumes seeing new events, and final evidence is always readable from the store regardless of what was seen live.
