<!-- ⚠️ Once this folder changes, update me. -->

Built-in dashboard plugin renders the default Dashboard tab for semester and course workspaces.
It owns the floating action controls for edit mode, optional overview stat strips, and widget layout/runtime delegation.
Metadata and entry files expose this tab to the plugin-system catalog and wire split layout sync/commit callbacks.

| File | Role | Description |
|------|------|-------------|
| INDEX.md | Architecture index | Local map for built-in dashboard plugin files and responsibilities. |
| index.ts | Runtime entry | Re-exports tab component/definition and metadata exports for plugin loading. |
| metadata.ts | Plugin metadata | Declares plugin id and dashboard tab catalog item for add-tab flows (name, icon, etc.). |
| tab.tsx | Tab runtime | Dashboard tab UI with optional overview-strip rendering, edit-mode persistence, shadcn-token base FAB styling, and split local-sync/commit layout callback wiring into the widget grid. |
