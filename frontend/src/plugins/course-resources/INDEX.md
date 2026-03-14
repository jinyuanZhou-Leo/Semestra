<!-- ⚠️ Once this folder changes, update me. -->

Course-resources plugin adds a course-only file manager tab plus a quick-open dashboard widget.
The tab owns dialog-based uploads, saved-link resources, rename/delete actions, and quota-aware file browsing, while the widget reads from the same course resource list for pinned shortcuts.
Shared helpers normalize widget settings and format file metadata consistently across both surfaces.

| File | Role | Description |
|------|------|-------------|
| INDEX.md | Architecture index | Local map for the course-resources plugin files. |
| index.ts | Runtime entry | Registers the course resource tab and quick-open widget runtime definitions. |
| metadata.ts | Plugin metadata | Declares the course-only tab/widget catalog entries shown in add flows. |
| shared.ts | Shared helpers | Normalizes widget settings, formats byte/date labels, and exposes plugin constants. |
| shared.test.ts | Test file | Verifies widget setting normalization plus shared byte/extension formatting helpers. |
| tab.tsx | Tab runtime | Renders the course resource manager with a scrollable file list, Add Semester-style drag-drop upload dialog, saved-URL support, and file actions. |
| widget.tsx | Widget runtime | Renders pinned resource cards and the widget settings selector UI. |
