<!-- ⚠️ Once this folder changes, update me. -->

Settings-only components that would otherwise crowd generic reusable UI folders.
Currently this folder owns the LMS integration manager used by the global settings workspace plus the provider definition helpers that keep Canvas-specific payload wiring out of the manager component.
Keep future settings-specific editors here when they are not broadly reusable outside settings pages.

| File | Role | Description |
|------|------|-------------|
| LmsIntegrationManager.tsx | Settings component | Multi-integration LMS management surface with mobile-safe CRUD-table listing, icon-based row actions, save-time validation, alert-dialog delete confirmation, and provider-definition-driven form behavior instead of inline Canvas payload wiring. |
| lmsProviderDefinitions.ts | Provider helper | Settings-local provider definition registry that preserves Canvas as the only LMS UI while centralizing provider-specific normalization, payload building, and credential masking helpers. |
