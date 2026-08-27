## 1. C# source preprocessing and declaration-aware detection

- [x] 1.1 Implement a shared comment/string-stripping preprocessor for C# source (line comments, block comments, plain string literals)
- [x] 1.2 Refactor `findModelRefs` to run against the stripped source
- [x] 1.3 Add declaration/usage-position patterns for Model/ViewModel detection (field, property, parameter, return type, generic type argument, `new TypeName(`), tried before the existing blanket scan
- [x] 1.4 Apply the same stripping + declaration-position preference to `findPresenterRef`
- [x] 1.5 Unit tests: comment-only and string-literal-only occurrences are not recorded; declaration-position matches are found without needing the fallback; existing fallback-only cases still match (no regression)

## 2. Presenter file parsing

- [x] 2.1 Add `modelRefs: string[]` to `PresenterEvidence` (src/types/evidence.ts)
- [x] 2.2 In `scan.ts`, read each presenter file's content and run the (stripped, declaration-aware) model scan against it
- [x] 2.3 Write the presenter's `modelRefs` into its scan evidence JSON
- [x] 2.4 Unit test: a presenter file with model usage produces evidence including those models

## 3. Presenter resolution and page-level rollup

- [x] 3.1 Implement presenterRef → presenter-id resolution (strip a leading `I` + uppercase letter, compare against known presenter ids)
- [x] 3.2 In `scan.ts`, after presenters are parsed, resolve each page's `presenterRef` and union the resolved presenter's `modelRefs` into the page's own `modelRefs`
- [x] 3.3 Unit test: a page whose presenter references models not mentioned in the page's own code-behind ends up with those models in its `modelRefs`
- [x] 3.4 Unit test: an unresolvable presenterRef leaves the page's own modelRefs unchanged (no error, no silent wrong match)

## 4. Presenter evidence rendering

- [x] 4.1 Add a Markdown renderer for presenter evidence (mirrors `renderScanPage.ts`'s JSON-source/Markdown-regenerated pattern)
- [x] 4.2 Write presenter evidence via `writeArtifact` (JSON + paired Markdown) instead of the current JSON-only `writeJson`
- [x] 4.3 Web UI: add a minimal presenter list + click-to-view detail alongside the existing page browser in `src/server/public/views/scan.js`

## 5. Integration test

- [x] 5.1 Extend the fixture WebForms app (test/fixtures/webforms-sample) with a presenter file that references a Model type not mentioned in its page's code-behind
- [x] 5.2 Integration test: running scan against the fixture produces presenter evidence with the model, and the corresponding page's `modelRefs` includes it via rollup
