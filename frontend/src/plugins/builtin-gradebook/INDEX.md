<!-- ⚠️ Once this folder changes, update me. -->

`builtin-gradebook/` provides the course-scoped grade planning tab and read-only summary widget.
The tab now opens with a table-first assessment workspace, explicit target saves, and setup tabs for scenarios/categories.
Shared helpers now derive projections, validation, and deadline summaries on the client from fact-only gradebook API responses.

| File | Role | Description |
|------|------|-------------|
| INDEX.md | Architecture index | Local architecture summary and file map for the builtin-gradebook plugin. |
| index.ts | Runtime entry | Registers the builtin-gradebook tab and summary widget with the plugin runtime loader. |
| metadata.ts | Plugin metadata | Declares the course builtin tab and summary widget catalog entries. |
| shared.ts | Shared helpers | Exposes plugin constants, view-state defaults, client-side projection/validation calculators, and shared formatters. |
| tab.tsx | Tab runtime | Renders the streamlined gradebook command center with a table-first assessment list, summary cards, and setup tabs. |
| widget.tsx | Widget runtime | Renders the summary widget from client-derived baseline projection, progress coverage, and upcoming deadlines. |
| shared.test.ts | Test file | Covers shared gradebook settings normalization, scenario selection, and client-side summary math. |
| widget.test.tsx | Test file | Covers summary widget rendering against fact-only gradebook payloads and open-tab event dispatch. |
