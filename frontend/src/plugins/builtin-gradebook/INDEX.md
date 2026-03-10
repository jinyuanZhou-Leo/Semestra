<!-- ⚠️ Once this folder changes, update me. -->

`builtin-gradebook/` provides the course-scoped grade planning tab and read-only summary widget.
The tab owns scenario switching, category tags, due-date-aware assessment editing, and server-backed solver actions.
Shared helpers keep gradebook constants, view settings, formatting, and API mutations consistent across tab and widget surfaces.

| File | Role | Description |
|------|------|-------------|
| INDEX.md | Architecture index | Local architecture summary and file map for the builtin-gradebook plugin. |
| index.ts | Runtime entry | Registers the builtin-gradebook tab and summary widget with the plugin runtime loader. |
| metadata.ts | Plugin metadata | Declares the course builtin tab and summary widget catalog entries. |
| shared.ts | Shared helpers | Exposes plugin constants, view-state defaults, and gradebook formatting/selectors. |
| tab.tsx | Tab runtime | Renders the three-column gradebook workspace with scenarios, categories, due dates, and assessment editing. |
| widget.tsx | Widget runtime | Renders a read-only dashboard summary with feasibility, projected result, and upcoming deadlines. |
| shared.test.ts | Test file | Covers shared gradebook settings normalization and scenario selection helpers. |
| widget.test.tsx | Test file | Covers summary widget rendering and open-tab event dispatch. |
