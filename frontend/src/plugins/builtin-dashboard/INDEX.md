<!-- ⚠️ Once this folder changes, update me. -->

Built-in dashboard plugin renders the default Dashboard tab for semester and course workspaces.
It owns the floating action controls for edit mode and delegates widget layout/runtime to `DashboardGrid`.
Metadata and entry files expose this tab to the plugin-system catalog and wire split layout sync/commit callbacks.

| File | Role | Description |
|------|------|-------------|
| INDEX.md | Architecture index | Local map for built-in dashboard plugin files and responsibilities. |
| index.ts | Runtime entry | Re-exports tab component/definition and metadata exports for plugin loading. |
| metadata.ts | Plugin metadata | Declares plugin id and dashboard tab catalog item for add-tab flows (name, icon, etc.). |
| tab.tsx | Tab runtime | Dashboard tab UI with edit-mode persistence, shadcn-token base FAB styling plus a light-mode light-green glass active tick surface, dark-mode deep-green active surface, and shadowless dark-mode behavior, then split local-sync/commit layout callback wiring into the widget grid. |
