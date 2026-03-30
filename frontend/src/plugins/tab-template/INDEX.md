<!-- ⚠️ Once this folder changes, update me. -->

Starter tab plugin showing the minimal descriptor/runtime split for a tab extension.
`plugin.ts` publishes the typed catalog entry, `settings.tsx` owns the tab settings UI, `setup.tsx` demonstrates a DSL-only Semester setup that covers every host-rendered field type plus validation hooks, and `tab.tsx` stays focused on runtime rendering.
Use this folder as the reference for host-decoupled plugin authoring.

| File | Role | Description |
|------|------|-------------|
| INDEX.md | Architecture index | Local map for the template tab plugin files. |
| plugin.ts | Plugin entry | Single typed plugin authoring entry that declares tab metadata and lazy runtime loading through the frontend plugin SDK. |
| index.ts | Runtime entry | Registers the template tab runtime through `definePluginRuntime(...)`. |
| settings.tsx | Settings entry | Owns the template tab settings component without changing the tab's runtime wiring. |
| setup.tsx | Setup entry | Demonstrates a DSL-only plugin setup that exercises every host-rendered field type plus field-level and definition-level validation. |
| shared.ts | Shared helpers | Normalizes persisted template settings for runtime and settings usage. |
| tab.tsx | Tab runtime | Renders the starter tab and imports its settings component from `settings.tsx`. |
