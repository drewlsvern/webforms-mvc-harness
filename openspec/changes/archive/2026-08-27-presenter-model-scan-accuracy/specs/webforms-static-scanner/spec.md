## MODIFIED Requirements

### Requirement: MVVP references captured
The system SHALL record which Presenter, Model, and UserControl(s) each page references. A page's recorded Models SHALL include both models referenced directly in its own code-behind and models referenced by the Presenter file its code-behind's Presenter reference resolves to.

#### Scenario: Presenter and UserControl usage recorded
- **WHEN** a page's code-behind binds to a Presenter class, or its markup includes a UserControl
- **THEN** the scan evidence for that page records the referenced Presenter and UserControl(s)

#### Scenario: Page's models include its resolved presenter's models
- **WHEN** a page's code-behind binds to a Presenter, and that Presenter resolves to an actual presenter file that references one or more Models
- **THEN** those models are included in the page's recorded Models, in addition to any models the page's own code-behind directly references

## ADDED Requirements

### Requirement: Presenter files are parsed for their own evidence
The system SHALL parse each discovered presenter file's content and record the Models it references, not only its file location.

#### Scenario: Presenter evidence includes its models
- **WHEN** a presenter file references one or more Model or ViewModel types
- **THEN** the presenter's scan evidence records those models

### Requirement: Presenter references are resolved to presenter files
The system SHALL resolve a page's recorded Presenter reference to the corresponding presenter file when one exists, tolerating an interface-to-implementation naming difference (a page referencing `IOrderPresenter` resolves to a presenter file `OrderPresenter`).

#### Scenario: Interface-named presenter reference resolves to its file
- **WHEN** a page's code-behind declares a field of an interface-named Presenter type (e.g. `IOrderPresenter`)
- **THEN** that reference resolves to the presenter file whose id matches with the leading `I` removed

### Requirement: Model and Presenter detection prefers declaration and usage positions
The system SHALL identify Model, ViewModel, and Presenter type references first from declaration and usage positions (field, property, parameter, return type, generic type argument, or object instantiation), and SHALL fall back to a broader scan of the source only when no such position is found.

#### Scenario: Declared model type takes precedence
- **WHEN** a Model or ViewModel type appears as a field, property, parameter, return type, generic type argument, or is instantiated with `new`
- **THEN** that occurrence is recorded without requiring a fallback scan

#### Scenario: Fallback scan used when no declaration position is found
- **WHEN** no Model, ViewModel, or Presenter type appears in a declaration or usage position
- **THEN** the system falls back to scanning the source for any matching identifier

### Requirement: Comments and string literals are excluded from code-behind scanning
The system SHALL strip comments and string literal contents from C# source before scanning it for Model, ViewModel, or Presenter references, for both page code-behind and presenter files.

#### Scenario: Reference inside a comment is not recorded
- **WHEN** a Model-suffixed identifier appears only inside a comment
- **THEN** it is not recorded as a Model reference

#### Scenario: Reference inside a string literal is not recorded
- **WHEN** a Model-suffixed identifier appears only inside a string literal
- **THEN** it is not recorded as a Model reference
