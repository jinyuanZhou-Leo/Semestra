<!-- ⚠️ Once this folder changes, update me. -->

Starter tab plugin showing the minimal descriptor/runtime split for a tab extension.
`plugin.ts` publishes the typed catalog entry, `settings.tsx` now demonstrates both the legacy tab `SettingsComponent` path and a host-rendered Program settings panel built from the new bound settings-field templates, `setup.tsx` demonstrates a DSL-only Semester setup that covers every host-rendered field type plus validation hooks and now acts as the single setup source of truth for both frontend wizard rendering and backend schema generation, and `tab.tsx` stays focused on runtime rendering.
Use this folder as the reference for host-decoupled plugin authoring.

| File | Role | Description |
|------|------|-------------|
| INDEX.md | Architecture index | Local map for the template tab plugin files. |
| plugin.ts | Plugin entry | Single typed plugin authoring entry that declares tab metadata and lazy runtime loading through the frontend plugin SDK while binding setup directly from `setup.tsx` instead of duplicating a second setup schema. |
| index.ts | Runtime entry | Registers the template tab runtime through `definePluginRuntime(...)`. |
| settings.tsx | Settings entry | Keeps the template tab settings component for runtime examples while also demonstrating a Program settings panel built from the shared bound settings-field templates. |
| setup.tsx | Setup entry | Demonstrates a DSL-only plugin setup that exercises every host-rendered field type plus field-level and definition-level validation. |
| shared.ts | Shared helpers | Normalizes persisted template settings for runtime and settings usage. |
| tab.tsx | Tab runtime | Renders the starter tab and imports its settings component from `settings.tsx`. |
