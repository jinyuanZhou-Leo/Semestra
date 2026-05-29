<!-- ⚠️ Once this folder changes, update me. -->

Course-resources plugin adds a course-only file manager tab plus a quick-open dashboard widget.
The tab owns dialog-based uploads, saved-link resources, external-link confirmation, rename/delete actions, quota-aware file browsing, a lower-height stable add-resource dialog body across tab switches, and footer-aligned dialog actions.
Its add-resource dialog stores the active sub-tab plus saved-link form fields in plugin UI storage so link drafts survive tab remounts, while successful uploads now clear only the dialog draft state without resetting the current folder selection or sort order.
Resource mutations now invalidate both semester and active course caches so the tab and quick-open widget stay in sync, and widget cards use slot-stable keys even when the same resource is pinned more than once.
Shared helpers normalize widget settings, detect external URL resources, and format file metadata consistently across both surfaces.

| File | Role | Description |
|------|------|-------------|
| INDEX.md | Architecture index | Local map for the course-resources plugin files. |
| plugin.ts | Plugin entry | Single typed plugin authoring entry that declares course tab/widget metadata and lazy runtime loading through the frontend plugin SDK. |
| index.ts | Runtime entry | Registers the course resource tab and quick-open widget runtime definitions. |
| shared.ts | Shared helpers | Normalizes widget settings, detects external URL resources, formats byte/date labels, and exposes plugin constants. |
| shared.test.ts | Test file | Verifies widget setting normalization plus shared byte/extension formatting helpers. |
| ExternalResourceConfirmDialog.tsx | Shared UI component | Renders the confirmation dialog used before opening saved external URL resources outside Semestra. |
| tab.tsx | Tab runtime | Renders the course resource manager with a scrollable file list, a reduced-height stable drag-drop/upload dialog body across file/link tabs, plugin-local link-form UI-state persistence, cache-aware resource mutations, shared footer action alignment, saved-URL support, external-link confirmation, and file actions. |
| widget.tsx | Widget runtime | Renders pinned resource cards and the widget settings selector UI with slot-stable keys for repeated resource selections, including external-link confirmation for saved URLs. |
