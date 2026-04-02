<!-- ⚠️ Once this folder changes, update me. -->

Settings-only components that would otherwise crowd generic reusable UI folders.
Currently this folder owns the LMS integration manager used by the global settings workspace, the provider definition helpers that keep Canvas-specific payload wiring out of the manager component, and the small shared tab-setting source hint used by Program/Semester/Course tab settings.
Keep future settings-specific editors here when they are not broadly reusable outside settings pages.

| File | Role | Description |
|------|------|-------------|
| LmsIntegrationManager.tsx | Settings component | Multi-integration LMS management surface with mobile-safe data-table listing, an explicit integration-table minimum width, a shadcn-style row-actions dropdown for edit/revalidate/delete actions, save-time validation, alert-dialog delete confirmation, provider-definition-driven form behavior instead of inline Canvas payload wiring, and app-side LMS integration resource hooks/cache invalidation helpers. |
| TabSettingSourceHint.tsx | Settings component | Inline badge-plus-reset helper that shows which layer currently supplies a tab setting and exposes the per-key reset action back to the nearest inherited value or default. |
| lmsProviderDefinitions.ts | Provider helper | Settings-local provider definition registry that preserves Canvas as the only LMS UI while centralizing provider-specific normalization, payload building, and credential masking helpers. |
