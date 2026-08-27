## Context

The static scanner (`src/scanner/`, from the archived `migration-discovery-and-slicing` change) currently treats presenter files as an inventory-only artifact — discovered by filename pattern, recorded as `{id, path}`, never opened. Model detection (`findModelRefs` in `parseCodeBehind.ts`) only runs against a page's own code-behind. In MVVP, that's exactly backwards from where the real model usage lives: the page's code-behind is thin by design, and the Presenter is where business logic (and therefore Model/ViewModel references) actually happens. This was found by using the tool against a real app, not the project's own fixture (whose presenters are trivial stubs with no model usage, which is why the gap wasn't caught earlier).

`modelRefs` today is a pure display field — see the trace done during exploration: nothing in `src/requirements/` or `src/slices/` reads it. This change is scoped to making that display accurate; it does not change what `modelRefs` is used for.

## Goals / Non-Goals

**Goals:**
- Presenter files contribute real evidence (their own Models), not just an inventory entry.
- A page's displayed Models reflect what its Presenter actually does, not just its own thin code-behind.
- Reduce false positives in Model/Presenter detection without adopting a real parser.

**Non-Goals:**
- A real C# parser/tokenizer/AST. Explicitly considered and rejected — this scanner has been regex/heuristic-based everywhere else, with the gate review as the safety net for what it misses; introducing a parser here would be inconsistent with that established approach for a comparatively small accuracy gain.
- Making `modelRefs` influence requirements synthesis or slice detection. It stays a display-only field; wiring it into downstream logic is a separate decision for a separate change if it ever comes up.
- A full presenter browsing screen in the web UI. The page-level rollup covers the common case; the presenter view added here is minimal, for completeness (shared presenters, or presenters not yet resolved from any page).

## Decisions

### Presenter → page resolution: strip a leading `I`, nothing fancier

`findPresenterRef` already prefers an interface-named field (`IOrderPresenter`) when scanning a page's code-behind. Presenter inventory ids are filename-derived (`OrderPresenter.cs` → `OrderPresenter`). Resolution is: if the presenterRef starts with `I` followed by an uppercase letter, strip it and compare (case-sensitive) against known presenter ids; otherwise compare directly. This mirrors the same "good enough, human gate catches the rest" tolerance the slice-detection design already accepted for its own string-based component matching — no namespace awareness, no guarantee against two unrelated presenters colliding under the same stripped name.

**Alternative considered:** match by convention on the concrete class implementing the interface (would require actually parsing interface/class relationships). Rejected as real parsing, not a heuristic.

### Declaration-position detection: a short list of patterns, tried in order, with the existing blanket scan as the last resort

Rather than one new "correct" pattern, this is several narrow patterns (field/property declaration, parameter, return type, generic type argument, `new TypeName(`) tried against the (comment/string-stripped) source, in a defined order, with the current loose `\b(\w+(?:ViewModel|Model))\b` scan kept as the final fallback so nothing that was found before is now missed — this change is additive to detection quality, not a narrowing that could regress existing true positives into false negatives.

### Comment/string stripping is a shared preprocessing step, applied before any C# scanning

One function, used by both page code-behind and presenter file parsing, run once before `findModelRefs`/`findPresenterRef`. It's line-comment (`//`), block-comment (`/* */`), and string-literal (`"..."`) aware via regex — not verbatim (`@"..."`) or interpolated (`$"..."`) string aware, which is an accepted gap (see Risks).

### Presenter evidence gets the same JSON+Markdown pairing every other evidence type already has

No new pattern invented — `writeArtifact` (JSON source of truth, Markdown regenerated) already exists and is used for pages, crawl runs, requirements, and slices. Presenters were the one evidence type that never got it; this closes that gap rather than inventing a different mechanism for presenters specifically.

## Risks / Trade-offs

- **[Risk]** Regex-based comment/string stripping doesn't handle verbatim (`@"..."`) or interpolated (`$"..."`) string literals, so a Model-suffixed identifier inside one of those could still be misrecorded → **Mitigation:** accepted; these are less common than plain string literals for the kind of content (SQL fragments, log messages, redirect URLs) most likely to trigger false positives, and the scan gate remains the place a reviewer corrects what slips through.
- **[Risk]** The `I`-prefix resolution heuristic can misfire if a presenter interface and its concrete class don't follow the strip-the-`I` convention, or if two unrelated presenters collide under the same stripped name → **Mitigation:** same accepted trade-off already made for shared-component matching elsewhere in this project; a failed resolution just means the page-level rollup doesn't happen for that page (the presenter's own evidence is still correct and visible), not a wrong result being silently asserted.
- **[Risk]** Declaration-position patterns are still regex, not real parsing, so unusual code formatting (e.g. multi-line declarations) could fall through to the blanket fallback rather than the precise match → **Mitigation:** the fallback still runs, so nothing regresses versus today's behavior — it only means some cases don't get the more precise treatment yet.
