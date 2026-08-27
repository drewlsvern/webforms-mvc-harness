## Why

The static scanner never picks up Models used inside a Presenter class — only models referenced directly in a page's own code-behind. In the MVVP pattern this tool is built around, the page's code-behind is deliberately thin (it delegates to the Presenter), while the actual business logic and Model/ViewModel usage lives inside the Presenter — a separate `.cs` file the scanner currently never reads (it only records presenter files as a bare `{id, path}` inventory entry). Scan evidence is meant to be the trustworthy foundation the rest of this pipeline (and eventually a human reviewer, and later an AI conversion step) relies on, so silently missing where the real model usage lives undermines exactly what the scan stage exists to provide.

## What Changes

- Presenter files get their content parsed for the first time. `PresenterEvidence` gains a `modelRefs` field, populated from the presenter's own file.
- A page's `presenterRef` (an interface name, e.g. `IOrderPresenter`) is resolved to its corresponding presenter file (filename-derived id, e.g. `OrderPresenter`), tolerating the interface-to-implementation naming convention.
- Once resolved, a page's own `modelRefs` includes both what its code-behind directly references and what its resolved presenter references.
- Model and Presenter detection prefer declaration/usage-position patterns (field, property, parameter, return type, generic type argument, `new` instantiation) before falling back to a blanket scan — mirroring the two-tier approach `findPresenterRef` already uses.
- Comments and string literals are stripped from C# source before scanning it for Model/Presenter references, for both page code-behind and presenter files.
- Presenter evidence gets a Markdown rendering (paired with its JSON, matching every other evidence type) and a minimal web UI drill-down alongside the existing page browser.

Out of scope: a real C# parser/AST (stays regex/heuristic-based, consistent with the rest of this scanner); wiring `modelRefs` into requirements synthesis or slice detection (it's a pure display field today with no downstream consumers, and this change keeps it that way — it only makes the display accurate).

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `webforms-static-scanner`: presenter files are now parsed for their own evidence (including Models); page-level Models include the resolved presenter's Models; Model/Presenter detection uses declaration-position matching with a fallback, over C# source with comments and string literals stripped first.

## Impact

- Extends `PresenterEvidence` with `modelRefs: string[]`.
- `src/scanner/scan.ts` reads and parses presenter file content instead of only recording their path.
- `src/scanner/parseCodeBehind.ts`: `findModelRefs`/`findPresenterRef` gain declaration-position preference and a comment/string-stripping preprocessing step.
- New presenter Markdown renderer, paired with existing JSON writes (no change to the JSON-is-source-of-truth rule already established in `migration-evidence-store`).
- `src/server/public/views/scan.js` gets a minimal presenter list/detail alongside the existing page browser.
