<!-- ⚠️ Once this folder changes, update me. -->

Starter tab plugin showing the minimal descriptor/runtime split for a tab extension.
`plugin.json` and `plugin.ts` publish the catalog entry, while `tab.tsx` now owns both tab rendering and tab instance settings.
Use this folder as the reference for host-decoupled plugin authoring.

| File | Role | Description |
|------|------|-------------|
| INDEX.md | Architecture index | Local map for the template tab plugin files. |
| plugin.json | Plugin manifest | Static public manifest for plugin identity plus tab metadata shared with the backend. |
| plugin.ts | Plugin entry | Binds the descriptor to lazy runtime loading through the frontend plugin SDK. |
| index.ts | Runtime entry | Registers the template tab runtime through `definePluginRuntime(...)`. |
| shared.ts | Shared helpers | Normalizes persisted template settings for runtime and settings usage. |
| tab.tsx | Tab runtime | Renders the starter tab and its tab instance settings component. |
