<!-- ⚠️ Once this folder changes, update me. -->

Settings-only components that would otherwise crowd generic reusable UI folders.
Currently this folder owns the LMS integration manager used by the global settings workspace.
Keep future settings-specific editors here when they are not broadly reusable outside settings pages.

| File | Role | Description |
|------|------|-------------|
| LmsIntegrationManager.tsx | Settings component | Multi-integration LMS management surface with CRUD-table listing, icon-based row actions, save-time validation, alert-dialog delete confirmation, and provider-specific form guidance. |
