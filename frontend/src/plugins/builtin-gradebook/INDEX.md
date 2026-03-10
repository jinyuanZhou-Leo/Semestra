<!-- ⚠️ Once this folder changes, update me. -->

`builtin-gradebook/` provides the course-scoped grade planning tab and read-only summary widget.
The tab now behaves like a grade-planning command center with scenario cards, explicit target saves, a Program Homepage-style searchable/sortable assessment table, and setup tabs for scenarios/categories.
Shared helpers keep gradebook constants, view settings, formatting, and API mutations consistent across the tab and summary widget surfaces.

| File | Role | Description |
|------|------|-------------|
| INDEX.md | Architecture index | Local architecture summary and file map for the builtin-gradebook plugin. |
| index.ts | Runtime entry | Registers the builtin-gradebook tab and summary widget with the plugin runtime loader. |
| metadata.ts | Plugin metadata | Declares the course builtin tab and summary widget catalog entries. |
| shared.ts | Shared helpers | Exposes plugin constants, view-state defaults, and gradebook formatting/selectors. |
| tab.tsx | Tab runtime | Renders the streamlined gradebook command center with scenario overview cards, searchable/sortable assessments, right-rail triage, and setup tabs. |
| widget.tsx | Widget runtime | Renders the refreshed summary widget with baseline projection, progress coverage, and upcoming deadlines. |
| shared.test.ts | Test file | Covers shared gradebook settings normalization and scenario selection helpers. |
| widget.test.tsx | Test file | Covers summary widget rendering and open-tab event dispatch. |
