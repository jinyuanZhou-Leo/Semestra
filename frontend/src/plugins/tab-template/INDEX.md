<!-- ⚠️ Once this folder changes, update me. -->

Starter tab plugin showing the minimal metadata/runtime split for a tab extension.
`metadata.ts` publishes the catalog entry, while `tab.tsx` now owns both tab rendering and tab instance settings.
Use this folder as the reference for host-decoupled plugin authoring.

| File | Role | Description |
|------|------|-------------|
| INDEX.md | Architecture index | Local map for the template tab plugin files. |
| index.ts | Runtime entry | Registers the template tab runtime through `definePluginRuntime(...)`. |
| metadata.ts | Plugin metadata | Declares the template tab catalog item shown in add-tab flows. |
| shared.ts | Shared helpers | Normalizes persisted template settings for runtime and settings usage. |
| tab.tsx | Tab runtime | Renders the starter tab and its tab instance settings component. |
