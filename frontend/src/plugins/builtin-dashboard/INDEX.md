<!-- ⚠️ Once this folder changes, update me. -->

Built-in dashboard plugin renders the default `builtin-dashboard` host-shell tab for semester and course workspaces.
It owns the floating action controls for edit mode, optional semester overview stat strips, and widget layout/runtime delegation.
The edit-mode toggle now uses plugin-local UI state only for the active dashboard tab session, then resets on tab exit so switching away always closes edit mode before the next visit.
`plugin.ts` now acts as the typed descriptor-backed entry layer while runtime code keeps split layout sync/commit callbacks.

| File | Role | Description |
|------|------|-------------|
| INDEX.md | Architecture index | Local map for built-in dashboard plugin files and responsibilities. |
| plugin.ts | Plugin entry | Single typed plugin authoring entry that declares dashboard metadata and lazy runtime loading through the frontend plugin SDK. |
| index.ts | Runtime entry | Re-exports the builtin-dashboard tab runtime definition for plugin loading. |
| tab.tsx | Tab runtime | Dashboard tab UI with optional overview-strip rendering, plugin-local edit-mode UI state that resets on tab exit, shadcn-token base FAB styling, and split local-sync/commit plus unavailable-widget delete callback wiring into the widget grid. |
