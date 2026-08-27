# webforms-static-scanner Specification

## Purpose

Locally parses WebForms markup and code-behind to produce structured, reviewable scan evidence of each page's controls, navigation wiring, and MVVP references, without using AI.

## Requirements

### Requirement: Page inventory
The system SHALL scan the WebForms source tree and produce one scan evidence record per `.aspx` page found, including its Master Page, the controls it uses, and its code-behind file.

#### Scenario: Page discovered during scan
- **WHEN** the scanner processes a WebForms source tree containing an `.aspx` file
- **THEN** a scan evidence record is produced for that page listing its Master Page, controls, and code-behind file

### Requirement: Navigation edges captured
For each page, the system SHALL record: any `PostBackUrl` cross-page posting target, any `Response.Redirect` or `Server.Transfer` call made from inside a postback/event handler in the code-behind, and any hyperlink found within that page's own `<asp:Content>` block. Links rendered by a shared Master Page SHALL be excluded from this capture.

#### Scenario: Content-area hyperlink recorded
- **WHEN** a page's `<asp:Content>` block contains a hyperlink to another page
- **THEN** that hyperlink is recorded as a navigation edge from the source page to the target page

#### Scenario: Master Page navigation excluded
- **WHEN** a link to another page is rendered by the shared Master Page rather than by the content page itself
- **THEN** that link is not recorded as a navigation edge for the content page

#### Scenario: Cross-page postback recorded
- **WHEN** a control on a page has a `PostBackUrl` targeting another page, or an event handler calls `Response.Redirect`/`Server.Transfer` to another page
- **THEN** that target is recorded as a navigation edge from the source page to the target page

### Requirement: MVVP references captured
The system SHALL record which Presenter, Model, and UserControl(s) each page references.

#### Scenario: Presenter and UserControl usage recorded
- **WHEN** a page's code-behind binds to a Presenter class, or its markup includes a UserControl
- **THEN** the scan evidence for that page records the referenced Presenter and UserControl(s)

### Requirement: Scanning uses no AI
Scanning SHALL be performed using deterministic static analysis of markup and code-behind only, without invoking an AI/LLM.

#### Scenario: Scan runs without AI calls
- **WHEN** the static scanner processes the WebForms source tree
- **THEN** it produces scan evidence without making any AI/LLM request
